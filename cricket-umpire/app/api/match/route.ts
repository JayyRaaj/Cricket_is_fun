import { redis } from '../../lib/redis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { state, token } = await request.json();
    
    // Generate a 6-character random match ID (e.g. 'abc123')
    let matchId = '';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 6; i++) {
      matchId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Store in Redis wrapper (real Upstash or in-memory fallback)
    await redis.set(`match:${matchId}`, { state, token });
    
    return NextResponse.json({
      matchId,
      isFallback: redis.isFallback()
    });
  } catch (error: any) {
    console.error('Error creating match:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create match' },
      { status: 500 }
    );
  }
}
