// ADR-020 — một view CEO duy nhất: bỏ role switcher + lọc tab theo vai. Shell
// tự đăng nhập vai `admin` (toàn quyền) và truyền cố định role='admin' xuống mọi
// màn, nên canEdit/canSeeCostDetail tự bật hết. Backend theo vai (rules, custom
// claim, ADR-006/017) giữ nguyên — chỉ gộp trải nghiệm client. Điều hướng chia 2
// nhóm theo mục đích: ĐIỀU HÀNH (xem) và CẤU HÌNH & DỮ LIỆU (vào chi tiết sửa).
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useScenarioData } from '../dashboard/useScenarioData.js';
import Dashboard from '../dashboard/Dashboard.js';
import PriceList from '../price-list/PriceList.js';
import PlanScreen from '../plan/PlanScreen.js';
import { usePlanData } from '../plan/usePlanData.js';
import PricingAnalyticsScreen from '../pricing-analytics/PricingAnalyticsScreen.js';
import ConfigScreen from '../config/ConfigScreen.js';
import ProductionReport from '../production-report/ProductionReport.js';
import InventoryScreen from '../inventory/InventoryScreen.js';
import AssumptionsScreen from '../assumptions/AssumptionsScreen.js';
import ProductsScreen from '../products/ProductsScreen.js';
import CeoPlannerScreen from '../ceo-planner/CeoPlannerScreen.js';

const SCENARIO_ID = 'baseline-v3.4';
/** ADR-020: mọi màn chạy ở góc nhìn CEO = toàn quyền. */
const CEO_ROLE = 'admin' as const;

// Điều hướng chia theo MỤC ĐÍCH, không theo quyền (ADR-020).
const OPERATION_TABS = [
  { id: 'dashboard', label: 'Tổng Quan' },
  { id: 'ceo-planner', label: 'Trợ Lý CEO' },
  { id: 'pricelist', label: 'Bảng Giá' },
  { id: 'plan', label: 'Kế Hoạch SX' },
  { id: 'pricing-analytics', label: 'Phân Tích Định Giá' },
];
const CONFIG_TABS = [
  { id: 'inventory', label: 'Tồn Kho Compound' },
  { id: 'products', label: 'Danh Mục Sản Phẩm' },
  { id: 'config', label: 'Cấu Hình Nhà Máy' },
  { id: 'assumptions', label: 'Tham Số' },
  { id: 'ong', label: 'Ống CPVC' },
  { id: 'pk', label: 'Phụ Kiện' },
];
/** Kỳ kế hoạch mặc định của màn Kế Hoạch SX (đổi kỳ ngay trong form). */
const DEFAULT_PLAN_PERIOD = '2026-Q3';


export default function AppShell() {
  const authState = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authError, setAuthError] = useState<string | null>(null);

  const role = authState.role;

  // ADR-020: tự đăng nhập vai CEO/admin — không bắt người dùng chọn vai.
  useEffect(() => {
    if (authState.status === 'signed-out') {
      setAuthError(null);
      void authState.switchRole(CEO_ROLE).then(setAuthError);
    }
  }, [authState.status]);

  const data = useScenarioData(SCENARIO_ID, role);
  const planData = usePlanData(SCENARIO_ID, DEFAULT_PLAN_PERIOD, role);

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

        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          <div style={{ padding: '10px 16px 4px', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginTop: 4 }}>Điều Hành</div>
          {OPERATION_TABS.map(navItem)}
          <div style={{ padding: '10px 16px 4px', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>Cấu Hình & Dữ Liệu</div>
          {CONFIG_TABS.map(navItem)}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '12px 16px' }}>
          <div style={{ display: 'inline-block', background: '#a8003b', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 2, letterSpacing: '.06em', marginBottom: 3 }}>
            GÓC NHÌN: ĐIỀU HÀNH (CEO)
          </div>
          <div style={{ color: '#666', fontSize: 9 }}>{authState.user?.email ?? 'Toàn quyền · xem & sửa'}</div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main style={{ flex: 1, overflow: 'auto', background: '#ebe6d4', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1366, background: '#ebe6d4', minHeight: '100%' }}>
        {(authState.status === 'loading' || authState.status === 'signed-out') && (
          <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>
            Đang mở Bảng điều khiển…
            {authError && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: '#DC2626', marginBottom: 8 }}>{authError}</div>
                <button
                  onClick={() => { setAuthError(null); void authState.switchRole(CEO_ROLE).then(setAuthError); }}
                  style={{ padding: '8px 16px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                  Thử lại
                </button>
              </div>
            )}
          </div>
        )}
        {authState.status === 'signed-in' && role && (
          <>
            {data.error && (
              <div style={{ margin: '16px 36px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #DC2626', borderRadius: 2, fontSize: 11, color: '#DC2626' }}>{data.error}</div>
            )}
            {activeTab === 'dashboard' && (
              <Dashboard
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
                scenarioId={SCENARIO_ID}
                scenario={data.scenario}
                internal={data.internal}
                salesPriceLadder={data.priceList?.priceLadder ?? null}
              />
            )}
            {activeTab === 'ceo-planner' && <CeoPlannerScreen scenario={data.scenario} />}
            {activeTab === 'pricelist' && <PriceList priceList={data.priceList} />}
            {activeTab === 'pricing-analytics' && (
              <PricingAnalyticsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />
            )}
            {activeTab === 'config' && <ConfigScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
            {activeTab === 'inventory' && <InventoryScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />}
            {activeTab === 'assumptions' && (
              <AssumptionsScreen
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
                scenarioId={SCENARIO_ID}
                scenario={data.scenario}
                internal={data.internal}
              />
            )}
            {activeTab === 'products' && <ProductsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
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
        </div>
      </main>
    </div>
  );
}
