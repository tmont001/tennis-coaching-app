import { randomBytes } from 'crypto';

const CODE_LENGTH = 8;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS.charAt(bytes[i] % CHARS.length);
  }
  return code;
}

export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, '');
}
