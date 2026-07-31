// ADR-020 + ADR-023 + ADR-026 — MỘT view CEO duy nhất, đăng nhập production thật.
// Người dùng đăng nhập bằng email/mật khẩu (LoginScreen); cổng vào = admin/pricing
// (ADR-006). App này CHỈ phục vụ QUYẾT ĐỊNH của CEO: nhìn nhiều góc độ → điều chỉnh
// tham số → xem thay đổi → quyết định. ADR-026 đã bỏ các tab vận hành của vai khác
// (Kế Hoạch SX của production; báo cáo dây chuyền Ống/PK; nhập Tồn Kho; Danh Mục SP)
// cho đỡ rối. Điều hướng chia 2 nhóm: PHÂN TÍCH & QUYẾT ĐỊNH và ĐIỀU CHỈNH.
// ADR-033 roll-out (bước cuối): chrome sidebar/nav lấy màu từ design tokens thay
// vì hex gõ tay — nguồn chân lý duy nhất. 3 vai màn (view/sim/edit, ADR-041) là
// tín hiệu an toàn thật (tránh sửa nhầm dữ liệu gốc), không phải trang trí —
// giữ 3 sắc riêng nhưng ánh xạ về token sẵn có: view=trung tính, sim=warning
// (đang thử, chưa lưu), edit=danger (ghi thật, cẩn trọng nhất).
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import { useAuth } from '../auth/useAuth.js';
import LoginScreen from '../auth/LoginScreen.js';
import { useScenarioData } from '../dashboard/useScenarioData.js';
import Dashboard from '../dashboard/Dashboard.js';
import PricingHub, { type PricingSub } from '../price-list/PricingHub.js';
import InventoryScreen from '../inventory/InventoryScreen.js';
import ProductsScreen from '../products/ProductsScreen.js';
import ExplainPanel from './ExplainPanel.js';
import AssistantChat from './AssistantChat.js';
import DataSetupScreen from '../data-setup/DataSetupScreen.js';
import CeoPlannerScreen from '../ceo-planner/CeoPlannerScreen.js';
import LotCostingScreen from '../lot-costing/LotCostingScreen.js';
import ScenarioCompareScreen from '../scenario-compare/ScenarioCompareScreen.js';
import { color, font, radius, shadow } from '../../design/tokens.js';

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
// Tín hiệu an toàn thật (ADR-033): xám=xem, amber=giả định (chưa lưu), đỏ=chỉnh thật.
const ROLE_META: Record<ScreenRole, { dot: string; tag: string; note: string; bg: string; fg: string; border: string }> = {
  view: { dot: color.inkFaint, tag: 'CHỈ XEM', note: 'Số tự tính từ nhóm Dữ liệu gốc — muốn đổi thì vào Dữ liệu gốc, không sửa trực tiếp ở đây.', bg: color.surfaceMuted, fg: color.inkMuted, border: color.border },
  sim: { dot: color.warning, tag: 'GIẢ ĐỊNH — chưa lưu', note: 'Thử "nếu… thì…" trên dữ liệu hiện tại. Rời màn / F5 là mất, KHÔNG đụng dữ liệu thật.', bg: color.warningTint, fg: color.warningInk, border: color.warning },
  edit: { dot: color.danger, tag: 'CHỈNH THẬT — lưu là tính lại', note: 'Đổi ở đây rồi bấm Lưu → ghi dữ liệu gốc → mọi màn Theo dõi & Thử tính lại theo.', bg: color.dangerTint, fg: color.dangerInk, border: color.danger },
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
      { id: 'lot-costing', label: 'Giá Vốn Theo Lô', caption: 'lô mới về — chốt lại giá?' },
      { id: 'scenario-compare', label: 'So Sánh Kịch Bản', caption: 'kịch bản · độ nhạy (tornado)' },
    ],
  },
  {
    title: 'Dữ liệu gốc',
    role: 'edit',
    caption: 'đổi ở đây → mọi màn tính lại',
    tabs: [
      { id: 'data-setup', label: 'Thiết Lập Dữ Liệu', caption: 'tài sản · chi phí · nguyên liệu · SKU · giá' },
      { id: 'products', label: 'Danh Mục Sản Phẩm', caption: 'SKU · đơn trọng · khuôn (lối tắt)' },
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
        style={{ padding: '7px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, background: active ? color.brandTint : 'transparent', borderLeft: `3px solid ${active ? color.brand : 'transparent'}` }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? color.brand : color.borderStrong, flexShrink: 0, marginTop: 6 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: active ? color.ink : color.inkMuted, fontSize: font.size.sm, fontWeight: active ? font.weight.bold : font.weight.regular }}>{t.label}</div>
          <div style={{ color: active ? color.inkMuted : color.inkFaint, fontSize: font.size.eyebrow, marginTop: 1 }}>{t.caption}</div>
        </div>
      </div>
    );
  };

  // ── Trạng thái auth (ADR-023): loading → login → chặn vai → view CEO ──────
  if (authState.status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.canvas, fontSize: font.size.sm, color: color.inkMuted, fontFamily: font.family }}>Đang kiểm tra đăng nhập…</div>;
  }
  if (authState.status === 'signed-out') {
    return <LoginScreen onSignIn={authState.signIn} onSignInGoogle={authState.signInGoogle} onResetPassword={authState.resetPassword} />;
  }
  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.canvas, fontFamily: font.family }}>
        <div style={{ width: 360, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.bold, marginBottom: 6, color: color.ink }}>Không có quyền truy cập</div>
          <div style={{ fontSize: font.size.sm, color: color.inkMuted, marginBottom: 18 }}>
            Tài khoản <b>{authState.user?.email}</b> {role ? `(vai ${role})` : '(chưa được cấp vai)'} không có quyền vào bảng điều khiển quản trị. Liên hệ quản trị viên để được cấp quyền.
          </div>
          <button onClick={() => void authState.signOut()} style={{ padding: '9px 18px', background: color.brand, color: color.inkInverse, border: 'none', borderRadius: radius.md, fontSize: font.size.sm, fontWeight: font.weight.bold, cursor: 'pointer' }}>Đăng xuất</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: font.family, color: color.ink, background: color.canvas }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: 216, background: color.surface, borderRight: `1px solid ${color.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${color.border}` }}>
          <div style={{ color: color.inkFaint, fontSize: font.size.eyebrow, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: font.weight.bold, marginBottom: 4 }}>BlazeMaster CPVC</div>
          <div style={{ color: color.ink, fontSize: font.size.md, fontWeight: font.weight.bold, letterSpacing: '-.2px' }}>Costing Engine</div>
          <div style={{ color: color.inkFaint, fontSize: font.size.xs, marginTop: 2 }}>Model v3.7 · VN · 2026</div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.title}>
              <div style={{ padding: '11px 16px 5px', marginTop: gi === 0 ? 4 : 8, borderTop: gi === 0 ? 'none' : `1px solid ${color.surfaceMuted}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ROLE_META[g.role].dot, flexShrink: 0 }} />
                  <span style={{ fontSize: font.size.eyebrow, letterSpacing: '.12em', textTransform: 'uppercase', color: ROLE_META[g.role].fg, fontWeight: font.weight.bold }}>{g.title}</span>
                </div>
                <div style={{ fontSize: 8.5, color: color.inkFaint, marginTop: 2, paddingLeft: 13 }}>{g.caption}</div>
              </div>
              {g.tabs.map(navItem)}
            </div>
          ))}
        </nav>

        {/* ADR-047 — CÔNG TẮC toàn cục: cách tính giá thành Ống. Lưu vào scenario
            (admin đổi → mọi màn tự tính lại theo, vì app tính client-side). */}
        {data.scenario && (
          <div style={{ borderTop: `1px solid ${color.border}`, padding: '10px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: color.inkFaint, fontWeight: font.weight.bold, marginBottom: 5 }}>Cách tính giá thành Ống</div>
            <div style={{ display: 'flex', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, overflow: 'hidden' }}>
              {([['kg', 'Theo kg'], ['meters', 'Theo m/giờ']] as const).map(([v, label]) => {
                const active = (data.scenario!.pipeCostMethod ?? 'kg') === v;
                const canSwitch = role === 'admin' && !active;
                return (
                  <div
                    key={v}
                    onClick={() => { if (canSwitch) void updateDoc(doc(db, `scenarios/${SCENARIO_ID}`), { pipeCostMethod: v }); }}
                    title={role === 'admin' ? 'Đổi cách tính — mọi màn tính lại theo' : 'Chỉ Toàn Quyền đổi được'}
                    style={{ flex: 1, textAlign: 'center', padding: '5px 4px', fontSize: font.size.xs, fontWeight: font.weight.semibold, cursor: canSwitch ? 'pointer' : 'default', background: active ? color.brand : color.surface, color: active ? color.inkInverse : role === 'admin' ? color.inkMuted : color.inkFaint }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 8, color: color.inkFaint, marginTop: 4 }}>
              {(data.scenario.pipeCostMethod ?? 'kg') === 'kg' ? 'Rải đều theo kg (chuẩn Excel)' : 'Theo giờ máy per-size (m/giờ)'}
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${color.border}`, padding: '12px 16px' }}>
          <div style={{ display: 'inline-block', background: color.brand, color: color.inkInverse, fontSize: 8, fontWeight: font.weight.bold, padding: '2px 6px', borderRadius: radius.sm, letterSpacing: '.06em', marginBottom: 4 }}>
            {role === 'admin' ? 'CHỦ / TOÀN QUYỀN' : 'ĐỊNH GIÁ'}
          </div>
          <div style={{ color: color.inkFaint, fontSize: font.size.eyebrow, marginBottom: 8, wordBreak: 'break-all' }}>{authState.user?.email}</div>
          <button
            onClick={() => void authState.signOut()}
            style={{ width: '100%', padding: '6px 8px', background: 'transparent', color: color.inkMuted, border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, fontSize: font.size.xs, fontWeight: font.weight.semibold, cursor: 'pointer' }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <ExplainPanel tabId={tabId} onNavigate={go} />
      <AssistantChat scenarioId={SCENARIO_ID} screenId={tabId} />
      <main style={{ flex: 1, overflow: 'auto', background: color.canvas, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1366, background: color.canvas, minHeight: '100%' }}>
        {role && (
          <>
            {/* ADR-041 — NHÃN VAI màn: người dùng luôn biết đang XEM / THỬ (không
                lưu) / CHỈNH THẬT. lot-costing:edit mở màn Tồn Kho (ghi thật) nên
                nhãn chuyển 'edit'. Một chỗ áp cho MỌI màn, đồng bộ màu sidebar. */}
            {(() => {
              const sr: ScreenRole = tabId === 'lot-costing' && tabSub === 'edit' ? 'edit' : ROLE_BY_TAB[tabId] ?? 'view';
              const meta = ROLE_META[sr];
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 36px 0', padding: '7px 13px', borderRadius: radius.sm, background: meta.bg, border: `1px solid ${meta.border}`, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot }} />
                    <span style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, letterSpacing: '.04em', color: meta.fg, textTransform: 'uppercase' }}>{meta.tag}</span>
                  </span>
                  <span style={{ fontSize: font.size.sm, color: meta.fg, opacity: 0.92 }}>{meta.note}</span>
                </div>
              );
            })()}
            {data.error && (
              <div style={{ margin: '16px 36px 0', padding: '10px 14px', background: color.dangerTint, border: `1px solid ${color.danger}`, borderRadius: radius.sm, fontSize: font.size.sm, color: color.dangerInk }}>{data.error}</div>
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
            {tabId === 'ceo-planner' && (
              <CeoPlannerScreen
                scenario={data.scenario}
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
              />
            )}
            {tabId === 'sensitivity' && <ScenarioCompareScreen scenario={data.scenario} onNavigate={go} initialTab="tornado" />}
            {tabId === 'scenario-compare' && <ScenarioCompareScreen scenario={data.scenario} onNavigate={go} />}
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
                    style={{ padding: '7px 14px', background: color.surface, color: color.ink, border: `1px solid ${color.borderStrong}`, borderRadius: radius.md, fontSize: font.size.xs, fontWeight: font.weight.bold, cursor: 'pointer' }}
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
                priceList={data.priceList}
                scenario={data.scenario}
                internal={data.internal}
              />
            )}
            {tabId === 'products' && <ProductsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} />}
            {tabId === 'data-setup' && (
              <DataSetupScreen
                key={activeTab}
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
                scenarioId={SCENARIO_ID}
                scenario={data.scenario}
                internal={data.internal}
                initialSection={tabSub as Parameters<typeof DataSetupScreen>[0]['initialSection']}
              />
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}
