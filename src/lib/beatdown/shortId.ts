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
  const salt = process.env.BEATDOWN_IP_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BEATDOWN_IP_SALT must be set in production');
    }
    return createHash('sha256').update('beatdown-default-salt-change-me' + ip).digest('hex');
  }
  return createHash('sha256').update(salt + ip).digest('hex');
}
