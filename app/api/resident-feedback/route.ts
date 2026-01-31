import { NextResponse } from 'next/server';
import { applyResidentBadFeedback } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bathroomId, feedback } = body;
    if (!bathroomId || typeof bathroomId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid bathroomId' }, { status: 400 });
    }
    if (feedback !== 'good' && feedback !== 'bad') {
      return NextResponse.json({ error: 'feedback must be "good" or "bad"' }, { status: 400 });
    }
    if (feedback === 'good') {
      return NextResponse.json({ ok: true, message: 'Thanks!' });
    }
    const result = await applyResidentBadFeedback(bathroomId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to apply feedback' }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: "Thanks. We've flagged this bathroom for volunteer check.",
    });
  } catch (error) {
    console.error('[resident-feedback]', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
