interface UsageCardProps {
    includedLimit: number;
    usedCount: number;
    overageCount: number;
    cycleStart: string;
    cycleEnd: string;
}

export function UsageCard({
    includedLimit,
    usedCount,
    overageCount,
    cycleStart,
    cycleEnd
}: UsageCardProps) {
    const usagePercent = Math.min(100, (usedCount / includedLimit) * 100);
    const isNearLimit = usagePercent >= 80;
    const hasOverage = overageCount > 0;

    return (
        <div className="glass-card p-6 rounded-xl border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-100">
                    Usage This Cycle
                </h2>
                <span className="text-sm text-gray-400">
                    {cycleStart} → {cycleEnd}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-300">
                        {usedCount} / {includedLimit} sessions
                    </span>
                    <span className={`font-medium ${hasOverage ? 'text-red-400' :
                            isNearLimit ? 'text-yellow-400' :
                                'text-green-400'
                        }`}>
                        {usagePercent.toFixed(0)}%
                    </span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${hasOverage ? 'bg-red-500' :
                                isNearLimit ? 'bg-yellow-500' :
                                    'bg-green-500'
                            }`}
                        style={{ width: `${Math.min(100, usagePercent)}%` }}
                    />
                </div>
            </div>

            {/* Overage Warning */}
            {hasOverage && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mt-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h3 className="font-semibold text-red-300 mb-1">
                                Overage Detected
                            </h3>
                            <p className="text-sm text-red-200">
                                You have used <strong>{overageCount}</strong> extra session(s) beyond your included limit.
                                These will be billed at the end of the cycle.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Near Limit Warning */}
            {isNearLimit && !hasOverage && (
                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mt-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">💡</span>
                        <div>
                            <h3 className="font-semibold text-yellow-300 mb-1">
                                Approaching Limit
                            </h3>
                            <p className="text-sm text-yellow-200">
                                You&apos;re at {usagePercent.toFixed(0)}% of your included sessions.
                                Additional sessions will incur overage charges.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
