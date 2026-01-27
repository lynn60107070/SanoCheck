import { NextResponse } from 'next/server';
import { updateMaintenanceRequest } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const updated = await updateMaintenanceRequest(params.id, body);
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Maintenance request not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Error updating maintenance request:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
