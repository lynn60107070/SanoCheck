import { NextResponse } from 'next/server';
import { insertLiveSensorLog, getLiveSensorLogsLastMinutes } from '@/lib/db';
import { LiveSensorLogPoint } from '@/lib/types';

function parseDbTimestampExport(createdAt: string): number {
  if (!createdAt) return 0;
  let s = String(createdAt).trim();
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(' ', 'T');
  if (/[+-]\d{2}$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) {
    s = s.replace(/([+-])(\d{2})$/, '$1$2:00');
  }
  return new Date(s).getTime();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minutes = Math.min(60, Math.max(1, parseInt(searchParams.get('minutes') || '5', 10) || 5));
    const rows = await getLiveSensorLogsLastMinutes(minutes);
    const graphData: LiveSensorLogPoint[] = rows.map((row) => {
      const ts = parseDbTimestampExport(row.created_at);
      return {
        time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: ts,
        humidity: row.humidity,
        water: row.water,
        gas: row.gas,
        status: row.status,
      };
    });
    return NextResponse.json({ graphData, count: graphData.length });
  } catch (error) {
    console.error('[live-sensor GET]', error);
    return NextResponse.json({ error: 'Failed to fetch live sensor logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { timestamp, humidity, water, gas, status, deviceId } = body;
    if (
      typeof timestamp !== 'number' ||
      typeof humidity !== 'number' ||
      typeof water !== 'number' ||
      typeof gas !== 'number' ||
      typeof status !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid: timestamp, humidity, water, gas, status' },
        { status: 400 }
      );
    }
    await insertLiveSensorLog({
      deviceId: deviceId || undefined,
      timestamp,
      humidity,
      water,
      gas,
      status: String(status),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[live-sensor POST]', error);
    return NextResponse.json({ error: 'Failed to save live sensor log' }, { status: 500 });
  }
}
