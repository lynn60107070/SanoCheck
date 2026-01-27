import { NextResponse } from 'next/server';
import { addResidentSignal } from '@/lib/db';
import { ResidentSignal } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const signal: ResidentSignal = {
      bathroomId: body.bathroomId,
      signal: body.signal, // "usable" | "unusable"
      timestamp: body.timestamp || Date.now(),
    };

    if (signal.signal !== 'usable' && signal.signal !== 'unusable') {
      return NextResponse.json(
        { error: 'Signal must be "usable" or "unusable"' },
        { status: 400 }
      );
    }

    await addResidentSignal(signal);
    
    return NextResponse.json({ success: true, signal });
  } catch (error) {
    console.error('Error adding resident signal:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
