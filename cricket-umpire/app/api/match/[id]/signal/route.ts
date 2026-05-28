import { redis } from '../../../../lib/redis';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const signal = await redis.get(`signal:${id}`);
    return NextResponse.json({ signal });
  } catch (error: any) {
    console.error('Error fetching signal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { signal } = body;
    
    if (signal === null) {
      await redis.del(`signal:${id}`);
    } else {
      // Store WebRTC SDP signal with 60s TTL to prevent stale signals
      await redis.set(`signal:${id}`, signal, { ex: 60 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error posting signal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
