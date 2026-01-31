import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAllBathrooms } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Test DB read/write with service role.
 * GET /api/db-test — if ok: true, verification and resident feedback should persist.
 */
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        ok: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY not set',
        hint: 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard → API → service_role), then restart dev server.',
      });
    }

    const bathrooms = await getAllBathrooms();
    const first = bathrooms[0];
    if (!first) {
      return NextResponse.json({
        ok: false,
        error: 'No bathrooms. Run supabase/seed.sql first.',
        hasServiceRole: true,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('bathrooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', first.id)
      .select('id, health_score, status, updated_at')
      .single();

    if (error || !data) {
      return NextResponse.json({
        ok: false,
        error: error?.message ?? 'Update returned no row',
        hasServiceRole: true,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Service role works. Verification and resident feedback will persist.',
      hasServiceRole: true,
      sampleBathroom: { id: data.id, health_score: data.health_score, status: data.status },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: message,
      hasServiceRole: !!supabaseAdmin,
    });
  }
}
