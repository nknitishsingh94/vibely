// Call History Storage & Manager for Vibely
import * as React from 'react';
import type { Profile } from '@/types/database';

export type CallDirection = 'incoming' | 'outgoing';
export type CallType = 'voice' | 'video';
export type CallStatus = 'connected' | 'missed' | 'declined' | 'unavailable' | 'cancelled' | 'ended';

export interface CallLogItem {
  id: string; // unique ID for this call log
  callId: string; // signaling session callId
  partner: Profile; // The other user
  direction: CallDirection; // 'incoming' or 'outgoing'
  callType: CallType; // 'voice' or 'video'
  status: CallStatus;
  duration: number; // Duration in seconds
  startedAt: string; // ISO string
  endedAt?: string; // ISO string
  conversationId?: string;
}

const STORAGE_PREFIX = 'vibely_call_history_';
const CALL_HISTORY_EVENT = 'vibely:call_history_updated';

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * Retrieve call logs for a specific user from localStorage
 */
export function getCallHistory(userId: string): CallLogItem[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed: CallLogItem[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse call history:', e);
    return [];
  }
}

/**
 * Save call history for a user and notify subscribers
 */
export function saveCallHistory(userId: string, history: CallLogItem[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    // Keep max 200 recent calls to prevent excessive storage
    const trimmed = history.slice(0, 200);
    localStorage.setItem(getStorageKey(userId), JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(CALL_HISTORY_EVENT, { detail: { userId } }));
  } catch (e) {
    console.warn('Failed to save call history:', e);
  }
}

/**
 * Add or update a call log entry
 */
export function addCallLog(
  userId: string,
  entry: Omit<CallLogItem, 'id'>
): CallLogItem {
  const current = getCallHistory(userId);
  const existingIdx = current.findIndex(c => c.callId === entry.callId);

  let newOrUpdatedItem: CallLogItem;
  if (existingIdx >= 0) {
    newOrUpdatedItem = {
      ...current[existingIdx],
      ...entry,
    };
    current[existingIdx] = newOrUpdatedItem;
  } else {
    newOrUpdatedItem = {
      ...entry,
      id: `call_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    current.unshift(newOrUpdatedItem);
  }

  saveCallHistory(userId, current);
  return newOrUpdatedItem;
}

/**
 * Update an existing call log entry by callId
 */
export function updateCallLog(
  userId: string,
  callId: string,
  updates: Partial<CallLogItem>
): void {
  if (!userId || !callId) return;
  const current = getCallHistory(userId);
  const idx = current.findIndex(c => c.callId === callId);
  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      ...updates,
    };
    saveCallHistory(userId, current);
  }
}

/**
 * Delete a single call log item
 */
export function deleteCallLog(userId: string, logId: string): void {
  if (!userId || !logId) return;
  const current = getCallHistory(userId);
  const filtered = current.filter(c => c.id !== logId && c.callId !== logId);
  saveCallHistory(userId, filtered);
}

/**
 * Clear all call history for a user
 */
export function clearCallHistory(userId: string): void {
  if (!userId) return;
  saveCallHistory(userId, []);
}

/**
 * Format timestamp nicely (e.g. "Today, 11:20 AM" or "Yesterday, 4:15 PM")
 */
export function formatCallTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format duration in seconds to "1m 24s" or "35s"
 */
export function formatCallDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Custom React Hook to observe call history in real-time
 */
export function useCallHistory(userId?: string) {
  const [history, setHistory] = React.useState<CallLogItem[]>([]);

  const load = React.useCallback(() => {
    if (!userId) {
      setHistory([]);
      return;
    }
    setHistory(getCallHistory(userId));
  }, [userId]);

  React.useEffect(() => {
    load();

    const handleUpdate = (e: any) => {
      if (!userId || !e?.detail?.userId || e.detail.userId === userId) {
        load();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (userId && e.key === getStorageKey(userId)) {
        load();
      }
    };

    window.addEventListener(CALL_HISTORY_EVENT, handleUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(CALL_HISTORY_EVENT, handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [userId, load]);

  const removeLog = React.useCallback(
    (logId: string) => {
      if (!userId) return;
      deleteCallLog(userId, logId);
      load();
    },
    [userId, load]
  );

  const clearAll = React.useCallback(() => {
    if (!userId) return;
    clearCallHistory(userId);
    load();
  }, [userId, load]);

  return {
    history,
    removeLog,
    clearAll,
    refresh: load,
  };
}
