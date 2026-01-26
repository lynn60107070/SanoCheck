import { NextResponse } from 'next/server';
import { addSensorReading, initializeStore, SensorReading } from '@/lib/store';

export async function POST(request: Request) {
  try {
    initializeStore();
    const body = await request.json();
    
    const reading: SensorReading = {
      bathroomId: body.bathroomId,
      gasLevel: body.gasLevel,
      timestamp: body.timestamp || Date.now(),
    };

    addSensorReading(reading);
    
    return NextResponse.json({ success: true, reading });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
