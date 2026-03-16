import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'f3-auto-session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.ADMIN_TOKEN;
  if (!secret) throw new Error('ADMIN_TOKEN not configured');
  return secret;
}

export function createSessionToken(): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  const hmac = crypto.createHmac('sha256', getSecret()).update(nonce).digest('hex');
  return `${hmac}.${nonce}`;
}

export function validateToken(token: string): boolean {
  return token === process.env.ADMIN_TOKEN;
}

export async function verifySession(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parts = session.value.split('.');
  if (parts.length !== 2) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [hmac, nonce] = parts;
  const expected = crypto.createHmac('sha256', getSecret()).update(nonce).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // Auth passed
}

export function verifyCronSecret(request: Request): NextResponse | null {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
