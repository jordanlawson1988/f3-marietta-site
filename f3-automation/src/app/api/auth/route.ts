import { NextResponse } from 'next/server';
import { validateToken, createSessionToken, setActiveSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const { token } = await request.json();
  if (!validateToken(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const sessionToken = createSessionToken();
  setActiveSession(sessionToken);
  await setSessionCookie(sessionToken);
  return NextResponse.json({ success: true });
}
