import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatMessageTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'h:mm a');
  } catch {
    return '';
  }
}

export function formatMessageDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  } catch {
    return dateString;
  }
}

export function formatConversationTime(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yy');
  } catch {
    return '';
  }
}

export function formatLastSeen(dateString?: string | null): string {
  if (!dateString) return 'offline';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60000) return 'last seen just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `last seen ${minutes}m ago`;
    if (isToday(date)) {
      return `last seen today at ${format(date, 'h:mm a')}`;
    }
    if (isYesterday(date)) {
      return `last seen yesterday at ${format(date, 'h:mm a')}`;
    }
    return `last seen ${format(date, 'dd/MM/yy')} at ${format(date, 'h:mm a')}`;
  } catch {
    return 'offline';
  }
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSecureToken(byteLength = 24): string {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function getFileCategory(mimeType: string, filename?: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';

  const ext = filename?.split('.').pop()?.toLowerCase();
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext || '')) return 'audio';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext || '')) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) return 'image';

  return 'document';
}
