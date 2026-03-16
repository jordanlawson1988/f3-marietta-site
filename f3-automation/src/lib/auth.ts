import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'f3-auto-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

// Simple in-memory session store (single user, restarts clear sessions)
let activeSession: string | null = null;

export function validateToken(token: string): boolean {
  return token === process.env.ADMIN_TOKEN;
}

export function setActiveSession(sessionToken: string): void {
  activeSession = sessionToken;
}

export async function verifySession(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value || session.value !== activeSession) {
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
