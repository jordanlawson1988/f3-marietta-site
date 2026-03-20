import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Better Auth admin protection (Edge Runtime compatible - cookie check only)
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const hasSession = request.cookies.has('better-auth.session_token');
        if (!hasSession) {
            // Redirect to admin login (the admin layout handles the login UI)
            // Allow the request through — the layout will show login form
        }
    }

    const response = NextResponse.next();

    // Content Security Policy — report-only for safe rollout
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.openai.com",
        "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');

    response.headers.set('Content-Security-Policy-Report-Only', csp);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
