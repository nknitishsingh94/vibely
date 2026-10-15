// Vibely Device Session Management
// Enforces strictly 1 Desktop + 1 Mobile maximum per user account

export interface DeviceInfo {
  deviceId: string;
  name: string;
  userAgent: string;
  registeredAt: string;
  lastSeen: string;
}

export interface RegisteredDevices {
  desktop?: DeviceInfo;
  mobile?: DeviceInfo;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  try {
    let id = localStorage.getItem('vibely_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      localStorage.setItem('vibely_device_id', id);
    }
    return id;
  } catch {
    return 'temp_device_' + Date.now();
  }
}

export function getDeviceType(): 'desktop' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isNarrowScreen = window.innerWidth < 768;
  return isMobileUA || isNarrowScreen ? 'mobile' : 'desktop';
}

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent || '';
  const type = getDeviceType();

  if (/Android/i.test(ua)) return 'Android Device';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac Desktop';
  if (/Linux/i.test(ua)) return 'Linux PC';

  return type === 'desktop' ? 'Desktop Browser' : 'Mobile Device';
}

/**
 * Register or verify device session against server
 */
export async function registerDeviceSession(userId: string): Promise<{
  allowed: boolean;
  error?: string;
  message?: string;
  existingDevice?: DeviceInfo;
  devices?: RegisteredDevices;
}> {
  try {
    const deviceId = getDeviceId();
    const deviceType = getDeviceType();
    const deviceName = getDeviceName();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    const res = await fetch('/api/auth/device-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceId,
        deviceType,
        deviceName,
        userAgent,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('registerDeviceSession failed:', err);
    // On network failure, default to allowed to prevent accidental lockout
    return { allowed: true };
  }
}

/**
 * Release this device's slot on logout
 */
export async function releaseDeviceSession(userId: string): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const deviceType = getDeviceType();

    await fetch('/api/auth/device-session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceId,
        deviceType,
      }),
    });
  } catch (err) {
    console.warn('releaseDeviceSession error:', err);
  }
}

/**
 * Fetch all registered devices for user
 */
export async function fetchRegisteredDevices(userId: string): Promise<RegisteredDevices> {
  try {
    const res = await fetch(`/api/auth/device-session?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    return data?.devices || {};
  } catch (err) {
    console.warn('fetchRegisteredDevices error:', err);
    return {};
  }
}

/**
 * Remotely disconnect a registered device slot
 */
export async function disconnectRemoteDevice(userId: string, targetType: 'desktop' | 'mobile'): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/device-session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceType: targetType,
      }),
    });
    const data = await res.json();
    return Boolean(data?.success);
  } catch (err) {
    console.warn('disconnectRemoteDevice error:', err);
    return false;
  }
}

/**
 * Permanently delete entire account and clear all device bindings
 */
export async function purgeAccountPermanently(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/device-session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action: 'delete_account',
      }),
    });
    const data = await res.json();
    return Boolean(data?.success);
  } catch (err) {
    console.warn('purgeAccountPermanently error:', err);
    return false;
  }
}
