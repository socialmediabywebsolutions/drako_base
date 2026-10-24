interface Session {
    id: string;
    status: string;
    duration_minutes: number;
    cost_est_major: number;
    created_at: string;
    completed_at: string | null;
}

interface SessionsTableProps {
    sessions: Session[];
}

export function SessionsTable({ sessions }: SessionsTableProps) {
    if (sessions.length === 0) {
        return (
            <div className="glass-card p-12 rounded-xl border border-gray-700/50 text-center">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                    No Sessions Yet
                </h3>
                <p className="text-gray-400">
                    Your sessions for this billing cycle will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="glass-card rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700/50">
                <h2 className="text-xl font-semibold text-gray-100">
                    Session History
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-800/50">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Duration
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Est. Cost
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {sessions.map((session) => (
                            <tr
                                key={session.id}
                                className="hover:bg-gray-800/30 transition-colors"
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {new Date(session.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {session.duration_minutes ? `${session.duration_minutes} min` : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <SessionStatus status={session.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {session.cost_est_major ?
                                        `€${(session.cost_est_major / 100).toFixed(2)}` :
                                        '—'
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SessionStatus({ status }: { status: string }) {
    const statusConfig = {
        scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
        completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
        billed: { label: 'Billed', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
        cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled;

    return (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${config.color}`}>
            {config.label}
        </span>
    );
}
