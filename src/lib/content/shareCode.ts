const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeShareCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

/** Share codes are 6–12 letters or digits after normalization. */
export function isShareCode(value: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(normalizeShareCode(value));
}

export function importQuizPath(code: string): string {
  return `/import/${encodeURIComponent(normalizeShareCode(code))}`;
}

function cryptoRandomUnit(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0) / 2 ** 32;
}

export function generateShareCode(random: () => number = cryptoRandomUnit): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? 'A';
  }
  return code;
}
