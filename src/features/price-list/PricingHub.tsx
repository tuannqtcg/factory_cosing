// ADR-034 — hub "Bảng Giá": gộp 3 tab menu cũ (Bảng Giá VF / Bảng Giá NPP /
// Phân Tích Định Giá) thành MỘT mục sidebar với sub-tab, vì cả 3 là 3 góc nhìn
// của cùng một bảng giá (VF là gốc, NPP dẫn xuất, Phân tích là soi sâu thang
// giá). Thuần trình bày — 3 màn con giữ nguyên, chỉ bọc điều hướng.
import PriceList from './PriceList.js';
import DistributorPriceList from './DistributorPriceList.js';
import PricingAnalyticsScreen from '../pricing-analytics/PricingAnalyticsScreen.js';
import type { AppRole } from '../../lib/firebase.js';
import type { PriceListDoc, ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';

export type PricingSub = 'vf' | 'npp' | 'analytics';

const SUBS: Array<{ id: PricingSub; label: string; hint: string }> = [
  { id: 'vf', label: 'Giá VF (chốt ở đây)', hint: 'giá xuất xưởng — tầng CEO quyết' },
  { id: 'npp', label: 'Bảng giá NPP', hint: 'niêm yết dẫn xuất từ VF, chỉ đọc' },
  { id: 'analytics', label: 'Phân tích', hint: 'soi thang giá của giá đang chốt' },
];

export default function PricingHub({
  sub,
  onSubChange,
  onNavigate,
  role,
  scenarioId,
  priceList,
  scenario,
  internal,
}: {
  sub: PricingSub;
  onSubChange: (sub: PricingSub) => void;
  onNavigate: (tab: string) => void;
  role: AppRole;
  scenarioId: string;
  priceList: PriceListDoc | null;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
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
                padding: '7px 16px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
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
      {active.id === 'vf' && (
        <PriceList priceList={priceList} scenario={scenario} internal={internal} onNavigate={onNavigate} />
      )}
      {active.id === 'npp' && <DistributorPriceList priceList={priceList} />}
      {active.id === 'analytics' && (
        <PricingAnalyticsScreen role={role} scenarioId={scenarioId} scenario={scenario} internal={internal} />
      )}
    </div>
  );
}
