// M12.2 — scaffold frontend thật (chưa có màn hình nào, xem docs/M12_PLAN.md
// M12.5+). Trang này CHỈ xác nhận pipeline Vite+React+Tailwind chạy được —
// KHÔNG phải mockup dữ liệu giả (đó là prototype/blazemaster-costing-app.dc.html,
// Pha 1, đã duyệt UI/UX làm nguồn tham chiếu khi build màn hình thật).
const MILESTONES: Array<{ id: string; label: string; done: boolean }> = [
  { id: 'M12.1', label: 'Orchestrator calculateScenario()', done: true },
  { id: 'M12.2', label: 'Scaffold Vite + React + Tailwind + Recharts', done: true },
  { id: 'M12.3', label: 'Firebase Emulator Suite + Security Rules', done: false },
  { id: 'M12.4', label: 'Cloud Function tính ScenarioOutput', done: false },
  { id: 'M12.5', label: 'Màn hình Dashboard', done: false },
  { id: 'M12.6', label: 'Màn hình Bảng Giá', done: false },
  { id: 'M12.7', label: 'Màn hình Kế Hoạch SX', done: false },
  { id: 'M12.8', label: 'Màn hình Target Costing', done: false },
  { id: 'M12.9', label: 'Màn hình Tồn kho + Giả định + Cấu hình', done: false },
  { id: 'M12.10', label: 'Security review + merge', done: false },
];

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Costing App — BlazeMaster CPVC</p>
        <h1 className="mt-1 text-2xl font-bold">Pha 3, M12 — đang dựng UI thật</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Scaffold (Vite + React 18 + TS strict + Tailwind + Recharts) đã chạy được. Màn hình thật (Dashboard, Bảng Giá,
          Kế Hoạch SX, Target Costing...) chưa nối — xem <code className="rounded bg-neutral-200 px-1 py-0.5">docs/M12_PLAN.md</code>.
        </p>

        <ol className="mt-8 space-y-2">
          {MILESTONES.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
              <span
                className={
                  'flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ' +
                  (m.done ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-500')
                }
              >
                {m.done ? '✓' : ''}
              </span>
              <span className="text-xs font-mono text-neutral-400">{m.id}</span>
              <span className={'text-sm ' + (m.done ? 'text-neutral-900' : 'text-neutral-500')}>{m.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
