import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: any = await kv.get(`match:${id}`);
    
    if (!data) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    
    // Extract token if sent in request header or query param to check editor status
    const url = new URL(request.url);
    const tokenFromHeader = request.headers.get('Authorization') || request.headers.get('x-edit-token') || url.searchParams.get('token');
    
    const isEditor = !!tokenFromHeader && tokenFromHeader === data.token;
    
    return NextResponse.json({
      state: data.state,
      isEditor
    });
  } catch (error: any) {
    console.error('Error fetching match:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch match' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { state, token, newToken } = body;
    
    // Fetch existing match data from KV
    const data: any = await kv.get(`match:${id}`);
    if (!data) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    
    // Validate token server-side
    const tokenFromHeader = request.headers.get('Authorization') || request.headers.get('x-edit-token');
    const providedToken = token || tokenFromHeader;
    
    if (!providedToken || providedToken !== data.token) {
      return NextResponse.json({ error: 'Unauthorized: invalid edit token' }, { status: 401 });
    }
    
    // Update the state in Vercel KV, and update the token if a hand-off occurred (newToken provided)
    const updatedToken = newToken || data.token;
    await kv.set(`match:${id}`, { state, token: updatedToken });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating match:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update match' },
      { status: 500 }
    );
  }
}
