// Web Audio API Ringtone & Ringback Generator for Vibely

let audioCtx: AudioContext | null = null;
let activeInterval: any = null;
let masterGain: GainNode | null = null;
let activeOscillators: OscillatorNode[] = [];
let isRingingActive = false;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  if (!masterGain) {
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play standard outgoing ringback tone: 440Hz + 480Hz dual tone
 * Rings for 1.8s, then 2.2s silence in loop
 */
export function startOutgoingRing() {
  stopAllRingtones();
  isRingingActive = true;
  try {
    const ctx = getAudioContext();
    if (!masterGain) return;

    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(1, ctx.currentTime);

    const playBeep = () => {
      if (!isRingingActive || !ctx || ctx.state === 'closed' || !masterGain) return;
      const targetGain = masterGain;

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
      gain.connect(targetGain);

      activeOscillators.push(osc1, osc2);

      const cleanupOsc = () => {
        activeOscillators = activeOscillators.filter(o => o !== osc1 && o !== osc2);
      };
      osc1.onended = cleanupOsc;

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.8);
      osc2.stop(ctx.currentTime + 1.8);
    };

    playBeep();
    activeInterval = setInterval(() => {
      if (!isRingingActive) {
        if (activeInterval) {
          clearInterval(activeInterval);
          activeInterval = null;
        }
        return;
      }
      playBeep();
    }, 4000);
  } catch (e) {
    console.warn('Outgoing ring error:', e);
  }
}

/**
 * Play pleasant incoming ringtone chime sequence
 */
export function startIncomingRing() {
  stopAllRingtones();
  isRingingActive = true;
  try {
    const ctx = getAudioContext();
    if (!masterGain) return;

    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(1, ctx.currentTime);

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 melodic chime

    const playChime = () => {
      if (!isRingingActive || !ctx || ctx.state === 'closed' || !masterGain) return;
      const targetGain = masterGain;

      notes.forEach((freq, idx) => {
        if (!isRingingActive) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.18);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.18 + 0.5);

        osc.connect(gain);
        gain.connect(targetGain);

        activeOscillators.push(osc);
        osc.onended = () => {
          activeOscillators = activeOscillators.filter(o => o !== osc);
        };

        osc.start(ctx.currentTime + idx * 0.18);
        osc.stop(ctx.currentTime + idx * 0.18 + 0.5);
      });
    };

    playChime();
    activeInterval = setInterval(() => {
      if (!isRingingActive) {
        if (activeInterval) {
          clearInterval(activeInterval);
          activeInterval = null;
        }
        return;
      }
      playChime();
    }, 2500);
  } catch (e) {
    console.warn('Incoming ring error:', e);
  }
}

/**
 * Stop any active ringtones immediately and cut off sound completely
 */
export function stopAllRingtones() {
  isRingingActive = false;

  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }

  // Immediately mute master gain
  if (masterGain && audioCtx) {
    try {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch {}
  }

  // Force stop and disconnect all active oscillators
  if (activeOscillators.length > 0) {
    activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    activeOscillators = [];
  }
}
