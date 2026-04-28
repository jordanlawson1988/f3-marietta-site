import { randomBytes, createHash } from 'crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // crockford-ish, drops easily-confused chars

export function newShortId(): string {
  const buf = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

export function hashIp(ip: string): string {
  const salt = process.env.BEATDOWN_IP_SALT || 'beatdown-default-salt-change-me';
  return createHash('sha256').update(salt + ip).digest('hex');
}
