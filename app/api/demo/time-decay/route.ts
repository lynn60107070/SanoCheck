import { NextResponse } from 'next/server';
import { simulateTimeDecay } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const days = body.days || 5;
    
    await simulateTimeDecay(days);
    
    return NextResponse.json({ success: true, message: `Time decay simulated: ${days} days` });
  } catch (error) {
    console.error('Error simulating time decay:', error);
    return NextResponse.json(
      { error: 'Failed to simulate time decay' },
      { status: 500 }
    );
  }
}
