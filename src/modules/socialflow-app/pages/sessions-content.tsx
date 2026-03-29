'use client';

import { useEffect, useState } from 'react';
import { UsageCard } from '@/components/mentoria/usage-card';
import { SessionsTable } from '@/components/mentoria/sessions-table';

interface Session {
  id: string;
  status: string;
  duration_minutes: number;
  cost_est_major: number;
  created_at: string;
  completed_at: string | null;
}

interface CycleInfo {
  start: string;
  end: string;
  included_limit: number;
  used_count: number;
  overage_count: number;
}

type SessionsResponse = {
  sessions?: Session[];
  cycle?: CycleInfo | null;
};

export function SessionsContent() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/mentoria/sessions');

        if (!res.ok) {
          throw new Error('Failed to fetch sessions');
        }

        const data = await res.json() as SessionsResponse;
        setSessions(data.sessions || []);
        setCycle(data.cycle ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-800 rounded-lg"></div>
        <div className="h-64 bg-gray-800 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error loading sessions: {error}</p>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
        <p className="text-yellow-400">No billing cycle configured for your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UsageCard
        includedLimit={cycle.included_limit}
        usedCount={cycle.used_count}
        overageCount={cycle.overage_count}
        cycleStart={cycle.start}
        cycleEnd={cycle.end}
      />
      <SessionsTable sessions={sessions} />
    </div>
  );
}
