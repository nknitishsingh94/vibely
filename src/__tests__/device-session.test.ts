import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDeviceId,
  getDeviceType,
  getDeviceName,
} from '@/lib/device-session';
import {
  AVAILABLE_RINGTONES,
  AVAILABLE_NOTIFICATION_SOUNDS,
  getSelectedRingtone,
  setSelectedRingtone,
  getSelectedNotificationSound,
  setSelectedNotificationSound,
} from '@/lib/ringtone';

describe('Device Session Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates and persists a stable deviceId in localStorage', () => {
    const id1 = getDeviceId();
    expect(id1).toBeTruthy();
    expect(id1.startsWith('dev_')).toBe(true);

    const id2 = getDeviceId();
    expect(id2).toBe(id1);
  });

  it('detects desktop device when screen is wide and UA is desktop', () => {
    window.innerWidth = 1280;
    const type = getDeviceType();
    expect(type).toBe('desktop');
  });

  it('detects mobile device when screen is narrow (<768px)', () => {
    window.innerWidth = 375;
    const type = getDeviceType();
    expect(type).toBe('mobile');
  });
});

describe('Ringtone & Notification Sound Preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('includes silent options for both ringtone and notification sounds', () => {
    const silentRingtone = AVAILABLE_RINGTONES.find(r => r.id === 'silent');
    expect(silentRingtone).toBeDefined();
    expect(silentRingtone?.isSilent).toBe(true);

    const silentNotif = AVAILABLE_NOTIFICATION_SOUNDS.find(s => s.id === 'silent');
    expect(silentNotif).toBeDefined();
    expect(silentNotif?.isSilent).toBe(true);
  });

  it('defaults to romantic for ringtone and pop for notification chime', () => {
    expect(getSelectedRingtone()).toBe('romantic');
    expect(getSelectedNotificationSound()).toBe('pop');
  });

  it('saves and retrieves ringtone and notification preferences properly', () => {
    setSelectedRingtone('classic');
    expect(getSelectedRingtone()).toBe('classic');

    setSelectedRingtone('silent');
    expect(getSelectedRingtone()).toBe('silent');

    setSelectedNotificationSound('crystal');
    expect(getSelectedNotificationSound()).toBe('crystal');

    setSelectedNotificationSound('silent');
    expect(getSelectedNotificationSound()).toBe('silent');
  });
});
