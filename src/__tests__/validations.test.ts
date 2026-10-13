import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from '@/lib/validations/auth';
import { validateFileAttachment } from '@/lib/validations/message';

describe('Auth Validation Schemas', () => {
  it('should validate correct login credentials with email', () => {
    const valid = loginSchema.safeParse({
      email: 'friend@vibely.local',
      password: 'password123',
    });
    expect(valid.success).toBe(true);
  });

  it('should validate correct login credentials with username', () => {
    const valid = loginSchema.safeParse({
      identifier: 'alex_rivera',
      password: 'password123',
    });
    expect(valid.success).toBe(true);
  });

  it('should reject empty or missing identifier in login', () => {
    const invalid = loginSchema.safeParse({
      identifier: '',
      password: 'password123',
    });
    expect(invalid.success).toBe(false);
  });

  it('should enforce password complexity in signup', () => {
    // Missing uppercase
    const missingUpper = signupSchema.safeParse({
      displayName: 'Alex',
      username: 'alex_r',
      email: 'alex@example.com',
      password: 'lowercase123',
      confirmPassword: 'lowercase123',
    });
    expect(missingUpper.success).toBe(false);

    // Mismatched passwords
    const mismatch = signupSchema.safeParse({
      displayName: 'Alex',
      username: 'alex_r',
      email: 'alex@example.com',
      password: 'Password123',
      confirmPassword: 'DifferentPassword123',
    });
    expect(mismatch.success).toBe(false);

    // Valid signup
    const valid = signupSchema.safeParse({
      displayName: 'Alex Rivera',
      username: 'alex_rivera',
      email: 'alex@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(valid.success).toBe(true);
  });
});

describe('File Attachment Validation', () => {
  it('should accept valid images under 10MB', () => {
    const fakeImage = new File(['x'.repeat(1000)], 'sunset.jpg', { type: 'image/jpeg' });
    const result = validateFileAttachment(fakeImage);
    expect(result.valid).toBe(true);
    expect(result.category).toBe('image');
  });

  it('should reject images over 10MB', () => {
    // 11MB file
    const fakeBlob = new Blob([new Uint8Array(11 * 1024 * 1024)]);
    const oversizedImage = new File([fakeBlob], 'huge.png', { type: 'image/png' });
    const result = validateFileAttachment(oversizedImage);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 MB');
  });

  it('should correctly classify audio and video files', () => {
    const fakeAudio = new File(['audio-data'], 'song.mp3', { type: 'audio/mpeg' });
    const audioRes = validateFileAttachment(fakeAudio);
    expect(audioRes.valid).toBe(true);
    expect(audioRes.category).toBe('audio');

    const fakeVideo = new File(['video-data'], 'clip.mp4', { type: 'video/mp4' });
    const videoRes = validateFileAttachment(fakeVideo);
    expect(videoRes.valid).toBe(true);
    expect(videoRes.category).toBe('video');
  });
});
