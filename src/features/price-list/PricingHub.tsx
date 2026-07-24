// ADR-034 — hub "Bảng Giá": gộp 3 tab menu cũ (Bảng Giá VF / Bảng Giá NPP /
// Phân Tích Định Giá) thành MỘT mục sidebar với sub-tab, vì cả 3 là 3 góc nhìn
// của cùng một bảng giá (VF là gốc, NPP dẫn xuất, Phân tích là soi sâu thang
// giá). Thuần trình bày — 3 màn con giữ nguyên, chỉ bọc điều hướng.
// ADR-033 roll-out: sub-tab dùng primitive Segmented thay vì tự dựng.
import PriceList from './PriceList.js';
import DistributorPriceList from './DistributorPriceList.js';
import type { PriceListDoc, ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { Segmented, tk, ft } from '../../design/primitives.js';

export type PricingSub = 'vf' | 'npp';

const SUBS: Array<{ id: PricingSub; label: string; hint: string }> = [
  { id: 'vf', label: 'Giá VF (chốt ở đây)', hint: 'giá xuất xưởng — tầng CEO quyết' },
  { id: 'npp', label: 'Bảng giá NPP', hint: 'niêm yết dẫn xuất từ VF, chỉ đọc' },
];

export default function PricingHub({
  sub,
  onSubChange,
  onNavigate,
  priceList,
  scenario,
  internal,
}: {
  sub: PricingSub;
  onSubChange: (sub: PricingSub) => void;
  onNavigate: (tab: string) => void;
  priceList: PriceListDoc | null;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
}) {
  const active = SUBS.find((s) => s.id === sub) ?? SUBS[0]!;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '18px 36px 0' }}>
        <Segmented options={SUBS.map((s) => ({ id: s.id, label: s.label }))} value={active.id} onChange={onSubChange} />
        <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>{active.hint}</span>
      </div>
      {active.id === 'vf' && (
        <PriceList priceList={priceList} scenario={scenario} internal={internal} onNavigate={onNavigate} />
      )}
      {active.id === 'npp' && <DistributorPriceList priceList={priceList} />}
    </div>
  );
}
