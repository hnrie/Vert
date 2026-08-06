import { AudioSettings } from './types';

let actx: AudioContext | null = null;
let humosc: OscillatorNode | null = null;
let humgain: GainNode | null = null;
let humpan: StereoPannerNode | null = null;
let pointerinstalled = false;

function getactx() {
  if (!actx && typeof window !== 'undefined') {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) actx = new Ctx();
  }
  if (actx && actx.state === 'suspended') {
    actx.resume().catch(() => {});
  }
  return actx;
}

export function playuisound(kind: 'click' | 'hover' | 'open' | 'close' | 'toggle' | 'move', settings?: AudioSettings, pan: number = 0) {
  if (!settings || !settings.enabled) return;
  const ctx = getactx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0, Math.min(1, settings.volume));
  const span = settings.spatial ? Math.max(-1, Math.min(1, pan)) : 0;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  let panner: StereoPannerNode | null = null;

  if (ctx.createStereoPanner) {
    panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(span, now);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
  } else {
    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  if (kind === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    gain.gain.setValueAtTime(vol * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (kind === 'hover' || kind === 'move') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
    gain.gain.setValueAtTime(vol * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.start(now);
    osc.stop(now + 0.03);
  } else if (kind === 'open') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(vol * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (kind === 'close') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
    gain.gain.setValueAtTime(vol * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (kind === 'toggle') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);
    gain.gain.setValueAtTime(vol * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export function updateambienthum(settings: AudioSettings) {
  if (typeof window === 'undefined') return;
  const ctx = getactx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const targetvol = settings.enabled ? settings.volume * 0.05 : 0;

  if (settings.enabled && !humosc) {
    humosc = ctx.createOscillator();
    humgain = ctx.createGain();
    humosc.type = 'sine';
    humosc.frequency.setValueAtTime(55, now);

    if (ctx.createStereoPanner) {
      humpan = ctx.createStereoPanner();
      humosc.connect(humgain);
      humgain.connect(humpan);
      humpan.connect(ctx.destination);
    } else {
      humosc.connect(humgain);
      humgain.connect(ctx.destination);
    }

    humgain.gain.setValueAtTime(targetvol, now);
    humosc.start(now);
  } else if (humgain) {
    humgain.gain.setTargetAtTime(targetvol, now, 0.1);
  }
}

export function updatehumpan(pan: number) {
  if (humpan && humpan.pan) {
    const act = getactx();
    if (act) humpan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), act.currentTime, 0.05);
  }
}

export function setupaudiopanning(getsettings: () => AudioSettings) {
  if (typeof window === 'undefined' || pointerinstalled) return;
  pointerinstalled = true;

  window.addEventListener('pointermove', (e) => {
    const s = getsettings();
    if (!s.enabled || !s.spatial) return;
    const xnorm = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const pan = xnorm * s.width;
    updatehumpan(pan);
  }, { passive: true });
}
