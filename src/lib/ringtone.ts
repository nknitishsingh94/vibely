// Web Audio API Ringtone & Ringback Generator for Vibely

let audioCtx: AudioContext | null = null;
let activeInterval: any = null;
let activeGain: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play standard outgoing ringback tone: 440Hz + 480Hz dual tone
 * Rings for 1.8s, then 2.5s silence in loop
 */
export function startOutgoingRing() {
  stopAllRingtones();
  try {
    const ctx = getAudioContext();

    const playBeep = () => {
      if (!ctx || ctx.state === 'closed') return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.setValueAtTime(480, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + 1.6);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.8);
      osc2.stop(ctx.currentTime + 1.8);
    };

    playBeep();
    activeInterval = setInterval(playBeep, 4000);
  } catch (e) {
    console.warn('Outgoing ring error:', e);
  }
}

/**
 * Play pleasant incoming ringtone chime sequence
 */
export function startIncomingRing() {
  stopAllRingtones();
  try {
    const ctx = getAudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 melodic chime

    const playChime = () => {
      if (!ctx || ctx.state === 'closed') return;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.18);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.18 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.18);
        osc.stop(ctx.currentTime + idx * 0.18 + 0.5);
      });
    };

    playChime();
    activeInterval = setInterval(playChime, 2500);
  } catch (e) {
    console.warn('Incoming ring error:', e);
  }
}

/**
 * Stop any active ringtones immediately
 */
export function stopAllRingtones() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  if (activeGain && audioCtx) {
    try {
      activeGain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch {}
    activeGain = null;
  }
}
