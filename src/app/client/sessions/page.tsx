import { Suspense } from 'react';
import { SessionsContent } from './sessions-content';

export default function ClientSessionsPage() {
    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">My Sessions</h1>

            <Suspense fallback={
                <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-gray-800 rounded-lg"></div>
                    <div className="h-64 bg-gray-800 rounded-lg"></div>
                </div>
            }>
                <SessionsContent />
            </Suspense>
        </div>
    );
}
