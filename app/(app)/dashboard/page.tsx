export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Feed</h1>
        <p className="text-gray-500 text-sm mt-1">
          Announcements, updates, and highlights from your team.
        </p>
      </div>
      <div className="card p-12 flex flex-col items-center text-center gap-3">
        <div className="text-4xl">🎾</div>
        <h2 className="font-semibold text-gray-900">No announcements yet</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Posts from your coaches and teammates will appear here.
        </p>
      </div>
    </div>
  );
}
