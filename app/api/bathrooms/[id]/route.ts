import { NextResponse } from 'next/server';
import { getBathroomById, initializeStore, getLatestVerification, getLatestSensorReading, getResidentSignalsByBathroom } from '@/lib/store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  initializeStore();
  const bathroom = getBathroomById(params.id);
  
  if (!bathroom) {
    return NextResponse.json({ error: 'Bathroom not found' }, { status: 404 });
  }

  const verification = getLatestVerification(params.id);
  const sensorReading = getLatestSensorReading(params.id);
  const signals = getResidentSignalsByBathroom(params.id);

  return NextResponse.json({
    bathroom,
    latestVerification: verification,
    latestSensorReading: sensorReading,
    recentSignals: signals.slice(-5), // Last 5 signals
  });
}
