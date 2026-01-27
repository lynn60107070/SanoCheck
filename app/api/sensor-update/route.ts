import { NextResponse } from 'next/server';
import { addSensorReading } from '@/lib/db';
import { SensorReading, SensorType, GasType } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Support both old format (gasLevel) and new format (sensorType, value)
    let reading: SensorReading;
    
    if (body.sensorType) {
      // New format with sensorType
      reading = {
        bathroomId: body.bathroomId,
        sensorType: body.sensorType as SensorType,
        gasType: body.gasType as GasType | undefined,
        value: body.value,
        unit: body.unit,
        timestamp: body.timestamp || Date.now(),
      };
    } else if (body.gasLevel !== undefined) {
      // Legacy format - convert to new format
      reading = {
        bathroomId: body.bathroomId,
        sensorType: 'gas',
        gasType: body.gasType || 'H2S',
        value: body.gasLevel,
        unit: 'ppm',
        timestamp: body.timestamp || Date.now(),
      };
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: sensorType and value, or gasLevel' },
        { status: 400 }
      );
    }

    // Validate sensor type
    if (!['gas', 'water', 'humidity'].includes(reading.sensorType)) {
      return NextResponse.json(
        { error: 'Invalid sensorType. Must be: gas, water, or humidity' },
        { status: 400 }
      );
    }

    // Validate gasType if it's a gas sensor
    if (reading.sensorType === 'gas' && reading.gasType && !['H2S', 'NH3'].includes(reading.gasType)) {
      return NextResponse.json(
        { error: 'Invalid gasType. Must be: H2S or NH3' },
        { status: 400 }
      );
    }

    await addSensorReading(reading);
    
    return NextResponse.json({ success: true, reading });
  } catch (error) {
    console.error('Error adding sensor reading:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
