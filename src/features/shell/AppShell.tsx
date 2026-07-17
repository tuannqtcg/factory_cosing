// ADR-020 + ADR-023 + ADR-026 — MỘT view CEO duy nhất, đăng nhập production thật.
// Người dùng đăng nhập bằng email/mật khẩu (LoginScreen); cổng vào = admin/pricing
// (ADR-006). App này CHỈ phục vụ QUYẾT ĐỊNH của CEO: nhìn nhiều góc độ → điều chỉnh
// tham số → xem thay đổi → quyết định. ADR-026 đã bỏ các tab vận hành của vai khác
// (Kế Hoạch SX của production; báo cáo dây chuyền Ống/PK; nhập Tồn Kho; Danh Mục SP)
// cho đỡ rối. Điều hướng chia 2 nhóm: PHÂN TÍCH & QUYẾT ĐỊNH và ĐIỀU CHỈNH.
import { useState } from 'react';
import { isEmulatorMode } from '../../lib/firebase.js';
import { useAuth } from '../auth/useAuth.js';
import LoginScreen from '../auth/LoginScreen.js';
import { useScenarioData } from '../dashboard/useScenarioData.js';
import Dashboard from '../dashboard/Dashboard.js';
import PriceList from '../price-list/PriceList.js';
import DistributorPriceList from '../price-list/DistributorPriceList.js';
import PricingAnalyticsScreen from '../pricing-analytics/PricingAnalyticsScreen.js';
import ConfigScreen from '../config/ConfigScreen.js';
import AssumptionsScreen from '../assumptions/AssumptionsScreen.js';
import CeoPlannerScreen from '../ceo-planner/CeoPlannerScreen.js';
import LotCostingScreen from '../lot-costing/LotCostingScreen.js';
import SensitivityScreen from '../sensitivity/SensitivityScreen.js';
import ScenarioCompareScreen from '../scenario-compare/ScenarioCompareScreen.js';
import OrderAcceptanceScreen from '../order-acceptance/OrderAcceptanceScreen.js';
import ProductMixScreen from '../product-mix/ProductMixScreen.js';

const SCENARIO_ID = 'baseline-v3.4';

// Điều hướng chia theo MỤC ĐÍCH (ADR-020/026), không theo quyền.
const OPERATION_TABS = [
  { id: 'dashboard', label: 'Tổng Quan' },
  { id: 'ceo-planner', label: 'Trợ Lý CEO' },
  { id: 'sensitivity', label: 'Độ Nhạy' },
  { id: 'scenario-compare', label: 'So Sánh Kịch Bản' },
  { id: 'order-acceptance', label: 'Quyết Định Nhận Đơn' },
  { id: 'product-mix', label: 'Tối Ưu Product-mix' },
  { id: 'lot-costing', label: 'Giá Vốn Theo Lô' },
  { id: 'pricelist', label: 'Bảng Giá (VF)' },
  { id: 'distributor-pricelist', label: 'Bảng Giá NPP' },
  { id: 'pricing-analytics', label: 'Phân Tích Định Giá' },
];
const CONFIG_TABS = [
  { id: 'assumptions', label: 'Tham Số' },
  { id: 'config', label: 'Cấu Hình Nhà Máy' },
];


export default function AppShell() {
  const authState = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const role = authState.role;
  // ADR-023: cổng vào view CEO = tầng chiến lược (admin/pricing, ADR-006).
  const hasAccess = role === 'admin' || role === 'pricing';

  const data = useScenarioData(SCENARIO_ID, role);

  const navItem = (t: { id: string; label: string }) => {
    const active = t.id === activeTab;
    return (
      <div
        key={t.id}
        onClick={() => setActiveTab(t.id)}
        style={{ padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: active ? '#2f6bff' : 'transparent', borderLeft: `3px solid ${active ? '#2f6bff' : 'transparent'}` }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#fff' : '#555', flexShrink: 0 }} />
        <span style={{ color: active ? '#fff' : '#b3b3b3', fontSize: 12, fontWeight: active ? 600 : 400 }}>{t.label}</span>
      </div>
    );
  };

  // ── Trạng thái auth (ADR-023): loading → login → chặn vai → view CEO ──────
  if (authState.status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', fontSize: 12, color: '#737373', fontFamily: 'Roboto,sans-serif' }}>Đang kiểm tra đăng nhập…</div>;
  }
  if (authState.status === 'signed-out') {
    return <LoginScreen onSignIn={authState.signIn} onDemoLogin={authState.switchRole} isEmulator={isEmulatorMode} />;
  }
  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', fontFamily: 'Roboto,sans-serif' }}>
        <div style={{ width: 360, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Không có quyền truy cập</div>
          <div style={{ fontSize: 12, color: '#737373', marginBottom: 18 }}>
            Tài khoản <b>{authState.user?.email}</b> {role ? `(vai ${role})` : '(chưa được cấp vai)'} không có quyền vào bảng điều khiển quản trị. Liên hệ quản trị viên để được cấp quyền.
          </div>
          <button onClick={() => void authState.signOut()} style={{ padding: '9px 18px', background: '#2f6bff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Đăng xuất</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Roboto,Helvetica Neue,sans-serif', color: '#10131a', background: '#f4f5f7' }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: 216, background: '#10131a', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ color: '#2f6bff', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>BlazeMaster CPVC</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '-.2px' }}>Costing Engine</div>
          <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>Model v3.7 · VN · 2026</div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          <div style={{ padding: '10px 16px 4px', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginTop: 4 }}>Phân Tích & Quyết Định</div>
          {OPERATION_TABS.map(navItem)}
          <div style={{ padding: '10px 16px 4px', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 700, marginTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>Điều Chỉnh Tham Số</div>
          {CONFIG_TABS.map(navItem)}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '12px 16px' }}>
          <div style={{ display: 'inline-block', background: '#2f6bff', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 2, letterSpacing: '.06em', marginBottom: 4 }}>
            {role === 'admin' ? 'CHỦ / TOÀN QUYỀN' : 'ĐỊNH GIÁ'}
          </div>
          <div style={{ color: '#888', fontSize: 9, marginBottom: 8, wordBreak: 'break-all' }}>{authState.user?.email}</div>
          <button
            onClick={() => void authState.signOut()}
            style={{ width: '100%', padding: '6px 8px', background: 'transparent', color: '#b3b3b3', border: '1px solid rgba(255,255,255,.15)', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main style={{ flex: 1, overflow: 'auto', background: '#f4f5f7', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1366, background: '#f4f5f7', minHeight: '100%' }}>
        {role && (
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
            {activeTab === 'sensitivity' && <SensitivityScreen scenario={data.scenario} />}
            {activeTab === 'scenario-compare' && <ScenarioCompareScreen scenario={data.scenario} />}
            {activeTab === 'order-acceptance' && <OrderAcceptanceScreen scenario={data.scenario} />}
            {activeTab === 'product-mix' && <ProductMixScreen scenario={data.scenario} />}
            {activeTab === 'lot-costing' && <LotCostingScreen scenario={data.scenario} internal={data.internal} />}
            {activeTab === 'pricelist' && (
              <PriceList
                priceList={data.priceList}
                scenario={data.scenario}
                internal={data.internal}
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === 'distributor-pricelist' && <DistributorPriceList priceList={data.priceList} />}
            {activeTab === 'pricing-analytics' && (
              <PricingAnalyticsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />
            )}
            {activeTab === 'config' && <ConfigScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
            {activeTab === 'assumptions' && (
              <AssumptionsScreen
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
                scenarioId={SCENARIO_ID}
                scenario={data.scenario}
                internal={data.internal}
              />
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}
