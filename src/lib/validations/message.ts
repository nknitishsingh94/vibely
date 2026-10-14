import { z } from 'zod';

export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10 MB
  audio: 25 * 1024 * 1024,      // 25 MB
  document: 25 * 1024 * 1024,   // 25 MB
  video: 100 * 1024 * 1024,     // 100 MB
};

export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
  ],
};

export function validateFileAttachment(
  file: File,
  forcedCategory?: 'image' | 'video' | 'audio' | 'document'
): { valid: boolean; error?: string; category: 'image' | 'video' | 'audio' | 'document' } {
  // If the user deliberately selected "Document", treat any file (including raw photos/videos) as a document
  if (forcedCategory === 'document') {
    if (file.size > FILE_SIZE_LIMITS.document) {
      return { valid: false, error: `${file.name} exceeds maximum document size of 25 MB`, category: 'document' };
    }
    return { valid: true, category: 'document' };
  }

  const mimeType = file.type;

  if (ALLOWED_MIME_TYPES.image.includes(mimeType) || mimeType.startsWith('image/')) {
    if (file.size > FILE_SIZE_LIMITS.image) {
      return { valid: false, error: `${file.name} exceeds maximum image size of 10 MB`, category: 'image' };
    }
    return { valid: true, category: 'image' };
  }

  if (ALLOWED_MIME_TYPES.video.includes(mimeType) || mimeType.startsWith('video/')) {
    if (file.size > FILE_SIZE_LIMITS.video) {
      return { valid: false, error: `${file.name} exceeds maximum video size of 100 MB`, category: 'video' };
    }
    return { valid: true, category: 'video' };
  }

  if (ALLOWED_MIME_TYPES.audio.includes(mimeType) || mimeType.startsWith('audio/')) {
    if (file.size > FILE_SIZE_LIMITS.audio) {
      return { valid: false, error: `${file.name} exceeds maximum audio size of 25 MB`, category: 'audio' };
    }
    return { valid: true, category: 'audio' };
  }

  // Document fallback
  if (file.size > FILE_SIZE_LIMITS.document) {
    return { valid: false, error: `${file.name} exceeds maximum document size of 25 MB`, category: 'document' };
  }

  return { valid: true, category: 'document' };
}

export const messageTextSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(5000, 'Message cannot exceed 5000 characters');
