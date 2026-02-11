import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    return NextResponse.json({
        environment: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
        release_id: process.env.NEXT_PUBLIC_RELEASE_ID || 'dev',
        commit_hash: process.env.NEXT_PUBLIC_COMMIT_HASH || 'head',
        timestamp: new Date().toISOString(),
        worker_status: 'operational'
    }, { status: 200 });
}
