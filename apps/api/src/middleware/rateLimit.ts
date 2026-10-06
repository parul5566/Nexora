import type { Request, Response, NextFunction } from 'express';

// Minimal in-memory rate limiter (per-IP sliding window). No external deps.

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

// periodic cleanup to avoid unbounded growth
let lastSweep = Date.now();
function sweep(now: number) {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [k, b] of buckets) {
        if (b.resetAt < now) buckets.delete(k);
    }
}

export interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
    keyByUser?: boolean;
}

export function rateLimit(opts: RateLimitOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        sweep(now);
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
        const uid = (req as any).ctx?.userId;
        // bucket per (identity, method+route)
        const identity = opts.keyByUser && uid ? `u:${uid}` : `ip:${ip}`;
        const bucketKey = `${identity}:${req.method}:${(req.route?.path ?? req.path ?? '')}`;
        let b = buckets.get(bucketKey);
        if (!b || b.resetAt < now) {
            b = { count: 0, resetAt: now + opts.windowMs };
            buckets.set(bucketKey, b);
        }
        b.count += 1;
        res.setHeader('X-RateLimit-Limit', String(opts.max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.max - b.count)));
        if (b.count > opts.max) {
            res.setHeader('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
            return void res.status(429).json({
                error: { code: 'RATE_LIMITED', message: opts.message ?? 'Too many requests, slow down' },
            });
        }
        next();
    };
}

// Convenience presets
export const authLimiter = () => rateLimit({ windowMs: 60_000, max: 100, message: 'Too many attempts, try again in a minute' });
export const writeLimiter = () => rateLimit({ windowMs: 60_000, max: 240, message: 'Posting too fast, slow down' });
