import { NextResponse } from 'next/server';
import { validateToken, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth';

export async function POST(request: Request) {
  const { token } = await request.json();
  if (!validateToken(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const sessionToken = createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return response;
}
