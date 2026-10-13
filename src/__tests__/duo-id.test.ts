import { describe, it, expect } from 'vitest';
import { formatDuoId, cleanDuoIdentifier } from '@/lib/duo-id';

describe('Vibe ID Utilities', () => {
  it('formats UUID into uppercase #VIBE-XXXXXXXX tag', () => {
    const uuid = '937f6dac-c8d9-42d5-a494-57121e66dd75';
    expect(formatDuoId(uuid)).toBe('#VIBE-937F6DAC');
  });

  it('formats profile object into Vibe ID', () => {
    const profile = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      display_name: 'Alex',
      username: 'alex',
      avatar_path: null,
      bio: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_seen_at: null,
    };
    expect(formatDuoId(profile)).toBe('#VIBE-A1B2C3D4');
  });

  it('falls back safely on null or undefined input', () => {
    expect(formatDuoId(null)).toBe('#VIBE-00000000');
    expect(formatDuoId(undefined)).toBe('#VIBE-00000000');
    expect(formatDuoId('')).toBe('#VIBE-00000000');
  });

  it('cleans input identifiers stripped of hash, vibe/duo prefix, and at-signs', () => {
    expect(cleanDuoIdentifier('#VIBE-937F6DAC')).toBe('937F6DAC');
    expect(cleanDuoIdentifier('#DUO-937F6DAC')).toBe('937F6DAC');
    expect(cleanDuoIdentifier('vibe-937f6dac')).toBe('937f6dac');
    expect(cleanDuoIdentifier('duo-937f6dac')).toBe('937f6dac');
    expect(cleanDuoIdentifier('#937F6DAC')).toBe('937F6DAC');
    expect(cleanDuoIdentifier('@alex_rivera')).toBe('alex_rivera');
    expect(cleanDuoIdentifier('  #VIBE:12345678  ')).toBe('12345678');
  });
});
