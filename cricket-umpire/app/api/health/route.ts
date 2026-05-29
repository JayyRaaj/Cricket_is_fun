import { redis } from '../../lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const pong = await redis.ping();
    return NextResponse.json({
      ok: true,
      pong,
      isFallback: redis.isFallback(),
      vars: {
        hasUrl: !!process.env.KV_REST_API_URL,
        hasToken: !!process.env.KV_REST_API_TOKEN,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Redis ping failed',
        vars: {
          hasUrl: !!process.env.KV_REST_API_URL,
          hasToken: !!process.env.KV_REST_API_TOKEN,
        },
      },
      { status: 500 }
    );
  }
}
