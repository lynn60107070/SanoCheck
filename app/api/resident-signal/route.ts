import { NextResponse } from 'next/server';
import { addResidentSignal, initializeStore, ResidentSignal } from '@/lib/store';

export async function POST(request: Request) {
  try {
    initializeStore();
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

    addResidentSignal(signal);
    
    return NextResponse.json({ success: true, signal });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
