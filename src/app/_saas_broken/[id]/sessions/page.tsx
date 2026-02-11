
import { SessionsTable } from '@/components/mentoria/sessions-table';

export default function MentorSessionsPage({ params }: { params: { id: string } }) {
    // In a real app we'd validate params.id resolves to a mentoria instance
    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">MentorIA Session Engine</h1>
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                <SessionsTable />
            </div>
        </div>
    );
}
