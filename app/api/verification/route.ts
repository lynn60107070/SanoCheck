import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function parseBool(v: unknown, defaultVal: boolean): boolean {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return defaultVal;
}

/**
 * Verification is done entirely in this route with a client created at request time.
 * This ensures we use the current SUPABASE_SERVICE_ROLE_KEY and can read back the row we wrote.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local (Dashboard → API → service_role), then restart the dev server.',
      },
      { status: 503 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await request.json();
    const bathroomId = String(body.bathroomId || '').trim();
    if (!bathroomId) {
      return NextResponse.json({ error: 'Missing bathroomId' }, { status: 400 });
    }

    const waterAvailable = parseBool(body.waterAvailable, true);
    const clogged = parseBool(body.clogged, false);
    const usable = parseBool(body.usable, true) && waterAvailable;
    const now = new Date().toISOString();

    // 1. Insert verification (audit)
    const { error: insertErr } = await supabase.from('verifications').insert({
      bathroom_id: bathroomId,
      volunteer_id: body.volunteerName || null,
      water_available: waterAvailable,
      clogged,
      usable,
      created_at: now,
    });
    if (insertErr) {
      console.error('[verification] insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to save verification: ' + insertErr.message }, { status: 500 });
    }

    // 2. Update bathroom: score 3 + verified_usable, or 0 + verified_unusable
    const isUnusable = !usable;
    const health_score = isUnusable ? 0 : 3;
    const status = isUnusable ? 'verified_unusable' : 'verified_usable';

    const { data: updated, error: updateErr } = await supabase
      .from('bathrooms')
      .update({
        health_score,
        status,
        last_verified_at: now,
        updated_at: now,
      })
      .eq('id', bathroomId)
      .select('id, health_score, status')
      .single();

    if (updateErr) {
      console.error('[verification] update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update bathroom: ' + updateErr.message }, { status: 500 });
    }
    if (!updated) {
      console.error('[verification] update returned no row for id=', bathroomId);
      return NextResponse.json({ error: 'Update affected 0 rows. Check bathroom id and RLS.' }, { status: 500 });
    }

    // 3. Read back the row from DB to confirm persistence (same client, same request)
    const { data: readBack, error: readErr } = await supabase
      .from('bathrooms')
      .select('id, health_score, status')
      .eq('id', bathroomId)
      .single();

    if (readErr || !readBack) {
      console.error('[verification] read-back failed:', readErr);
    } else {
      console.log('[verification] persisted:', bathroomId, 'score=', readBack.health_score, 'status=', readBack.status);
    }

    const bathroom = {
      id: updated.id,
      score: Number(updated.health_score),
      status: (updated.status || '').trim(),
    };

    return NextResponse.json({
      success: true,
      bathroom,
      persisted: readBack ? { score: readBack.health_score, status: readBack.status } : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[verification] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
