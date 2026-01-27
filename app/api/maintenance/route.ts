import { NextResponse } from 'next/server';
import { getAllMaintenanceRequests, createMaintenanceRequest } from '@/lib/db';

export async function GET() {
  try {
    const requests = await getAllMaintenanceRequests();
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const request_obj = await createMaintenanceRequest(
      body.bathroomId,
      body.issueType,
      body.contactName,
      body.contactPhone
    );
    
    return NextResponse.json({ success: true, request: request_obj });
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
