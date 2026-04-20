import { createHmac } from 'crypto';

// Base32 decode
function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const s = str.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of s) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// Generate a TOTP code for a given time step
function totpForStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  buf.writeUInt32BE(step >>> 0, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[19] & 0xf;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

// Verify a TOTP token — window=0 means exact current step only
export function verifyTOTP(token: string, secret: string, window = 0): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (totpForStep(secret, step + i) === token) return true;
  }
  return false;
}

// Generate current TOTP code (for testing)
export function generateTOTP(secret: string): string {
  return totpForStep(secret, Math.floor(Date.now() / 1000 / 30));
}

// Generate a random base32 secret
export function generateSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = require('crypto').randomBytes(20);
  for (const byte of bytes) {
    secret += alphabet[byte % 32];
  }
  return secret;
}
