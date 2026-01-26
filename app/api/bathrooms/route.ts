import { NextResponse } from 'next/server';
import { getAllBathrooms, initializeStore } from '@/lib/store';

export async function GET() {
  initializeStore();
  const bathrooms = getAllBathrooms();
  return NextResponse.json(bathrooms);
}
