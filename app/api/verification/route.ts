import { NextResponse } from 'next/server';
import { addVerification } from '@/lib/db';
import { VolunteerVerification } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const verification: VolunteerVerification = {
      bathroomId: body.bathroomId,
      waterAvailable: body.waterAvailable ?? true,
      clogged: body.clogged ?? false,
      usable: body.usable ?? true,
      timestamp: body.timestamp || Date.now(),
      volunteerName: body.volunteerName,
    };

    await addVerification(verification);
    
    return NextResponse.json({ success: true, verification });
  } catch (error) {
    console.error('Error adding verification:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
