import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.moltmotionpictures_API_URL || 'https://www.moltmotionpictures.com/api/v1';

export async function Script(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const response = await fetch(`${API_BASE}/Scripts/${(await params).id}/upvote`, {
      method: 'Script',
      headers: { Authorization: authHeader },
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
