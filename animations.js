/**
 * VERT GSAP animation system
 * Uses gsap.context() for scoped cleanup and gsap.matchMedia() for accessibility.
 */
(function () {
    if (typeof gsap === 'undefined') {
        window.VERT_ANIM = { init() {}, hideLoader() { const l = document.getElementById('loader-screen'); if (l) l.classList.add('hidden'); } };
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    let mm = null;
    let reduceMotion = false;
    let mainCtx = null;
    let detailCtx = null;
    let loaderCtx = null;
    let toastTween = null;
    let detailTimeline = null;
    let playerTimeline = null;
    let syncTimeline = null;
    let navTween = null;
    const cardHoverTweens = new WeakMap();

    const EASE_OUT = 'power3.out';
    const EASE_IN_OUT = 'power2.inOut';
    const DUR_FAST = 0.35;
    const DUR_MED = 0.55;
    const DUR_SLOW = 0.85;

    function dur(fast, med, slow) {
        if (reduceMotion) return 0;
        return med;
    }

    function killTween(t) {
        if (t) t.kill();
    }

    function init() {
        document.body.classList.add('gsap-enabled');
        gsap.defaults({ ease: EASE_OUT });

        mm = gsap.matchMedia();
        mm.add({ reduceMotion: '(prefers-reduced-motion: reduce)' }, (ctx) => {
            reduceMotion = ctx.conditions.reduceMotion;
            setupNavbarScroll();
            setupCardHovers();
            return () => {
                cardHoverTweens.clear();
            };
        });

        initLoader();
        setupHeroBackdrop();
    }

    /* ── Loader ── */
    function initLoader() {
        const loader = document.getElementById('loader-screen');
        if (!loader) return;

        loaderCtx = gsap.context(() => {
            const logo = loader.querySelector('.loader-logo');
            const fill = loader.querySelector('.loader-bar-fill');
            if (!logo || !fill) return;

            if (reduceMotion) {
                gsap.set(fill, { width: '100%' });
                return;
            }

            const letters = logo.textContent.split('');
            logo.innerHTML = letters.map((ch, i) =>
                `<span class="loader-letter" style="display:inline-block">${ch === ' ' ? '&nbsp;' : ch}</span>`
            ).join('');

            gsap.from('.loader-letter', {
                y: 30,
                autoAlpha: 0,
                duration: 0.6,
                stagger: 0.06,
                ease: 'back.out(1.4)'
            });

            gsap.to(fill, {
                width: '85%',
                duration: 2.5,
                ease: 'none'
            });
        }, loader);
    }

    function setLoaderProgress(pct) {
        const fill = document.querySelector('.loader-bar-fill');
        if (!fill || reduceMotion) return;
        gsap.to(fill, { width: `${Math.min(pct, 100)}%`, duration: 0.4, ease: 'power1.out' });
    }

    function hideLoader(onComplete) {
        const loader = document.getElementById('loader-screen');
        if (!loader) { if (onComplete) onComplete(); return; }

        if (reduceMotion) {
            loader.classList.add('hidden');
            if (onComplete) onComplete();
            return;
        }

        const fill = loader.querySelector('.loader-bar-fill');
        const tl = gsap.timeline({
            onComplete: () => {
                loader.classList.add('hidden');
                loaderCtx?.revert();
                loaderCtx = null;
                animateHeroEntrance();
                if (onComplete) onComplete();
            }
        });

        if (fill) tl.to(fill, { width: '100%', duration: 0.3, ease: 'power2.out' }, 0);
        tl.to(loader, { autoAlpha: 0, duration: 0.5, ease: 'power2.inOut' }, 0.15);
        tl.to('.loader-inner', { y: -20, autoAlpha: 0, duration: 0.4 }, 0.2);
    }

    /* ── Hero ── */
    function setupHeroBackdrop() {
        const hero = document.getElementById('hero');
        if (!hero || reduceMotion) return;

        gsap.set(hero, { backgroundSize: '112%' });
        gsap.to(hero, {
            backgroundSize: '100%',
            duration: 10,
            ease: 'none',
            repeat: -1,
            yoyo: true
        });
    }

    function animateHeroEntrance() {
        const hero = document.getElementById('hero');
        if (!hero) return;

        const targets = [
            '#hero-badge',
            '#hero-title',
            '#hero-metadata',
            '#hero-overview',
            '.hero-actions .btn-hero',
            '#hero-age'
        ];

        if (reduceMotion) {
            gsap.set(targets.join(','), { clearProps: 'all' });
            return;
        }

        gsap.from(targets, {
            y: 40,
            autoAlpha: 0,
            duration: DUR_SLOW,
            stagger: 0.1,
            ease: EASE_OUT,
            clearProps: 'transform'
        });
    }

    function animateHero(update) {
        const hero = document.getElementById('hero');
        if (!hero) return;

        if (reduceMotion) return;

        if (update) {
            gsap.fromTo(hero,
                { autoAlpha: 0.6 },
                { autoAlpha: 1, duration: 0.6, ease: EASE_OUT }
            );
        }

        const targets = ['#hero-badge', '#hero-title', '#hero-metadata', '#hero-overview', '.hero-actions .btn-hero'];
        gsap.fromTo(targets,
            { y: 25, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: DUR_MED, stagger: 0.08, ease: EASE_OUT, clearProps: 'transform' }
        );
    }

    /* ── Navbar scroll ── */
    function setupNavbarScroll() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        if (reduceMotion) {
            ScrollTrigger.create({
                start: 'top -10',
                onUpdate: (self) => navbar.classList.toggle('solid', self.scroll() > 10)
            });
            return;
        }

        gsap.to(navbar, {
            scrollTrigger: {
                start: 'top -80',
                end: '+=80',
                scrub: 0.3
            },
            '--nav-opacity': 1,
            ease: 'none'
        });

        ScrollTrigger.create({
            start: 'top -10',
            onUpdate: (self) => navbar.classList.toggle('solid', self.scroll() > 10)
        });
    }

    /* ── Content rows (ScrollTrigger) ── */
    function setupRowScrollTriggers() {
        mainCtx?.revert();
        mainCtx = gsap.context(() => {
            gsap.utils.toArray('.content-row').forEach((row) => {
                const head = row.querySelector('.row-head');
                const cards = row.querySelectorAll('.card');

                if (reduceMotion) {
                    gsap.set([head, ...cards], { clearProps: 'all' });
                    return;
                }

                gsap.set(row, { autoAlpha: 1 });
                gsap.set(cards, { autoAlpha: 0, y: 30, scale: 0.94 });

                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: row,
                        start: 'top 88%',
                        toggleActions: 'play none none reverse'
                    }
                });

                if (head) tl.from(head, { x: -30, autoAlpha: 0, duration: DUR_MED }, 0);
                tl.to(cards, {
                    autoAlpha: 1,
                    y: 0,
                    scale: 1,
                    duration: DUR_FAST,
                    stagger: { each: 0.04, from: 'start' },
                    ease: EASE_OUT
                }, 0.1);
            });
        }, document.getElementById('main-rows'));
    }

    function refreshScrollTriggers() {
        ScrollTrigger.refresh();
    }

    /* ── Card hover (Netflix-style) ── */
    function setupCardHovers() {
        if (reduceMotion || window.matchMedia('(max-width: 1100px)').matches) return;

        document.querySelectorAll('.card').forEach((card) => {
            if (card._gsapHoverWired) return;
            card._gsapHoverWired = true;

            const panel = card.querySelector('.card-panel');
            const img = card.querySelector('img');
            let hoverTween = null;
            let delayCall = null;

            if (panel) gsap.set(panel, { yPercent: 100, autoAlpha: 0 });

            const onEnter = () => {
                if (delayCall) delayCall.kill();
                delayCall = gsap.delayedCall(0.3, () => {
                    killTween(hoverTween);
                    hoverTween = gsap.timeline()
                        .to(card, {
                            scale: 1.25,
                            yPercent: -2,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.9), 0 0 30px rgba(229,9,20,0.15)',
                            duration: 0.4,
                            ease: 'back.out(1.2)',
                            overwrite: 'auto'
                        }, 0)
                        .to(img, { filter: 'brightness(0.5)', duration: 0.3 }, 0);
                    if (panel) {
                        hoverTween.to(panel, { yPercent: 0, autoAlpha: 1, duration: 0.3, ease: EASE_OUT }, 0.1);
                        hoverTween.from(panel.querySelectorAll('.card-circle'), {
                            scale: 0,
                            autoAlpha: 0,
                            duration: 0.25,
                            stagger: 0.05,
                            ease: 'back.out(2)'
                        }, 0.15);
                    }
                    card.style.zIndex = '30';
                });
            };

            const onLeave = () => {
                if (delayCall) { delayCall.kill(); delayCall = null; }
                killTween(hoverTween);
                hoverTween = gsap.timeline()
                    .to(card, {
                        scale: 1,
                        yPercent: 0,
                        boxShadow: '0 0 0 rgba(0,0,0,0)',
                        duration: 0.35,
                        ease: EASE_IN_OUT,
                        overwrite: 'auto'
                    }, 0)
                    .to(img, { filter: 'brightness(1)', duration: 0.3 }, 0);
                if (panel) hoverTween.to(panel, { yPercent: 100, autoAlpha: 0, duration: 0.25 }, 0);
                card.style.zIndex = '';
            };

            card.addEventListener('mouseenter', onEnter);
            card.addEventListener('mouseleave', onLeave);
            card.addEventListener('focusin', onEnter);
            card.addEventListener('focusout', (e) => {
                if (!card.contains(e.relatedTarget)) onLeave();
            });
        });
    }

    function prepareCard(card) {
        if (reduceMotion) return;
        card.style.animation = 'none';
        gsap.set(card, { autoAlpha: 0, y: 20, scale: 0.95 });
    }

    /* ── Slider arrows ── */
    function scrollSlider(track, direction) {
        if (!track) return;
        const amount = track.clientWidth * 0.82 * direction;
        if (reduceMotion) {
            track.scrollLeft += amount;
            return;
        }
        gsap.to(track, {
            scrollLeft: track.scrollLeft + amount,
            duration: 0.7,
            ease: EASE_IN_OUT
        });
    }

    /* ── Detail modal ── */
    function openDetail() {
        const ov = document.getElementById('detail-overlay');
        const modal = document.getElementById('detail-modal');
        if (!ov || !modal) return;

        killTween(detailTimeline);
        detailCtx?.revert();
        detailCtx = gsap.context(() => {
            ov.classList.add('active');
            document.body.style.overflow = 'hidden';

            if (reduceMotion) {
                gsap.set([ov, modal], { clearProps: 'all' });
                animateDetailContent();
                return;
            }

            const isMobile = window.matchMedia('(max-width: 768px)').matches;

            gsap.set(ov, { autoAlpha: 0 });
            gsap.set(modal, isMobile
                ? { y: '100%', scale: 1 }
                : { y: 40, scale: 0.92, autoAlpha: 0.8 }
            );

            detailTimeline = gsap.timeline({ defaults: { ease: EASE_OUT } });
            detailTimeline.to(ov, { autoAlpha: 1, duration: DUR_FAST }, 0);
            detailTimeline.to(modal, {
                y: 0,
                scale: 1,
                autoAlpha: 1,
                duration: DUR_MED,
                ease: isMobile ? EASE_OUT : 'back.out(1.1)'
            }, 0.05);
            detailTimeline.add(animateDetailContent, 0.2);
        }, ov);
    }

    function animateDetailContent() {
        const targets = [
            '#detail-hero',
            '#detail-title',
            '#detail-meta',
            '#detail-overview',
            '#detail-genre-line',
            '#detail-cast-line',
            '.detail-hero-buttons .btn-hero',
            '.detail-hero-buttons .circle-action'
        ];

        if (reduceMotion) return;

        gsap.from(targets.filter(s => document.querySelector(s)), {
            y: 20,
            autoAlpha: 0,
            duration: DUR_FAST,
            stagger: 0.06,
            ease: EASE_OUT,
            clearProps: 'transform'
        });
    }

    function closeDetail(onDone) {
        const ov = document.getElementById('detail-overlay');
        const modal = document.getElementById('detail-modal');
        if (!ov || !modal) { if (onDone) onDone(); return; }

        killTween(detailTimeline);

        if (reduceMotion || !ov.classList.contains('active')) {
            ov.classList.remove('active');
            document.body.style.overflow = '';
            detailCtx?.revert();
            detailCtx = null;
            if (onDone) onDone();
            return;
        }

        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        detailTimeline = gsap.timeline({
            onComplete: () => {
                ov.classList.remove('active');
                document.body.style.overflow = '';
                detailCtx?.revert();
                detailCtx = null;
                gsap.set([ov, modal], { clearProps: 'all' });
                if (onDone) onDone();
            }
        });

        detailTimeline.to(modal, {
            y: isMobile ? '100%' : 30,
            scale: isMobile ? 1 : 0.95,
            autoAlpha: 0,
            duration: DUR_FAST,
            ease: 'power2.in'
        }, 0);
        detailTimeline.to(ov, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0.1);
    }

    function animateSimilarCards(container) {
        if (!container || reduceMotion) return;
        const cards = container.querySelectorAll('.sim-card');
        gsap.from(cards, {
            y: 30,
            autoAlpha: 0,
            duration: DUR_FAST,
            stagger: 0.07,
            ease: EASE_OUT,
            scrollTrigger: {
                trigger: container,
                start: 'top 90%',
                toggleActions: 'play none none reverse'
            }
        });
    }

    function animateEpisodes(list) {
        if (!list || reduceMotion) return;
        const cards = list.querySelectorAll('.ep-card');
        gsap.from(cards, {
            x: -20,
            autoAlpha: 0,
            duration: 0.4,
            stagger: 0.05,
            ease: EASE_OUT
        });
    }

    /* ── Player overlay ── */
    function openPlayer() {
        const ov = document.getElementById('player-overlay');
        const back = document.querySelector('.player-back');
        if (!ov) return;

        killTween(playerTimeline);
        ov.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (reduceMotion) return;

        gsap.set(ov, { autoAlpha: 0 });
        if (back) gsap.set(back, { x: -30, autoAlpha: 0 });

        playerTimeline = gsap.timeline();
        playerTimeline.to(ov, { autoAlpha: 1, duration: DUR_FAST }, 0);
        if (back) playerTimeline.to(back, { x: 0, autoAlpha: 1, duration: DUR_MED, ease: EASE_OUT }, 0.15);
    }

    function closePlayer(onDone) {
        const ov = document.getElementById('player-overlay');
        if (!ov) { if (onDone) onDone(); return; }

        killTween(playerTimeline);

        if (reduceMotion || !ov.classList.contains('active')) {
            ov.classList.remove('active', 'show-audio-panel');
            document.body.style.overflow = '';
            if (onDone) onDone();
            return;
        }

        playerTimeline = gsap.timeline({
            onComplete: () => {
                ov.classList.remove('active', 'show-audio-panel');
                document.body.style.overflow = '';
                gsap.set(ov, { clearProps: 'all' });
                if (onDone) onDone();
            }
        });
        playerTimeline.to(ov, { autoAlpha: 0, duration: 0.35, ease: 'power2.in' });
    }

    /* ── Page transitions ── */
    function pageTransition(showEl, hideEls, onComplete) {
        killTween(navTween);

        const toShow = typeof showEl === 'string' ? document.querySelector(showEl) : showEl;
        const toHide = (hideEls || []).map(s => typeof s === 'string' ? document.querySelector(s) : s).filter(Boolean);

        if (!toShow && !toHide.length) { if (onComplete) onComplete(); return; }

        if (reduceMotion) {
            toHide.forEach(el => { if (el) { el.style.display = 'none'; el.classList.remove('active'); } });
            if (toShow) { toShow.style.display = ''; toShow.classList.add('active'); }
            if (onComplete) onComplete();
            return;
        }

        navTween = gsap.timeline({ onComplete });

        toHide.forEach((el, i) => {
            if (!el) return;
            navTween.to(el, {
                autoAlpha: 0,
                y: -15,
                duration: 0.25,
                ease: 'power2.in',
                onComplete: () => {
                    el.style.display = 'none';
                    el.classList.remove('active');
                    gsap.set(el, { clearProps: 'all' });
                }
            }, i * 0.05);
        });

        if (toShow) {
            toShow.style.display = '';
            toShow.classList.add('active');
            gsap.set(toShow, { autoAlpha: 0, y: 20 });
            navTween.to(toShow, {
                autoAlpha: 1,
                y: 0,
                duration: DUR_MED,
                ease: EASE_OUT,
                clearProps: 'all'
            }, 0.15);
        }
    }

    function animateGridCards(grid) {
        if (!grid || reduceMotion) return;
        const cards = grid.querySelectorAll('.card');
        gsap.to(cards, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: DUR_FAST,
            stagger: { each: 0.04, from: 'start' },
            ease: EASE_OUT
        });
        setupCardHovers();
    }

    function animateHomeReturn() {
        if (reduceMotion) return;
        gsap.from(['#hero', '#main-rows'], {
            autoAlpha: 0,
            y: 25,
            duration: DUR_MED,
            stagger: 0.12,
            ease: EASE_OUT
        });
    }

    /* ── Toast ── */
    function showToast(msg) {
        const t = document.getElementById('account-toast');
        if (!t) return;

        killTween(toastTween);
        t.textContent = msg;

        if (reduceMotion) {
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2500);
            return;
        }

        t.classList.add('show');
        gsap.set(t, { y: 20, autoAlpha: 0 });
        toastTween = gsap.timeline();
        toastTween.to(t, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'back.out(1.5)' });
        toastTween.to(t, { y: 10, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, '+=2');
        toastTween.eventCallback('onComplete', () => t.classList.remove('show'));
    }

    /* ── Dropdowns & suggestions ── */
    function animateDropdown(el, open) {
        if (!el) return;
        if (reduceMotion) {
            el.classList.toggle('open', open);
            return;
        }

        if (open) {
            el.classList.add('open');
            const items = el.querySelectorAll('.filter-item, .account-item');
            gsap.fromTo(el,
                { autoAlpha: 0, y: -10 },
                { autoAlpha: 1, y: 0, duration: 0.3, ease: EASE_OUT }
            );
            if (items.length) {
                gsap.from(items, { x: -10, autoAlpha: 0, duration: 0.25, stagger: 0.03, ease: EASE_OUT });
            }
        } else {
            gsap.to(el, {
                autoAlpha: 0,
                y: -8,
                duration: 0.2,
                ease: 'power2.in',
                onComplete: () => {
                    el.classList.remove('open');
                    gsap.set(el, { clearProps: 'all' });
                }
            });
        }
    }

    function animateSuggestions(box) {
        if (!box || reduceMotion) return;
        const items = box.querySelectorAll('.suggest-item, .suggest-footer');
        gsap.from(items, {
            y: 12,
            autoAlpha: 0,
            duration: 0.3,
            stagger: 0.05,
            ease: EASE_OUT
        });
    }

    function toggleSearch(wrapper, open) {
        if (!wrapper || reduceMotion) return;
        const input = wrapper.querySelector('#search-input');
        if (open) {
            gsap.fromTo(wrapper,
                { width: 'auto' },
                { duration: 0.35, ease: EASE_OUT }
            );
            if (input) gsap.from(input, { autoAlpha: 0, x: 10, duration: 0.3, delay: 0.1 });
        }
    }

    /* ── Sync modal ── */
    function openSync() {
        const ov = document.getElementById('sync-overlay');
        const modal = ov?.querySelector('.sync-modal');
        if (!ov) return;

        killTween(syncTimeline);
        ov.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (reduceMotion) return;

        gsap.set(ov, { autoAlpha: 0 });
        if (modal) gsap.set(modal, { y: 30, scale: 0.95, autoAlpha: 0 });

        syncTimeline = gsap.timeline();
        syncTimeline.to(ov, { autoAlpha: 1, duration: DUR_FAST }, 0);
        if (modal) syncTimeline.to(modal, { y: 0, scale: 1, autoAlpha: 1, duration: DUR_MED, ease: 'back.out(1.2)' }, 0.08);
    }

    function closeSync() {
        const ov = document.getElementById('sync-overlay');
        const modal = ov?.querySelector('.sync-modal');
        if (!ov) return;

        killTween(syncTimeline);

        if (reduceMotion || !ov.classList.contains('active')) {
            ov.classList.remove('active');
            document.body.style.overflow = '';
            return;
        }

        syncTimeline = gsap.timeline({
            onComplete: () => {
                ov.classList.remove('active');
                document.body.style.overflow = '';
                gsap.set([ov, modal], { clearProps: 'all' });
            }
        });
        if (modal) syncTimeline.to(modal, { y: 20, scale: 0.96, autoAlpha: 0, duration: 0.25, ease: 'power2.in' }, 0);
        syncTimeline.to(ov, { autoAlpha: 0, duration: 0.25, ease: 'power2.in' }, 0.08);
    }

    function animateSyncTab(panel) {
        if (!panel || reduceMotion) return;
        gsap.from(panel, { x: 20, autoAlpha: 0, duration: 0.3, ease: EASE_OUT });
    }

    /* ── Mobile menu ── */
    function toggleMobileMenu(dd, open) {
        if (!dd || reduceMotion) {
            if (dd) dd.classList.toggle('open', open);
            return;
        }
        if (open) {
            dd.classList.add('open');
            gsap.from(dd.querySelectorAll('.mobile-dropdown-item'), {
                x: -15,
                autoAlpha: 0,
                duration: 0.3,
                stagger: 0.05,
                ease: EASE_OUT
            });
        } else {
            gsap.to(dd, {
                autoAlpha: 0,
                duration: 0.2,
                onComplete: () => {
                    dd.classList.remove('open');
                    gsap.set(dd, { clearProps: 'all' });
                }
            });
        }
    }

    window.VERT_ANIM = {
        init,
        hideLoader,
        setLoaderProgress,
        animateHero,
        setupRowScrollTriggers,
        refreshScrollTriggers,
        setupCardHovers,
        prepareCard,
        scrollSlider,
        openDetail,
        closeDetail,
        animateDetailContent,
        animateSimilarCards,
        animateEpisodes,
        openPlayer,
        closePlayer,
        pageTransition,
        animateGridCards,
        animateHomeReturn,
        showToast,
        animateDropdown,
        animateSuggestions,
        toggleSearch,
        openSync,
        closeSync,
        animateSyncTab,
        toggleMobileMenu
    };
})();
