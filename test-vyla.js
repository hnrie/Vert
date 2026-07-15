const { chromium } = require('playwright');

const BASE = 'https://vert-phi.vercel.app';

async function runTests() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const results = [];

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    // ====== TEST 1: Auth endpoint ======
    console.log('\n=== TEST 1: Auth endpoint ===');
    try {
        const authRes = await page.goto(`${BASE}/api/vyla-auth`, { waitUntil: 'networkidle', timeout: 15000 });
        const status = authRes ? authRes.status() : 'N/A';
        const body = await page.content();
        const hasToken = body.includes('"token"');
        console.log(`  Status: ${status}, Has token: ${hasToken}`);
        results.push({ test: 'Auth endpoint', pass: status === 200 && hasToken });
    } catch (e) {
        console.log(`  FAILED: ${e.message}`);
        results.push({ test: 'Auth endpoint', pass: false, error: e.message });
    }

    // ====== TEST 2: Player page loads ======
    console.log('\n=== TEST 2: Player page loads ===');
    try {
        // Need to POST to auth first via the page's own fetch
        await page.goto(`${BASE}/vyla-player.html?id=550`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const hasVideo = await page.locator('#video').count();
        const hasHls = await page.evaluate(() => typeof Hls !== 'undefined');
        const loaderVisible = await page.locator('#loader').isVisible();
        console.log(`  Has <video>: ${hasVideo > 0}, Has Hls.js: ${hasHls}, Loader visible: ${loaderVisible}`);
        results.push({ test: 'Player page loads', pass: hasVideo > 0 && hasHls });
    } catch (e) {
        console.log(`  FAILED: ${e.message}`);
        results.push({ test: 'Player page loads', pass: false, error: e.message });
    }

    // ====== TEST 3: Video starts playing (the real test) ======
    console.log('\n=== TEST 3: Video starts playing ===');
    consoleErrors.length = 0;
    try {
        await page.goto(`${BASE}/vyla-player.html?id=550`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait up to 30 seconds for either:
        // 1. video to start playing (currentTime > 0)
        // 2. error screen to show
        // 3. loader to hide (manifest parsed)
        let outcome = 'timeout';
        const deadline = Date.now() + 30000;

        while (Date.now() < deadline) {
            const errorVisible = await page.locator('#error-screen.show').isVisible().catch(() => false);
            if (errorVisible) {
                outcome = 'error';
                const errText = await page.locator('#error-msg').textContent().catch(() => 'unknown');
                console.log(`  Error screen: ${errText}`);
                break;
            }

            const loaderVisible = await page.locator('#loader').isVisible().catch(() => false);
            const currentTime = await page.evaluate(() => document.getElementById('video')?.currentTime || 0);
            const readyState = await page.evaluate(() => document.getElementById('video')?.readyState || 0);
            const hasSrc = await page.evaluate(() => {
                const v = document.getElementById('video');
                return !!(v.src || (v.querySelector('source')?.src));
            });

            if (currentTime > 0 && readyState >= 2) {
                outcome = 'playing';
                console.log(`  Video playing! currentTime=${currentTime.toFixed(1)}s, readyState=${readyState}`);
                break;
            }

            if (!loaderVisible && readyState >= 1) {
                outcome = 'loaded';
                console.log(`  Video loaded (readyState=${readyState}), currentTime=${currentTime.toFixed(1)}s`);
                break;
            }

            await page.waitForTimeout(500);
        }

        if (outcome === 'timeout') {
            const loaderVisible = await page.locator('#loader').isVisible().catch(() => false);
            const sourceBtns = await page.locator('.src-btn').count();
            const subBtns = await page.locator('.sub-btn').count();
            console.log(`  Timeout after 30s. Loader visible: ${loaderVisible}, Source buttons: ${sourceBtns}, Sub buttons: ${subBtns}`);
        }

        const quicErrors = consoleErrors.filter(e => e.includes('QUIC') || e.includes('QUIC_PROTOCOL'));
        const manifestErrors = consoleErrors.filter(e => e.includes('manifestLoadError') || e.includes('Manifest timeout'));
        console.log(`  Console errors: ${consoleErrors.length} total, ${quicErrors.length} QUIC, ${manifestErrors.length} manifest`);

        if (consoleErrors.length > 0) {
            console.log('  First 5 errors:');
            consoleErrors.slice(0, 5).forEach(e => console.log(`    - ${e.substring(0, 150)}`));
        }

        results.push({ test: 'Video starts playing', pass: outcome === 'playing' || outcome === 'loaded', outcome });
    } catch (e) {
        console.log(`  FAILED: ${e.message}`);
        results.push({ test: 'Video starts playing', pass: false, error: e.message });
    }

    // ====== TEST 4: TV episode ======
    console.log('\n=== TEST 4: TV episode (id=1396 s=1 e=1) ===');
    consoleErrors.length = 0;
    try {
        await page.goto(`${BASE}/vyla-player.html?id=1396&season=1&episode=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        let outcome = 'timeout';
        const deadline = Date.now() + 30000;

        while (Date.now() < deadline) {
            const errorVisible = await page.locator('#error-screen.show').isVisible().catch(() => false);
            if (errorVisible) { outcome = 'error'; break; }

            const loaderVisible = await page.locator('#loader').isVisible().catch(() => false);
            const readyState = await page.evaluate(() => document.getElementById('video')?.readyState || 0);

            if (!loaderVisible && readyState >= 1) {
                outcome = 'loaded';
                console.log(`  TV episode loaded (readyState=${readyState})`);
                break;
            }

            await page.waitForTimeout(500);
        }

        if (outcome === 'timeout') console.log('  TV episode timeout after 30s');
        if (outcome === 'error') console.log('  TV episode error screen shown');

        results.push({ test: 'TV episode', pass: outcome === 'loaded', outcome });
    } catch (e) {
        console.log(`  FAILED: ${e.message}`);
        results.push({ test: 'TV episode', pass: false, error: e.message });
    }

    // ====== TEST 5: Subtitle proxy ======
    console.log('\n=== TEST 5: Subtitle proxy ===');
    try {
        const subResponse = await page.goto(`${BASE}/api/vyla-sub?url=${encodeURIComponent('https://cache.vdrk.site/v1/vtt/movie/550/English.vtt')}`, { waitUntil: 'networkidle', timeout: 10000 });
        const status = subResponse ? subResponse.status() : 'N/A';
        const content = await page.content();
        const hasWebVTT = content.includes('WEBVTT');
        console.log(`  Status: ${status}, Has WEBVTT: ${hasWebVTT}`);
        results.push({ test: 'Subtitle proxy', pass: status === 200 && hasWebVTT });
    } catch (e) {
        console.log(`  FAILED: ${e.message}`);
        results.push({ test: 'Subtitle proxy', pass: false, error: e.message });
    }

    // ====== TEST 6: HLS proxy ======
    console.log('\n=== TEST 6: HLS proxy (manifest fetch) ===');
    try {
        // First get a source URL from the API
        const tokenResp = await page.goto(`${BASE}/api/vyla-auth`, { waitUntil: 'networkidle', timeout: 10000 });
        const authBody = await page.evaluate(() => document.body.innerText);
        const tokenMatch = authBody.match(/"token":"([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : null;

        if (token) {
            const apiResp = await page.evaluate(async (t) => {
                const r = await fetch(`https://api.vyla.cc/movie?id=550`, { headers: { 'X-Session-Token': t } });
                const text = await r.text();
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line.includes('"type":"source"')) {
                        const ev = JSON.parse(line.slice(6));
                        return ev.source.url;
                    }
                }
                return null;
            }, token);

            if (apiResp) {
                console.log(`  Got source URL (${apiResp.substring(0, 60)}...)`);
                // Try fetching through our proxy
                const proxyResp = await page.goto(`${BASE}/api/vyla-proxy?url=${encodeURIComponent(apiResp)}`, { waitUntil: 'networkidle', timeout: 15000 });
                const status = proxyResp ? proxyResp.status() : 'N/A';
                const content = await page.content();
                const isManifest = content.includes('#EXTM3U') || content.includes('m3u8');
                const hasProxyUrls = content.includes('/api/vyla-proxy');
                console.log(`  Proxy status: ${status}, Is manifest: ${isManifest}, Has rewritten URLs: ${hasProxyUrls}`);
                results.push({ test: 'HLS proxy', pass: status === 200 && (isManifest || hasProxyUrls) });
            } else {
                console.log('  Could not get source URL from API');
                results.push({ test: 'HLS proxy', pass: false, error: 'No source URL' });
            }
        } else {
            console.log('  Could not get auth token');
            results.push({ test: 'HLS proxy', pass: false, error: 'No token' });
        }
    } catch (e) {
        console.log(`  FAILED: ${e.message}`);
        results.push({ test: 'HLS proxy', pass: false, error: e.message });
    }

    // ====== SUMMARY ======
    console.log('\n========== RESULTS ==========');
    let allPass = true;
    results.forEach(r => {
        const icon = r.pass ? 'PASS' : 'FAIL';
        console.log(`  [${icon}] ${r.test}${r.outcome ? ` (${r.outcome})` : ''}${r.error ? ` - ${r.error}` : ''}`);
        if (!r.pass) allPass = false;
    });
    console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);

    await browser.close();
    process.exit(allPass ? 0 : 1);
}

runTests().catch(e => {
    console.error('Test runner failed:', e);
    process.exit(1);
});
