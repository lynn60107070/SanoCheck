import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy to fetch ESP32 /live from server (use when browser cannot reach device, e.g. CORS).
 * Only works when Next.js runs on same network as ESP32 (e.g. local dev).
 * Query: ?url=http://192.168.4.1/live
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Missing or invalid url (e.g. http://192.168.4.1/live)' }, { status: 400 });
    }
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Device returned ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error('[live-sensor/poll]', error);
    return NextResponse.json(
      { error: 'Could not reach device. Is it on the same network? Is the URL correct?' },
      { status: 502 }
    );
  }
}
