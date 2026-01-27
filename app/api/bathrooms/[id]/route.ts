import { NextResponse } from 'next/server';
import { getBathroomById, getLatestVerification, getSensorReadingsByBathroom, getResidentSignalsByBathroom } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bathroom = await getBathroomById(params.id);
    
    if (!bathroom) {
      return NextResponse.json({ error: 'Bathroom not found' }, { status: 404 });
    }

    const verification = await getLatestVerification(params.id);
    const sensorReadings = await getSensorReadingsByBathroom(params.id);
    const signals = await getResidentSignalsByBathroom(params.id);

    // Get latest reading for each sensor type
    const latestGas = sensorReadings.filter(r => r.sensorType === 'gas').sort((a, b) => b.timestamp - a.timestamp)[0] || null;
    const latestWater = sensorReadings.filter(r => r.sensorType === 'water').sort((a, b) => b.timestamp - a.timestamp)[0] || null;
    const latestHumidity = sensorReadings.filter(r => r.sensorType === 'humidity').sort((a, b) => b.timestamp - a.timestamp)[0] || null;

    return NextResponse.json({
      bathroom,
      latestVerification: verification,
      sensorReadings: {
        gas: latestGas,
        water: latestWater,
        humidity: latestHumidity,
        all: sensorReadings.slice(-10), // Last 10 readings
      },
      recentSignals: signals.slice(-5), // Last 5 signals
    });
  } catch (error) {
    console.error('Error fetching bathroom details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bathroom details' },
      { status: 500 }
    );
  }
}
