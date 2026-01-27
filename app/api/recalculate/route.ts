import { NextResponse } from 'next/server';
import { recalculateAllScores } from '@/lib/db';

export async function POST() {
  try {
    await recalculateAllScores();
    return NextResponse.json({ success: true, message: 'Scores recalculated successfully' });
  } catch (error) {
    console.error('Error recalculating scores:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate scores' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await recalculateAllScores();
    return NextResponse.json({ success: true, message: 'Scores recalculated successfully' });
  } catch (error) {
    console.error('Error recalculating scores:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate scores' },
      { status: 500 }
    );
  }
}
