import { NextResponse } from 'next/server';
import { addVerification, initializeStore, VolunteerVerification } from '@/lib/store';

export async function POST(request: Request) {
  try {
    initializeStore();
    const body = await request.json();
    
    const verification: VolunteerVerification = {
      bathroomId: body.bathroomId,
      waterAvailable: body.waterAvailable ?? true,
      clogged: body.clogged ?? false,
      usable: body.usable ?? true,
      timestamp: body.timestamp || Date.now(),
      volunteerName: body.volunteerName,
    };

    addVerification(verification);
    
    return NextResponse.json({ success: true, verification });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
