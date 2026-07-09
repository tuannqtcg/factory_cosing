// M12.5 — khung app (sidebar + tab) đúng prototype Pha 1 đã duyệt: brand,
// khối "Xem Như Vai" (= đăng nhập user demo theo claim, xem lib/firebase.ts),
// nav USER/ADMIN lọc theo ROLE_TAB_ACCESS (ADR-006), badge VAI dưới cùng.
// Mới có tab `dashboard` (M12.5) — tab khác hiện placeholder trỏ milestone.
import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useScenarioData } from '../dashboard/useScenarioData.js';
import Dashboard from '../dashboard/Dashboard.js';
import PriceList from '../price-list/PriceList.js';
import PlanScreen from '../plan/PlanScreen.js';
import { usePlanData } from '../plan/usePlanData.js';
import TargetCosting from '../target-costing/TargetCosting.js';
import ConfigScreen from '../config/ConfigScreen.js';
import ProductionReport from '../production-report/ProductionReport.js';
import InventoryScreen from '../inventory/InventoryScreen.js';
import AssumptionsScreen from '../assumptions/AssumptionsScreen.js';
import type { AppRole } from '../../lib/firebase.js';

const SCENARIO_ID = 'baseline-v3.4';

const ROLE_TAB_ACCESS: Record<AppRole, string[]> = {
  // M12.9b: `config` mở cho pricing (resource.md — pricing sửa field KHÔNG
  // khóa như số ca/ngày vận hành/lương/điện nước; field khóa disable trong form).
  pricing: ['dashboard', 'pricelist', 'targetcosting', 'config', 'inventory', 'assumptions', 'ong', 'pk'],
  sales: ['dashboard', 'pricelist'],
  production: ['plan'],
  admin: ['dashboard', 'pricelist', 'plan', 'targetcosting', 'inventory', 'config', 'assumptions', 'ong', 'pk'],
};
const USER_TABS = [
  { id: 'dashboard', label: 'Tổng Quan' },
  { id: 'pricelist', label: 'Bảng Giá' },
  { id: 'plan', label: 'Kế Hoạch SX' },
  { id: 'targetcosting', label: 'Định Giá Ngược' },
];
const ADMIN_TABS = [
  { id: 'inventory', label: 'Tồn Kho Compound' },
  { id: 'config', label: 'Cấu Hình Nhà Máy' },
  { id: 'assumptions', label: 'Tham Số' },
  { id: 'ong', label: 'Ống CPVC' },
  { id: 'pk', label: 'Phụ Kiện' },
];
const ROLE_DEFS: Array<{ id: AppRole; label: string; desc: string }> = [
  { id: 'pricing', label: 'Quản Lý — Định Giá', desc: 'Thang giá · top-down · tồn kho · giả định' },
  { id: 'sales', label: 'Bán Hàng', desc: 'Chỉ thang giá + bảng giá' },
  { id: 'production', label: 'Sản Xuất', desc: 'Chỉ kế hoạch SX' },
  { id: 'admin', label: 'Toàn Quyền', desc: 'Tất cả màn hình + cấu hình nhà máy' },
];
/** Kỳ kế hoạch mặc định của màn Kế Hoạch SX (đổi kỳ ngay trong form). */
const DEFAULT_PLAN_PERIOD = '2026-Q3';


