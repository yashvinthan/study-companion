import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    return NextResponse.json(await getDashboardData(session.user.email));
  } catch (error) {
    console.error('Dashboard route failed', error);
    return NextResponse.json(
      {
        error: 'Failed to build the dashboard.',
      },
      { status: 500 },
    );
  }
}
