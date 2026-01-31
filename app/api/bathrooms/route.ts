import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recalculateAllScores } from '@/lib/db';

export const dynamic = 'force-dynamic';

type BathroomStatus = 'verified_usable' | 'flagged' | 'verified_unusable';

function parseTimestamp(v: string | null): number | null {
  if (!v) return null;
  const s = String(v).trim().replace(' ', 'T');
  return new Date(s).getTime();
}

function rowToBathroom(row: {
  id: string;
  zone: string;
  type: string;
  sensor_attached: boolean;
  high_traffic?: boolean;
  last_verified_at: string | null;
  health_score: number;
  status: string;
  location?: string;
}) {
  const score = Math.min(3, Math.max(0, Math.round(Number(row.health_score))));
  const status = (row.status || '').trim();
  const validStatus: BathroomStatus[] = ['verified_usable', 'flagged', 'verified_unusable'];
  const statusOut = validStatus.includes(status as BathroomStatus)
    ? (status as BathroomStatus)
    : (score >= 2 ? 'verified_usable' : 'flagged');
  return {
    id: row.id,
    zone: row.zone,
    type: row.type,
    hasSensor: !!row.sensor_attached,
    high_traffic: !!row.high_traffic,
    lastVerifiedAt: parseTimestamp(row.last_verified_at),
    score,
    status: statusOut,
    location: row.location,
  };
}

/**
 * GET /api/bathrooms — read bathrooms with a client created at request time
 * so we use the current SUPABASE_SERVICE_ROLE_KEY and see the latest data.
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local (Dashboard → API → service_role), then restart.',
      },
      { status: 503 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (new URL(request.url).searchParams.get('recalculate') === 'true') {
      try {
        await recalculateAllScores();
      } catch (e) {
        console.error('[bathrooms] recalc error:', e);
      }
    }

    const { data: rows, error } = await supabase
      .from('bathrooms')
      .select('id, zone, type, sensor_attached, high_traffic, last_verified_at, health_score, status, location')
      .order('zone', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('[bathrooms] select error:', error);
      return NextResponse.json({ error: 'Failed to fetch bathrooms: ' + error.message }, { status: 500 });
    }

    const bathrooms = (rows || []).map(rowToBathroom);
    return NextResponse.json(bathrooms, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Data-Source': 'database',
        'X-Server-Time': String(Date.now()),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[bathrooms] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
