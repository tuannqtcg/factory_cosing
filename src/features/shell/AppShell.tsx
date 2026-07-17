// ADR-020 + ADR-023 + ADR-026 — MỘT view CEO duy nhất, đăng nhập production thật.
// Người dùng đăng nhập bằng email/mật khẩu (LoginScreen); cổng vào = admin/pricing
// (ADR-006). App này CHỈ phục vụ QUYẾT ĐỊNH của CEO: nhìn nhiều góc độ → điều chỉnh
// tham số → xem thay đổi → quyết định. ADR-026 đã bỏ các tab vận hành của vai khác
// (Kế Hoạch SX của production; báo cáo dây chuyền Ống/PK; nhập Tồn Kho; Danh Mục SP)
// cho đỡ rối. Điều hướng chia 2 nhóm: PHÂN TÍCH & QUYẾT ĐỊNH và ĐIỀU CHỈNH.
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
        className={cn(
          'flex cursor-pointer items-center gap-2 border-l-2 px-4 py-[9px]',
          active ? 'border-white bg-neutral-900' : 'border-transparent',
        )}
      >
        <div className={cn('h-1 w-1 shrink-0 rounded-full', active ? 'bg-white' : 'bg-neutral-600')} />
        <span className={cn('text-xs', active ? 'font-semibold text-white' : 'text-neutral-400')}>{t.label}</span>
      </div>
    );
  };

  // ── Trạng thái auth (ADR-023): loading → login → chặn vai → view CEO ──────
  if (authState.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-background text-xs text-muted-foreground">Đang kiểm tra đăng nhập…</div>;
  }
  if (authState.status === 'signed-out') {
    return <LoginScreen onSignIn={authState.signIn} onDemoLogin={authState.switchRole} isEmulator={isEmulatorMode} />;
  }
  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-[360px] p-7 text-center">
          <div className="mb-1.5 text-[15px] font-bold text-foreground">Không có quyền truy cập</div>
          <div className="mb-[18px] text-xs text-muted-foreground">
            Tài khoản <b>{authState.user?.email}</b> {role ? `(vai ${role})` : '(chưa được cấp vai)'} không có quyền vào bảng điều khiển quản trị. Liên hệ quản trị viên để được cấp quyền.
          </div>
          <Button onClick={() => void authState.signOut()}>Đăng xuất</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="sticky top-0 flex h-screen w-[216px] shrink-0 flex-col bg-neutral-950">
        <div className="border-b border-white/10 px-4 pb-3.5 pt-[18px]">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-neutral-400">BlazeMaster CPVC</div>
          <div className="text-sm font-bold tracking-[-.2px] text-white">Costing Engine</div>
          <div className="mt-0.5 text-[10px] text-neutral-600">Model v3.7 · VN · 2026</div>
        </div>

        <nav className="flex-1 overflow-y-auto pb-2">
          <div className="mt-1 px-4 pb-1 pt-2.5 text-[8px] font-bold uppercase tracking-[.14em] text-neutral-500">Phân Tích & Quyết Định</div>
          {OPERATION_TABS.map(navItem)}
          <div className="mt-2 border-t border-white/[.06] px-4 pb-1 pt-2.5 text-[8px] font-bold uppercase tracking-[.14em] text-neutral-500">Điều Chỉnh Tham Số</div>
          {CONFIG_TABS.map(navItem)}
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <div className="mb-1 inline-block rounded-[2px] bg-white px-1.5 py-0.5 text-[8px] font-bold tracking-[.06em] text-neutral-950">
            {role === 'admin' ? 'CHỦ / TOÀN QUYỀN' : 'ĐỊNH GIÁ'}
          </div>
          <div className="mb-2 break-all text-[9px] text-neutral-500">{authState.user?.email}</div>
          <Button
            variant="outline"
            onClick={() => void authState.signOut()}
            className="h-auto w-full border-white/15 bg-transparent px-2 py-1.5 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="min-w-0 flex-1 overflow-auto bg-background">
        <div className="mx-auto min-h-full w-full max-w-[1366px]">
        {role && (
          <>
            {data.error && (
              <div className="mx-9 mt-4 rounded-sm border border-destructive/40 bg-destructive-tint px-3.5 py-2.5 text-[11px] text-destructive">{data.error}</div>
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
