// Web Audio API Ringtone & Audio Engine for Vibely
// Provides customizable real-time incoming ringtones, notification chimes, silent modes, audio unlocking, and vibration.

export interface RingtoneOption {
  id: string;
  name: string;
  description: string;
  isSilent?: boolean;
}

export interface NotificationSoundOption {
  id: string;
  name: string;
  description: string;
  isSilent?: boolean;
}

export const AVAILABLE_RINGTONES: RingtoneOption[] = [
  { id: 'romantic', name: 'Romantic Melody (Default)', description: 'Warm harmonious chime sequence' },
  { id: 'classic', name: 'Classic Telephone Bell', description: 'Traditional dual-tone phone ring' },
  { id: 'harp', name: 'Gentle Harp', description: 'Calming acoustic arpeggio' },
  { id: 'pulse', name: 'Modern Pulse', description: 'Rhythmic electronic alert' },
  { id: 'silent', name: '🔇 Silent (Vibrate Only)', description: 'No sound, phone vibrates silently', isSilent: true },
];

export const AVAILABLE_NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  { id: 'pop', name: 'Sweet Pop (Default)', description: 'Bright dual-note chime' },
  { id: 'bubble', name: 'Bubble Drop', description: 'Soft aquatic water drop' },
  { id: 'crystal', name: 'Crystal Ping', description: 'Crisp high-frequency sparkle' },
  { id: 'whisper', name: 'Soft Whisper', description: 'Subtle low-volume ping' },
  { id: 'silent', name: '🔇 Silent (Muted)', description: 'No chime, silent arrival', isSilent: true },
];

const RINGTONE_PREF_KEY = 'vibely_ringtone_pref';
const NOTIF_SOUND_PREF_KEY = 'vibely_notif_sound_pref';

export function getSelectedRingtone(): string {
  if (typeof window === 'undefined') return 'romantic';
  try {
    return localStorage.getItem(RINGTONE_PREF_KEY) || 'romantic';
  } catch {
    return 'romantic';
  }
}

export function setSelectedRingtone(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RINGTONE_PREF_KEY, id);
  } catch {}
}

export function getSelectedNotificationSound(): string {
  if (typeof window === 'undefined') return 'pop';
  try {
    return localStorage.getItem(NOTIF_SOUND_PREF_KEY) || 'pop';
  } catch {
    return 'pop';
  }
}

export function setSelectedNotificationSound(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIF_SOUND_PREF_KEY, id);
  } catch {}
}

let audioCtx: AudioContext | null = null;
let activeInterval: any = null;
let masterGain: GainNode | null = null;
let activeOscillators: OscillatorNode[] = [];
let isRingingActive = false;
let previewTimeout: any = null;

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
 * Synthesize specific incoming ringtone melody
 */
function playRingtonePhrase(melodyId: string, ctx: AudioContext, targetGain: GainNode) {
  if (melodyId === 'silent') {
    return; // No audio for silent mode
  }

  const now = ctx.currentTime;

  if (melodyId === 'classic') {
    // Classic European/American phone bell (440Hz + 480Hz pulses)
    const playPulse = (startOffset: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now + startOffset);
      osc2.frequency.setValueAtTime(480, now + startOffset);

      gain.gain.setValueAtTime(0, now + startOffset);
      gain.gain.linearRampToValueAtTime(0.35, now + startOffset + 0.03);
      gain.gain.setValueAtTime(0.35, now + startOffset + duration - 0.03);
      gain.gain.linearRampToValueAtTime(0.001, now + startOffset + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(targetGain);

      activeOscillators.push(osc1, osc2);
      osc1.start(now + startOffset);
      osc2.start(now + startOffset);
      osc1.stop(now + startOffset + duration);
      osc2.stop(now + startOffset + duration);
    };

    // Burst 1 & Burst 2
    playPulse(0.0, 0.45);
    playPulse(0.6, 0.45);
    return;
  }

  if (melodyId === 'harp') {
    // Gentle Acoustic Harp Arpeggio: C5 -> E5 -> G5 -> B5 -> C6
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.45 },
      { freq: 659.25, time: 0.15, dur: 0.45 },
      { freq: 783.99, time: 0.30, dur: 0.45 },
      { freq: 987.77, time: 0.45, dur: 0.50 },
      { freq: 1046.50, time: 0.65, dur: 0.80 },
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.28, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(targetGain);
      activeOscillators.push(osc);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
    return;
  }

  if (melodyId === 'pulse') {
    // Modern Synth Electronic Pulse
    const pulses = [0.0, 0.18, 0.36, 0.60, 0.78];
    pulses.forEach((time, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const freq = idx < 3 ? 587.33 : 880.0;
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.22, now + time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.12);

      osc.connect(gain);
      gain.connect(targetGain);
      activeOscillators.push(osc);
      osc.start(now + time);
      osc.stop(now + time + 0.12);
    });
    return;
  }

  // Default: Romantic Harmony
  const romanticPhrase = [
    { base: 587.33, harm: 1174.66, delay: 0.00, dur: 0.22, gain: 0.45 },
    { base: 659.25, harm: 1318.51, delay: 0.16, dur: 0.22, gain: 0.45 },
    { base: 783.99, harm: 1567.98, delay: 0.32, dur: 0.25, gain: 0.50 },
    { base: 1046.50, harm: 2093.00, delay: 0.52, dur: 0.45, gain: 0.60 },
    { base: 783.99, harm: 1567.98, delay: 1.05, dur: 0.22, gain: 0.45 },
    { base: 1046.50, harm: 2093.00, delay: 1.22, dur: 0.48, gain: 0.60 },
  ];

  romanticPhrase.forEach(({ base, harm, delay, dur, gain: noteVolume }) => {
    const startTime = now + delay;
    const stopTime = startTime + dur;

    const osc1 = ctx.createOscillator();
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
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
  });
}

