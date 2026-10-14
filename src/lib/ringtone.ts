// Web Audio API Ringtone & Audio Engine for Vibely
// Provides real-time incoming ringtone, outgoing ringback, audio unlocking on mobile, and vibration.

let audioCtx: AudioContext | null = null;
let activeInterval: any = null;
let masterGain: GainNode | null = null;
let activeOscillators: OscillatorNode[] = [];
let isRingingActive = false;

export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is only available in browser environment');
  }
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
 * Unlock Audio Context on mobile touch / click user gesture.
 * Playing a 1-sample silent buffer forces mobile Chrome / Safari to mark the audio session as active.
 */
export function unlockAudioSession() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        try {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        } catch {}
      }).catch(() => {});
    }
  } catch {}
}

// Auto-register touch / click unlock listeners on page load
if (typeof window !== 'undefined') {
  const autoUnlock = () => {
    unlockAudioSession();
  };
  ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, autoUnlock, { passive: true, once: false });
  });
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

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

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
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + 1.6);
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
 * Play authentic, loud, and pleasant incoming ringtone chime sequence
 * Harmonically rich tones (fundamental + octave) tuned for phone speakers.
 */
export function startIncomingRing() {
  stopAllRingtones();
  isRingingActive = true;

  // Trigger continuous mobile hardware vibration
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([800, 400, 800, 400, 800, 400]);
    } catch {}
  }

  try {
    const ctx = getAudioContext();
    if (!masterGain) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(1, ctx.currentTime);

    // Modern smartphone call melody:
    // Phrase 1: D5 + G5 -> A5 + D6 -> C6 + E6 -> D6 + F#6
    const phrase = [
      { base: 587.33, harm: 1174.66, delay: 0.00, dur: 0.22, gain: 0.45 },
      { base: 659.25, harm: 1318.51, delay: 0.16, dur: 0.22, gain: 0.45 },
      { base: 783.99, harm: 1567.98, delay: 0.32, dur: 0.25, gain: 0.50 },
      { base: 1046.50, harm: 2093.00, delay: 0.52, dur: 0.45, gain: 0.60 },
      // Repeat echo burst
      { base: 783.99, harm: 1567.98, delay: 1.05, dur: 0.22, gain: 0.45 },
      { base: 1046.50, harm: 2093.00, delay: 1.22, dur: 0.48, gain: 0.60 },
    ];

    const playChime = () => {
      if (!isRingingActive || !ctx || ctx.state === 'closed' || !masterGain) return;
      const targetGain = masterGain;

      // Repeat vibration pattern on each ring loop
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([800, 400, 800, 400, 800, 400]);
        } catch {}
      }

      phrase.forEach(({ base, harm, delay, dur, gain: noteVolume }) => {
        if (!isRingingActive) return;
        const startTime = ctx.currentTime + delay;
        const stopTime = startTime + dur;

        // Primary fundamental note
        const osc1 = ctx.createOscillator();
        // Upper harmonic shimmer
        const osc2 = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(base, startTime);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(harm, startTime);

        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(noteVolume, startTime + 0.03);
        noteGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

        osc1.connect(noteGain);
        osc2.connect(noteGain);
        noteGain.connect(targetGain);

        activeOscillators.push(osc1, osc2);

        osc1.onended = () => {
          activeOscillators = activeOscillators.filter(o => o !== osc1 && o !== osc2);
        };

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(stopTime);
        osc2.stop(stopTime);
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
    }, 2400);
  } catch (e) {
    console.warn('Incoming ring error:', e);
  }
}

/**
 * Stop any active ringtones immediately and cut off sound and vibration completely
 */
export function stopAllRingtones() {
  isRingingActive = false;

  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }

  // Cancel vibration immediately
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
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

/**
 * Play Snapchat-style camera shutter / security event notification chime
 */
export function playSecurityAlertSound() {
  try {
    if (typeof window === 'undefined') return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
    osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.08); // E6 note

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}