export default function AppShell() {
  const authState = useAuth();
  const [rawActiveTab, setActiveTab] = useState('dashboard');
  const [authError, setAuthError] = useState<string | null>(null);

  const role = authState.role;
  const allowedTabs = role ? ROLE_TAB_ACCESS[role] : [];
  const activeTab = allowedTabs.includes(rawActiveTab) ? rawActiveTab : (allowedTabs[0] ?? 'dashboard');

  const data = useScenarioData(SCENARIO_ID, role);
  const planData = usePlanData(SCENARIO_ID, DEFAULT_PLAN_PERIOD, role);

  const userTabs = USER_TABS.filter((t) => allowedTabs.includes(t.id));
  const adminTabs = ADMIN_TABS.filter((t) => allowedTabs.includes(t.id));

  const navItem = (t: { id: string; label: string }) => {
    const active = t.id === activeTab;
    return (
      <div
        key={t.id}
        onClick={() => setActiveTab(t.id)}
        style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: active ? '#a8003b' : 'transparent', borderLeft: `3px solid ${active ? '#a8003b' : 'transparent'}` }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#fff' : '#555', flexShrink: 0 }} />
        <span style={{ color: active ? '#fff' : '#b3b3b3', fontSize: 12, fontWeight: active ? 600 : 400 }}>{t.label}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Roboto,Helvetica Neue,sans-serif', color: '#1a1a1a', background: '#ebe6d4' }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: 216, background: '#1a1a1a', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ color: '#a8003b', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>BlazeMaster CPVC</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '-.2px' }}>Costing Engine</div>
          <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>Model v3.7 · VN · 2026</div>
        </div>

        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginBottom: 7 }}>Xem Như Vai</div>
          {ROLE_DEFS.map((r) => {
            const active = r.id === role;
            return (
              <div
                key={r.id}
                onClick={() => {
                  setAuthError(null);
                  void authState.switchRole(r.id).then(setAuthError);
                }}
                style={{ padding: '6px 10px', marginBottom: 3, borderRadius: 2, cursor: 'pointer', background: active ? '#a8003b' : 'transparent', border: `1px solid ${active ? '#a8003b' : 'rgba(255,255,255,.14)'}` }}
              >
                <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? '#fff' : '#d4d4d4' }}>{r.label}</div>
                <div style={{ fontSize: 8, color: '#8a8a8a', marginTop: 1 }}>{r.desc}</div>
              </div>
            );
          })}
          {authError && <div style={{ fontSize: 9, color: '#f87171', marginTop: 5 }}>{authError}</div>}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {userTabs.length > 0 && (
            <>
              <div style={{ padding: '10px 16px 4px', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginTop: 4 }}>USER</div>
              {userTabs.map(navItem)}
            </>
          )}
          {adminTabs.length > 0 && (
            <>
              <div style={{ padding: '10px 16px 4px', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>ADMIN</div>
              {adminTabs.map(navItem)}
            </>
          )}
        </nav>

        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'inline-block', background: '#a8003b', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 2, letterSpacing: '.06em', marginBottom: 5 }}>
            VAI: {role ? ROLE_DEFS.find((r) => r.id === role)?.label.toUpperCase() : 'CHƯA ĐĂNG NHẬP'}
          </div>
          <div style={{ color: '#444', fontSize: 9 }}>BlazeMaster_Model_v3_7.xlsx</div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main style={{ flex: 1, overflow: 'auto', background: '#ebe6d4', minWidth: 0 }}>
        {authState.status === 'loading' && <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang kiểm tra đăng nhập…</div>}
        {authState.status === 'signed-out' && (
          <div style={{ padding: '32px 36px' }}>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Chọn vai để bắt đầu</h1>
            <p style={{ fontSize: 12, color: '#737373', maxWidth: 480 }}>
              Chọn 1 vai ở khối "Xem Như Vai" bên trái — app đăng nhập bằng user demo tương ứng trên Auth Emulator (chạy{' '}
              <code>npm run emulators</code> rồi <code>npm run seed:emulator</code> trước).
            </p>
          </div>
        )}
        {authState.status === 'signed-in' && role && (
          <>
            {data.error && (
              <div style={{ margin: '16px 36px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #DC2626', borderRadius: 2, fontSize: 11, color: '#DC2626' }}>{data.error}</div>
            )}
            {activeTab === 'dashboard' && (
              <Dashboard role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} salesPriceLadder={data.priceList?.priceLadder ?? null} />
            )}
            {activeTab === 'pricelist' && <PriceList priceList={data.priceList} />}
            {activeTab === 'targetcosting' && (
              <TargetCosting role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />
            )}
            {activeTab === 'config' && <ConfigScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
            {activeTab === 'inventory' && <InventoryScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />}
            {activeTab === 'assumptions' && <AssumptionsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />}
            {activeTab === 'ong' && <ProductionReport role={role} line="pipe" scenario={data.scenario} internal={data.internal} />}
            {activeTab === 'pk' && <ProductionReport role={role} line="fitting" scenario={data.scenario} internal={data.internal} />}
            {activeTab === 'plan' && (
              <>
                {planData.error && (
                  <div style={{ margin: '16px 36px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #DC2626', borderRadius: 2, fontSize: 11, color: '#DC2626' }}>{planData.error}</div>
                )}
                <PlanScreen
                  catalog={planData.catalog}
                  planResult={planData.planResult}
                  savedInput={planData.savedInput}
                  scenarioId={SCENARIO_ID}
                  onSave={planData.savePlanInput}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
