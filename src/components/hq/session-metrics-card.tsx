interface SessionMetrics {
    total_7d: number;
    total_30d: number;
    completed_count: number;
    overage_revenue: number;
    avg_per_instance: number;
}

interface SessionMetricsCardProps {
    metrics: SessionMetrics;
}

export function SessionMetricsCard({ metrics }: SessionMetricsCardProps) {
    return (
        <div className="glass-card p-6 rounded-xl border border-gray-700/50">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-100">Session Activity</h2>
                <p className="text-sm text-gray-400">MentorIA usage across all instances</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-sm text-gray-400 uppercase tracking-wide mb-1">
                        Sessions (7d)
                    </div>
                    <div className="text-2xl font-bold text-gray-100">
                        {metrics.total_7d}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-400 uppercase tracking-wide mb-1">
                        Sessions (30d)
                    </div>
                    <div className="text-2xl font-bold text-gray-100">
                        {metrics.total_30d}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-400 uppercase tracking-wide mb-1">
                        Avg/Instance
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                        {metrics.avg_per_instance.toFixed(1)}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-400 uppercase tracking-wide mb-1">
                        Overage Revenue
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                        €{(metrics.overage_revenue / 100).toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
}
