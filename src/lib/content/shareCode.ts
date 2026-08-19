const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeShareCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function generateShareCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? 'A';
  }
  return code;
}
