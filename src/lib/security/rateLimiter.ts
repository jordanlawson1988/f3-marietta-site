import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
}

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

/**
 * Check rate limit for a request. Returns a 429 response if exceeded, or null if allowed.
 */
export function checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
): NextResponse | null {
    cleanup();

    const ip = getClientIp(request);
    const key = `${request.nextUrl.pathname}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return null;
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
                },
            }
        );
    }

    return null;
}
