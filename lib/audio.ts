import { AudioSettings } from './types';

let actx: AudioContext | null = null;
let humosc: OscillatorNode | null = null;
let humgain: GainNode | null = null;
let humpan: StereoPannerNode | null = null;
let pointerinstalled = false;

function getactx(create: boolean = true) {
  if (!actx && create && typeof window !== 'undefined') {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) actx = new Ctx();
  }
  if (actx && actx.state === 'suspended') {
    actx.resume().catch(() => {});
  }
  return actx;
}

type SoundKind = 'click' | 'hover' | 'open' | 'close' | 'toggle' | 'move';

const soundspec: Record<SoundKind, { wave: OscillatorType; from: number; to: number; gain: number; dur: number }> = {
  click: { wave: 'sine', from: 800, to: 200, gain: 0.4, dur: 0.05 },
  hover: { wave: 'sine', from: 440, to: 300, gain: 0.15, dur: 0.03 },
  move: { wave: 'sine', from: 440, to: 300, gain: 0.15, dur: 0.03 },
  open: { wave: 'triangle', from: 300, to: 880, gain: 0.3, dur: 0.12 },
  close: { wave: 'triangle', from: 880, to: 220, gain: 0.3, dur: 0.12 },
  toggle: { wave: 'sine', from: 520, to: 680, gain: 0.25, dur: 0.06 }
};

export function playuisound(kind: SoundKind, settings?: AudioSettings, pan: number = 0) {
  if (!settings || !settings.enabled) return;
  const spec = soundspec[kind];
  if (!spec) return;

  const vol = Math.max(0, Math.min(1, settings.volume));
  const peak = vol * spec.gain;
  if (peak <= 0.001) return;

  const ctx = getactx();
  if (!ctx) return;

  const now = ctx.currentTime;
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

  osc.type = spec.wave;
  osc.frequency.setValueAtTime(spec.from, now);
  osc.frequency.exponentialRampToValueAtTime(spec.to, now + spec.dur);
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + spec.dur);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    if (panner) panner.disconnect();
  };

  osc.start(now);
  osc.stop(now + spec.dur);
}

export function updateambienthum(settings: AudioSettings) {
  if (typeof window === 'undefined') return;
  const ctx = getactx(settings.enabled);
  if (!ctx) return;
  const now = ctx.currentTime;
  const targetvol = settings.enabled ? settings.volume * 0.05 : 0;

  if (!settings.enabled) {
    if (humgain) humgain.gain.setTargetAtTime(0, now, 0.1);
    return;
  }

  if (!humosc) {
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

    humgain.gain.setValueAtTime(0, now);
    humosc.start(now);
  }

  if (humgain) humgain.gain.setTargetAtTime(targetvol, now, 0.1);
}

export function updatehumpan(pan: number) {
  if (humpan && humpan.pan) {
    const act = getactx(false);
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
