import { NextResponse } from 'next/server';
import { getAllBathrooms, initializeStore, getLatestVerification, getLatestSensorReading, getResidentSignalsByBathroom } from '@/lib/store';
import { rankBathroomsForInspection } from '@/lib/scoring';

export async function GET(request: Request) {
  initializeStore();
  
  const url = new URL(request.url);
  const zone = url.searchParams.get('zone');
  
  let bathrooms = getAllBathrooms();
  if (zone) {
    bathrooms = bathrooms.filter(b => b.zone === zone);
  }

  // Build maps for ranking
  const verificationMap = new Map();
  const signalsMap = new Map();
  const sensorMap = new Map();

  bathrooms.forEach(bathroom => {
    const verification = getLatestVerification(bathroom.id);
    if (verification) {
      verificationMap.set(bathroom.id, verification);
    }

    const signals = getResidentSignalsByBathroom(bathroom.id);
    if (signals.length > 0) {
      signalsMap.set(bathroom.id, signals);
    }

    const sensorReading = getLatestSensorReading(bathroom.id);
    if (sensorReading) {
      sensorMap.set(bathroom.id, sensorReading);
    }
  });

  const ranked = rankBathroomsForInspection(bathrooms, verificationMap, signalsMap, sensorMap);
  
  return NextResponse.json({
    bathrooms: ranked,
    zone: zone || 'all',
  });
}
