// ADR-020 + ADR-023 + ADR-026 — MỘT view CEO duy nhất, đăng nhập production thật.
// Người dùng đăng nhập bằng email/mật khẩu (LoginScreen); cổng vào = admin/pricing
// (ADR-006). App này CHỈ phục vụ QUYẾT ĐỊNH của CEO: nhìn nhiều góc độ → điều chỉnh
// tham số → xem thay đổi → quyết định. ADR-026 đã bỏ các tab vận hành của vai khác
// (Kế Hoạch SX của production; báo cáo dây chuyền Ống/PK; nhập Tồn Kho; Danh Mục SP)
// cho đỡ rối. Điều hướng chia 2 nhóm: PHÂN TÍCH & QUYẾT ĐỊNH và ĐIỀU CHỈNH.
import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import LoginScreen from '../auth/LoginScreen.js';
import { useScenarioData } from '../dashboard/useScenarioData.js';
import Dashboard from '../dashboard/Dashboard.js';
import PricingHub, { type PricingSub } from '../price-list/PricingHub.js';
import InventoryScreen from '../inventory/InventoryScreen.js';
import ProductsScreen from '../products/ProductsScreen.js';
import ExplainPanel from './ExplainPanel.js';
import AssistantChat from './AssistantChat.js';
import ConfigScreen from '../config/ConfigScreen.js';
import AssumptionsScreen from '../assumptions/AssumptionsScreen.js';
import CeoPlannerScreen from '../ceo-planner/CeoPlannerScreen.js';
import LotCostingScreen from '../lot-costing/LotCostingScreen.js';
import SensitivityScreen from '../sensitivity/SensitivityScreen.js';
import ScenarioCompareScreen from '../scenario-compare/ScenarioCompareScreen.js';
import OrderAcceptanceScreen from '../order-acceptance/OrderAcceptanceScreen.js';
import ProductMixScreen from '../product-mix/ProductMixScreen.js';

const SCENARIO_ID = 'baseline-v3.4';

// ADR-034 — điều hướng theo TÌNH HUỐNG của CEO (hằng ngày / khi có việc /
// hoạch định / thiết lập), không theo loại công cụ. Mỗi mục kèm chú thích
// 1 dòng = câu hỏi màn đó trả lời, để không phải nhớ tên màn.
// Mục 'pricing' gộp 3 tab cũ (pricelist / distributor-pricelist /
// pricing-analytics) thành hub sub-tab (PricingHub) — id dạng 'pricing:vf'.
type ScreenRole = 'view' | 'sim' | 'edit';
interface NavTab {
  id: string;
  label: string;
  caption: string;
}
// ADR-041 — vai từng nhóm: màu + nhãn + giải thích LIÊN KẾT (cái nào nuôi cái nào).
// Dùng chung ngôn ngữ màu với "bản đồ app" (xám=xem, xanh=giả định, đỏ=chỉnh thật).
const ROLE_META: Record<ScreenRole, { dot: string; tag: string; note: string; bg: string; fg: string; border: string }> = {
  view: { dot: '#6b6b6b', tag: 'CHỈ XEM', note: 'Số tự tính từ nhóm Dữ liệu gốc — muốn đổi thì vào Dữ liệu gốc, không sửa trực tiếp ở đây.', bg: '#f0efec', fg: '#4b4b4b', border: '#d8d5cd' },
  sim: { dot: '#1f5fd0', tag: 'GIẢ ĐỊNH — chưa lưu', note: 'Thử "nếu… thì…" trên dữ liệu hiện tại. Rời màn / F5 là mất, KHÔNG đụng dữ liệu thật.', bg: '#eaf1fc', fg: '#1f5fd0', border: '#bcd3f5' },
  edit: { dot: '#a8003b', tag: 'CHỈNH THẬT — lưu là tính lại', note: 'Đổi ở đây rồi bấm Lưu → ghi dữ liệu gốc → mọi màn Theo dõi & Thử tính lại theo.', bg: '#fbeef2', fg: '#a8003b', border: '#f0c4d3' },
};
// ADR-041 — điều hướng theo QUYỀN CHẠM DỮ LIỆU (theo dõi → thử → dữ liệu gốc):
// mỗi nhóm 1 vai rõ ràng để người dùng luôn biết đang XEM / THỬ (không lưu) /
// CHỈNH THẬT — hạn chế can thiệp chéo. Dữ liệu gốc (đỏ) đặt cuối như vùng cẩn thận.
const NAV_GROUPS: Array<{ title: string; role: ScreenRole; caption: string; tabs: NavTab[] }> = [
  {
    title: 'Theo dõi',
    role: 'view',
    caption: 'nhà máy đang thế nào — chỉ xem',
    tabs: [
      { id: 'dashboard', label: 'Tổng Quan', caption: 'nhà máy đang thế nào?' },
      { id: 'pricing', label: 'Bảng Giá', caption: 'giá VF · bảng NPP · phân tích' },
    ],
  },
  {
    title: 'Thử & Hoạch định',
    role: 'sim',
    caption: 'nếu… thì… — thử, không lưu',
    tabs: [
      { id: 'ceo-planner', label: 'Trợ Lý CEO', caption: 'kịch bản ca/biên → lợi nhuận' },
      { id: 'order-acceptance', label: 'Quyết Định Nhận Đơn', caption: 'đơn này nhận không?' },
      { id: 'lot-costing', label: 'Giá Vốn Theo Lô', caption: 'lô mới về — chốt lại giá?' },
      { id: 'scenario-compare', label: 'So Sánh Kịch Bản', caption: 'xấu · base · tốt' },
      { id: 'sensitivity', label: 'Độ Nhạy', caption: 'biến nào bào EBIT mạnh nhất?' },
      { id: 'product-mix', label: 'Tối Ưu Product-mix', caption: 'dồn lực vào dòng nào?' },
    ],
  },
  {
    title: 'Dữ liệu gốc',
    role: 'edit',
    caption: 'đổi ở đây → mọi màn tính lại',
    tabs: [
      { id: 'assumptions', label: 'Tham Số', caption: 'giá compound · tỷ giá · ngưỡng' },
      { id: 'products', label: 'Danh Mục Sản Phẩm', caption: 'SKU · đơn trọng · khuôn' },
      { id: 'config', label: 'Cấu Hình Nhà Máy', caption: 'máy · ca · lương · CAPEX' },
    ],
  },
];
// tabId → vai, để dán nhãn đúng vai ở đầu mỗi màn (nguồn DUY NHẤT: NAV_GROUPS).
const ROLE_BY_TAB: Record<string, ScreenRole> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.tabs.map((t) => [t.id, g.role] as const)),
);


