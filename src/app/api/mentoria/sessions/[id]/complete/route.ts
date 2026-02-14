
import { NextResponse } from 'next/server';
import { getDracoDbFromRequestContext } from '@/lib/db';
import { MentorSessionEngine } from '@/lib/mentoria/session-engine';

// export const runtime = 'edge'; // OpenNext: disabled for Cloudflare Pages compat

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const db = getDracoDbFromRequestContext();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });


    try {
        const { id } = await params;
        const body = await req.json();
        const { duration, tokens } = body as any;

        const engine = new MentorSessionEngine(db);
        await engine.completeSession(id, duration, tokens);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
