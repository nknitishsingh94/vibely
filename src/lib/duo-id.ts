
/**
 * Formats a user UUID into a short, clean, human-readable Vibe ID.
 * Example: '937f6dac-c8d9-42d5-a494-57121e66dd75' -> '#VIBE-937F6DAC'
 */
export function formatDuoId(idOrProfile?: string | { id?: string | null } | null): string {
  if (!idOrProfile) return '#VIBE-00000000';
  const rawId = typeof idOrProfile === 'string' ? idOrProfile : idOrProfile.id;
  if (!rawId) return '#VIBE-00000000';

  const clean = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const prefix = clean.slice(0, 8).toUpperCase();
  return `#VIBE-${prefix}`;
}

/**
 * Normalizes input entered by a user looking to connect.
 * Strips leading '#', 'VIBE-', 'DUO-', '@', and whitespace.
 */
export function cleanDuoIdentifier(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/^#/, '')
    .replace(/^(vibe|duo)[-_:]?/i, '')
    .replace(/^@/, '')
    .trim();
}