export default function AppShell() {
  const authState = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const role = authState.role;
  // ADR-023: cổng vào view CEO = tầng chiến lược (admin/pricing, ADR-006).
  const hasAccess = role === 'admin' || role === 'pricing';

  const data = useScenarioData(SCENARIO_ID, role);

  // 'pricing:vf' → màn 'pricing', sub 'vf'. Các màn khác không có sub.
  const [tabId, tabSub] = activeTab.split(':') as [string, string | undefined];
  // Điều hướng dùng chung cho sidebar + nút link chéo trong màn.
  const go = (tab: string) => setActiveTab(tab === 'pricing' ? 'pricing:vf' : tab);

  const navItem = (t: NavTab) => {
    const active = t.id === tabId;
    return (
      <div
        key={t.id}
        onClick={() => go(t.id)}
        style={{ padding: '7px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, background: active ? '#f2f2f2' : 'transparent', borderLeft: `3px solid ${active ? '#0a0a0a' : 'transparent'}` }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#0a0a0a' : '#c9c9c9', flexShrink: 0, marginTop: 6 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: active ? '#0a0a0a' : '#555', fontSize: 12, fontWeight: active ? 700 : 400 }}>{t.label}</div>
          <div style={{ color: active ? '#737373' : '#a3a3a3', fontSize: 9, marginTop: 1 }}>{t.caption}</div>
        </div>
      </div>
    );
  };

  // ── Trạng thái auth (ADR-023): loading → login → chặn vai → view CEO ──────
  if (authState.status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f6f6', fontSize: 12, color: '#737373', fontFamily: 'Roboto,sans-serif' }}>Đang kiểm tra đăng nhập…</div>;
  }
  if (authState.status === 'signed-out') {
    return <LoginScreen onSignIn={authState.signIn} onSignInGoogle={authState.signInGoogle} onResetPassword={authState.resetPassword} />;
  }
  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f6f6', fontFamily: 'Roboto,sans-serif' }}>
        <div style={{ width: 360, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Không có quyền truy cập</div>
          <div style={{ fontSize: 12, color: '#737373', marginBottom: 18 }}>
            Tài khoản <b>{authState.user?.email}</b> {role ? `(vai ${role})` : '(chưa được cấp vai)'} không có quyền vào bảng điều khiển quản trị. Liên hệ quản trị viên để được cấp quyền.
          </div>
          <button onClick={() => void authState.signOut()} style={{ padding: '9px 18px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Đăng xuất</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Roboto,Helvetica Neue,sans-serif', color: '#0a0a0a', background: '#f6f6f6' }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: 216, background: '#fff', borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #ececec' }}>
          <div style={{ color: '#999', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>BlazeMaster CPVC</div>
          <div style={{ color: '#0a0a0a', fontSize: 14, fontWeight: 700, letterSpacing: '-.2px' }}>Costing Engine</div>
          <div style={{ color: '#b3b3b3', fontSize: 10, marginTop: 2 }}>Model v3.7 · VN · 2026</div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.title}>
              <div style={{ padding: '11px 16px 5px', marginTop: gi === 0 ? 4 : 8, borderTop: gi === 0 ? 'none' : '1px solid #f2f2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ROLE_META[g.role].dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: ROLE_META[g.role].fg, fontWeight: 700 }}>{g.title}</span>
                </div>
                <div style={{ fontSize: 8.5, color: '#b3b3b3', marginTop: 2, paddingLeft: 13 }}>{g.caption}</div>
              </div>
              {g.tabs.map(navItem)}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid #ececec', padding: '12px 16px' }}>
          <div style={{ display: 'inline-block', background: '#0a0a0a', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 2, letterSpacing: '.06em', marginBottom: 4 }}>
            {role === 'admin' ? 'CHỦ / TOÀN QUYỀN' : 'ĐỊNH GIÁ'}
          </div>
          <div style={{ color: '#999', fontSize: 9, marginBottom: 8, wordBreak: 'break-all' }}>{authState.user?.email}</div>
          <button
            onClick={() => void authState.signOut()}
            style={{ width: '100%', padding: '6px 8px', background: 'transparent', color: '#737373', border: '1px solid #d8d8d8', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <ExplainPanel tabId={tabId} onNavigate={go} />
      <AssistantChat scenarioId={SCENARIO_ID} screenId={tabId} />
      <main style={{ flex: 1, overflow: 'auto', background: '#f6f6f6', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1366, background: '#f6f6f6', minHeight: '100%' }}>
        {role && (
          <>
            {/* ADR-041 — NHÃN VAI màn: người dùng luôn biết đang XEM / THỬ (không
                lưu) / CHỈNH THẬT. lot-costing:edit mở màn Tồn Kho (ghi thật) nên
                nhãn chuyển 'edit'. Một chỗ áp cho MỌI màn, đồng bộ màu sidebar. */}
            {(() => {
              const sr: ScreenRole = tabId === 'lot-costing' && tabSub === 'edit' ? 'edit' : ROLE_BY_TAB[tabId] ?? 'view';
              const meta = ROLE_META[sr];
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 36px 0', padding: '7px 13px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.border}`, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot }} />
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color: meta.fg, textTransform: 'uppercase' }}>{meta.tag}</span>
                  </span>
                  <span style={{ fontSize: 11, color: meta.fg, opacity: 0.92 }}>{meta.note}</span>
                </div>
              );
            })()}
            {data.error && (
              <div style={{ margin: '16px 36px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #DC2626', borderRadius: 2, fontSize: 11, color: '#DC2626' }}>{data.error}</div>
            )}
            {tabId === 'dashboard' && (
              <Dashboard
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
                scenarioId={SCENARIO_ID}
                scenario={data.scenario}
                internal={data.internal}
                salesPriceLadder={data.priceList?.priceLadder ?? null}
                onNavigate={go}
              />
            )}
            {tabId === 'ceo-planner' && <CeoPlannerScreen scenario={data.scenario} />}
            {tabId === 'sensitivity' && <SensitivityScreen scenario={data.scenario} onNavigate={go} />}
            {tabId === 'scenario-compare' && <ScenarioCompareScreen scenario={data.scenario} />}
            {tabId === 'order-acceptance' && <OrderAcceptanceScreen scenario={data.scenario} priceList={data.priceList} onNavigate={go} />}
            {tabId === 'product-mix' && <ProductMixScreen scenario={data.scenario} />}
            {tabId === 'lot-costing' && tabSub !== 'edit' && (
              <LotCostingScreen scenario={data.scenario} internal={data.internal} onNavigate={go} />
            )}
            {tabId === 'lot-costing' && tabSub === 'edit' && (
              <div>
                {/* ADR-035 — đường nhập/sửa lô (màn Tồn Kho) gắn lại vào Giá Vốn Theo Lô;
                    ADR-026 từng gỡ khỏi menu mà không chừa lối vào thay thế. */}
                <div style={{ padding: '18px 36px 0' }}>
                  <button
                    onClick={() => setActiveTab('lot-costing')}
                    style={{ padding: '7px 14px', background: '#fff', color: '#0a0a0a', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ← Quay lại Giá Vốn Theo Lô
                  </button>
                </div>
                <InventoryScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} />
              </div>
            )}
            {tabId === 'pricing' && (
              <PricingHub
                sub={(tabSub as PricingSub | undefined) ?? 'vf'}
                onSubChange={(s) => setActiveTab(`pricing:${s}`)}
                onNavigate={go}
                role={role}
                scenarioId={SCENARIO_ID}
                priceList={data.priceList}
                scenario={data.scenario}
                internal={data.internal}
              />
            )}
            {tabId === 'products' && <ProductsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
            {tabId === 'config' && <ConfigScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
            {tabId === 'assumptions' && (
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
