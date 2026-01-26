import { NextResponse } from 'next/server';
import { updateMaintenanceRequest, initializeStore } from '@/lib/store';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    initializeStore();
    const body = await request.json();
    
    const updated = updateMaintenanceRequest(params.id, body);
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Maintenance request not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
