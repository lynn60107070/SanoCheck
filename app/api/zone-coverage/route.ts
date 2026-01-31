import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBathroomsFromDbRows, computeZoneCoverageFromBathrooms } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/zone-coverage — uses request-time Supabase client (same as /api/bathrooms)
 * so zone stats reflect actual DB numbers (verified_usable counts, scores, etc.).
 */
export async function GET() {
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
    const { data: rows, error } = await supabase
      .from('bathrooms')
      .select('id, zone, type, sensor_attached, high_traffic, last_verified_at, health_score, status, location')
      .order('zone', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('[zone-coverage] select error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bathrooms: ' + error.message },
        { status: 500 }
      );
    }

    const bathrooms = getBathroomsFromDbRows(rows ?? []);
    const zones = computeZoneCoverageFromBathrooms(bathrooms);

    return NextResponse.json(zones, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[zone-coverage] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
