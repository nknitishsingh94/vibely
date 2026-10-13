import { Profile } from '@/types/database';

/**
 * Formats a user UUID into a short, clean, human-readable Duo ID.
 * Example: '937f6dac-c8d9-42d5-a494-57121e66dd75' -> '#DUO-937F6DAC'
 */
export function formatDuoId(idOrProfile?: string | { id?: string | null } | null): string {
  if (!idOrProfile) return '#DUO-00000000';
  const rawId = typeof idOrProfile === 'string' ? idOrProfile : idOrProfile.id;
  if (!rawId) return '#DUO-00000000';

  const clean = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const prefix = clean.slice(0, 8).toUpperCase();
  return `#DUO-${prefix}`;
}

/**
 * Normalizes input entered by a user looking to connect.
 * Strips leading '#', 'DUO-', '@', and whitespace.
 */
export function cleanDuoIdentifier(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/^#/, '')
    .replace(/^duo[-_:]?/i, '')
    .replace(/^@/, '')
    .trim();
}
