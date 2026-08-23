import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis just for the health check
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
let redis: Redis | null = null;

if (UPSTASH_URL && UPSTASH_TOKEN) {
    redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

export async function GET() {
    const healthInfo = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dependencies: {
            redis: 'disconnected'
        }
    };

    try {
        if (redis) {
            // Ping Redis to see if our critical dependency is up
            await redis.ping();
            healthInfo.dependencies.redis = 'connected';
        } else {
            healthInfo.dependencies.redis = 'not_configured';
        }
    } catch (error) {
        // If Redis is down, we flag the app as degraded
        healthInfo.status = 'degraded';
        healthInfo.dependencies.redis = 'error';

        // We return a 503 Service Unavailable so the load balancer knows 
        // there's an issue, but we still return the JSON payload for debugging
        return NextResponse.json(healthInfo, { status: 503 });
    }

    // HTTP 200 OK means everything is fine
    return NextResponse.json(healthInfo, { status: 200 });
}
