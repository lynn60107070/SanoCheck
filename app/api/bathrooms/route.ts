import { NextResponse } from 'next/server';
import { getAllBathrooms, recalculateAllScores } from '@/lib/db';

export async function GET(request: Request) {
  try {
    // Check if recalculation is requested via query parameter
    const url = new URL(request.url);
    const recalculate = url.searchParams.get('recalculate') === 'true';
    
    if (recalculate) {
      // Recalculate scores before returning
      await recalculateAllScores();
    }
    
    const bathrooms = await getAllBathrooms();
    return NextResponse.json(bathrooms);
  } catch (error) {
    console.error('Error fetching bathrooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bathrooms' },
      { status: 500 }
    );
  }
}
