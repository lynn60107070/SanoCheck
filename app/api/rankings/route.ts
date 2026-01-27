import { NextResponse } from 'next/server';
import { getAllBathrooms, getLatestVerification, getSensorReadingsByBathroom, getResidentSignalsByBathroom } from '@/lib/db';
import { rankBathroomsForInspection } from '@/lib/scoring';
import { VolunteerVerification, ResidentSignal, SensorReading } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const zone = url.searchParams.get('zone');
    
    let bathrooms = await getAllBathrooms();
    if (zone && zone !== 'all') {
      bathrooms = bathrooms.filter(b => b.zone === zone);
    }

    // Build maps for ranking
    const verificationMap = new Map<string, VolunteerVerification>();
    const signalsMap = new Map<string, ResidentSignal[]>();
    const sensorReadingsMap = new Map<string, SensorReading[]>();

    for (const bathroom of bathrooms) {
      const verification = await getLatestVerification(bathroom.id);
      if (verification) {
        verificationMap.set(bathroom.id, verification);
      }

      const signals = await getResidentSignalsByBathroom(bathroom.id);
      if (signals.length > 0) {
        signalsMap.set(bathroom.id, signals);
      }

      const sensorReadings = await getSensorReadingsByBathroom(bathroom.id);
      if (sensorReadings.length > 0) {
        sensorReadingsMap.set(bathroom.id, sensorReadings);
      }
    }

    const ranked = rankBathroomsForInspection(bathrooms, verificationMap, signalsMap, sensorReadingsMap);
    
    return NextResponse.json({
      bathrooms: ranked,
      zone: zone || 'all',
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
