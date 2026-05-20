import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return NextResponse.json(
      { error: 'VERCEL_DEPLOY_HOOK_URL not configured' },
      { status: 500 }
    );
  }

  const res = await fetch(hookUrl, { method: 'POST' });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: 'Deploy hook failed', status: res.status, body },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    message: 'Glossary sync deploy triggered',
    deployment: data,
  });
}
