// ADR-059 — hub "Kịch Bản & Hoạch Định": gộp 2 mục sidebar cũ (Trợ Lý CEO, So Sánh
// Kịch Bản) thành 1 mục + 2 sub-tab, cùng mẫu với PricingHub (ADR-034). Thuần bọc
// điều hướng — 2 màn con giữ nguyên 100% logic/props.
import { type AppRole } from '../../lib/firebase.js';
import type { ScenarioInput } from '../../schemas/scenario.js';
import CeoPlannerScreen from './CeoPlannerScreen.js';
import ScenarioCompareScreen from '../scenario-compare/ScenarioCompareScreen.js';

export type PlanningSub = 'ceo' | 'compare';

const SUBS: Array<{ id: PlanningSub; label: string; hint: string }> = [
  { id: 'ceo', label: 'Trợ Lý CEO', hint: 'kịch bản ca/biên → lợi nhuận' },
  { id: 'compare', label: 'So Sánh Kịch Bản', hint: 'kịch bản · độ nhạy (tornado)' },
];

export default function PlanningHub({
  sub,
  onSubChange,
  onNavigate,
  scenario,
  role,
  user,
}: {
  sub: PlanningSub;
  onSubChange: (sub: PlanningSub) => void;
  onNavigate?: (tab: string) => void;
  scenario: ScenarioInput | null;
  role?: AppRole;
  user?: { uid: string; email: string | null } | null;
}) {
  const active = SUBS.find((s) => s.id === sub) ?? SUBS[0]!;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '18px 36px 0' }}>
        <div style={{ display: 'flex', border: '1px solid #b3b3b3', borderRadius: 2, overflow: 'hidden' }}>
          {SUBS.map((s) => (
            <div
              key={s.id}
              onClick={() => onSubChange(s.id)}
              style={{
                padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: s.id === active.id ? '#0a0a0a' : '#fff',
                color: s.id === active.id ? '#fff' : '#1a1a1a',
                borderRight: '1px solid #d8d8d8',
              }}
            >
              {s.label}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#999' }}>{active.hint}</span>
      </div>
      {active.id === 'ceo' && <CeoPlannerScreen scenario={scenario} role={role} user={user} />}
      {active.id === 'compare' && <ScenarioCompareScreen scenario={scenario} onNavigate={onNavigate} />}
    </div>
  );
}
