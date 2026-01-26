import { NextResponse } from 'next/server';
import { getAllMaintenanceRequests, createMaintenanceRequest, initializeStore } from '@/lib/store';

export async function GET() {
  initializeStore();
  const requests = getAllMaintenanceRequests();
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  try {
    initializeStore();
    const body = await request.json();
    
    const request_obj = createMaintenanceRequest(
      body.bathroomId,
      body.issueType,
      body.contactName,
      body.contactPhone
    );
    
    return NextResponse.json({ success: true, request: request_obj });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