/**
 * Play standard outgoing ringback tone: 440Hz + 480Hz dual tone
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
      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.8);
      osc2.stop(ctx.currentTime + 1.8);
    };

    playBeep();
    activeInterval = setInterval(() => {
      if (!isRingingActive) {
        if (activeInterval) clearInterval(activeInterval);
        return;
      }
      playBeep();
    }, 4000);
  } catch (e) {
    console.warn('Outgoing ring error:', e);
  }
}

/**
 * Play user's preferred incoming ringtone (or silent mode) in continuous loop
 */
export function startIncomingRing() {
  stopAllRingtones();
  isRingingActive = true;

  // Always vibrate mobile device (unless platform disabled)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([800, 400, 800, 400, 800, 400, 800, 400]);
    } catch {}
  }

  const selectedMelody = getSelectedRingtone();
  if (selectedMelody === 'silent') {
    // Silent mode: loop vibration only, no audio
    activeInterval = setInterval(() => {
      if (!isRingingActive) {
        if (activeInterval) clearInterval(activeInterval);
        return;
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([800, 400, 800, 400, 800, 400]);
        } catch {}
      }
    }, 2400);
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!masterGain) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(1, ctx.currentTime);

    const playLoop = () => {
      if (!isRingingActive || !ctx || ctx.state === 'closed' || !masterGain) return;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([800, 400, 800, 400, 800, 400]);
        } catch {}
      }
      playRingtonePhrase(selectedMelody, ctx, masterGain);
    };

    playLoop();
    activeInterval = setInterval(() => {
      if (!isRingingActive) {
        if (activeInterval) clearInterval(activeInterval);
        return;
      }
      playLoop();
    }, 2400);
  } catch (e) {
    console.warn('Incoming ring error:', e);
  }
}

/**
 * Preview a ringtone for 2.2 seconds in settings
 */
export function previewRingtone(ringtoneId: string) {
  stopAllRingtones();
  if (ringtoneId === 'silent') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {}
    }
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!masterGain) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(1, ctx.currentTime);

    playRingtonePhrase(ringtoneId, ctx, masterGain);

    if (previewTimeout) clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
      stopAllRingtones();
    }, 2200);
  } catch (err) {
    console.warn('previewRingtone error:', err);
  }
}

/**
 * Play synthesized message notification chime
 */
export function playSynthesizedNotificationTone(soundId: string) {
  if (soundId === 'silent') return; // Silent / Muted

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;

    if (soundId === 'bubble') {
      // Aquatic bubble droplet sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (soundId === 'crystal') {
      // High sparkle ping
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1567.98, now); // G6
      osc2.frequency.setValueAtTime(2093.00, now); // C7

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
      return;
    }

    if (soundId === 'whisper') {
      // Low soft chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
      return;
    }

    // Default: Sweet Pop
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now); // C6
    osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12); // G6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(523.25, now); // C5 harmonic
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.warn('[Vibely Sound] Error playing synthesized chime:', err);
  }
}

/**
 * Preview notification sound
 */
export function previewNotificationSound(soundId: string) {
  if (soundId === 'silent') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([80]);
      } catch {}
    }
    return;
  }
  playSynthesizedNotificationTone(soundId);
}

/**
 * Stop any active ringtones immediately
 */
export function stopAllRingtones() {
  isRingingActive = false;

  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }

  if (previewTimeout) {
    clearTimeout(previewTimeout);
    previewTimeout = null;
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }

  // Also stop native Android background service ringtone if running in APK
  if (typeof window !== 'undefined' && (window as any).VibelyNative) {
    try {
      (window as any).VibelyNative.stopRingtone();
    } catch {}
  }

  if (masterGain && audioCtx) {
    try {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch {}
  }

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
 * Stop any preview ringtone playback immediately
 */
export function stopRingtonePreview() {
  stopAllRingtones();
}

/**
 * Play camera shutter / security event notification chime
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
    osc.frequency.setValueAtTime(987.77, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}
