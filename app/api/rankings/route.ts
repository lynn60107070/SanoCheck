import { NextResponse } from 'next/server';
import {
  getAllBathrooms,
  getLatestVerification,
  getSensorReadingsByBathroom,
  getResidentSignalsByBathroom,
  getUsageCountsForBathrooms,
  attachUsageToBathrooms,
} from '@/lib/db';
import { rankBathroomsForInspection } from '@/lib/scoring';
import { VolunteerVerification, ResidentSignal, SensorReading } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const zone = url.searchParams.get('zone');

    let bathrooms = await getAllBathrooms();
    if (zone && zone !== 'all') {
      bathrooms = bathrooms.filter((b) => b.zone === zone);
    }

    const [usageCounts, verificationMap, signalsMap, sensorReadingsMap] = await Promise.all([
      getUsageCountsForBathrooms(),
      (async () => {
        const m = new Map<string, VolunteerVerification>();
        for (const b of bathrooms) {
          const v = await getLatestVerification(b.id);
          if (v) m.set(b.id, v);
        }
        return m;
      })(),
      (async () => {
        const m = new Map<string, ResidentSignal[]>();
        for (const b of bathrooms) {
          const s = await getResidentSignalsByBathroom(b.id);
          if (s.length > 0) m.set(b.id, s);
        }
        return m;
      })(),
      (async () => {
        const m = new Map<string, SensorReading[]>();
        for (const b of bathrooms) {
          const r = await getSensorReadingsByBathroom(b.id);
          if (r.length > 0) m.set(b.id, r);
        }
        return m;
      })(),
    ]);

    const ranked = rankBathroomsForInspection(bathrooms, verificationMap, signalsMap, sensorReadingsMap);
    const withUsage = attachUsageToBathrooms(ranked, usageCounts);

    return NextResponse.json({
      bathrooms: withUsage,
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
