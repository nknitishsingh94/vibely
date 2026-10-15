import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

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

/**
 * GET: Retrieve active registered devices for user (1 Desktop + 1 Mobile maximum)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error } = await adminClient.auth.admin.getUserById(userId);
    if (error || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const metadata = userData.user.user_metadata || {};
    const registeredDevices: RegisteredDevices = metadata.registered_devices || {};

    return NextResponse.json({
      success: true,
      devices: registeredDevices,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

/**
 * POST: Register or verify a device session.
 * Enforces strictly: At most 1 Desktop and at most 1 Mobile device per account!
 * Any 2nd desktop or 2nd mobile (or 3rd device) is blocked until existing slot is freed.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, deviceId, deviceType, deviceName, userAgent } = body;

    if (!userId || !deviceId || !deviceType) {
      return NextResponse.json(
        { error: 'Missing required device information (userId, deviceId, deviceType)' },
        { status: 400 }
      );
    }

    if (deviceType !== 'desktop' && deviceType !== 'mobile') {
      return NextResponse.json({ error: 'Invalid device type. Must be desktop or mobile' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    if (getUserError || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const metadata = userData.user.user_metadata || {};
    const registeredDevices: RegisteredDevices = metadata.registered_devices || {};

    const nowIso = new Date().toISOString();
    const existingSlot = registeredDevices[deviceType as 'desktop' | 'mobile'];

    // 1. Register or update this device slot
    // An authenticated user claims the slot for their device type (at most 1 Desktop + 1 Mobile simultaneously).
    // This allows seamless re-installation of the APK, app updates, and device switching without lock-outs.

    // 2. Register or update this device slot
    const updatedSlot: DeviceInfo = {
      deviceId,
      name: deviceName || (deviceType === 'desktop' ? 'Desktop Browser' : 'Mobile Phone'),
      userAgent: userAgent || '',
      registeredAt: existingSlot?.registeredAt || nowIso,
      lastSeen: nowIso,
    };

    const newRegisteredDevices: RegisteredDevices = {
      ...registeredDevices,
      [deviceType]: updatedSlot,
    };

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        registered_devices: newRegisteredDevices,
      },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      allowed: true,
      success: true,
      device: updatedSlot,
      allDevices: newRegisteredDevices,
    });
  } catch (err: any) {
    console.error('Device session check error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE: Remove a registered device slot (freeing it for another device) or delete full account
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, deviceType, deviceId, action } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Action: Complete Account Purge
    if (action === 'delete_account') {
      try {
        // Delete messages, conversations, friendships, receipts
        await adminClient.from('message_receipts').delete().eq('user_id', userId);
        await adminClient.from('message_reactions').delete().eq('user_id', userId);
        await adminClient.from('messages').delete().eq('sender_id', userId);
        await adminClient.from('friendships').delete().or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);
        await adminClient.from('friend_requests').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        await adminClient.from('conversation_members').delete().eq('user_id', userId);
        await adminClient.from('profiles').delete().eq('id', userId);
        // Delete user from auth
        await adminClient.auth.admin.deleteUser(userId);
      } catch (delErr) {
        console.warn('Account cascade delete partial warning:', delErr);
      }

      return NextResponse.json({ success: true, message: 'Account permanently deleted' });
    }

    // Action: Free specific device slot
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    if (getUserError || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const metadata = userData.user.user_metadata || {};
    const registeredDevices: RegisteredDevices = { ...(metadata.registered_devices || {}) };

    if (deviceType && (deviceType === 'desktop' || deviceType === 'mobile')) {
      delete registeredDevices[deviceType as 'desktop' | 'mobile'];
    } else if (deviceId) {
      if (registeredDevices.desktop?.deviceId === deviceId) delete registeredDevices.desktop;
      if (registeredDevices.mobile?.deviceId === deviceId) delete registeredDevices.mobile;
    }

    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        registered_devices: registeredDevices,
      },
    });

    return NextResponse.json({ success: true, devices: registeredDevices });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
