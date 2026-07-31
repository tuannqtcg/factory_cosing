// ADR-020 + ADR-023 + ADR-026 + ADR-059 — MỘT view CEO duy nhất, đăng nhập production
// thật. Người dùng đăng nhập bằng email/mật khẩu (LoginScreen); cổng vào = admin/pricing
// (ADR-006). App này CHỈ phục vụ QUYẾT ĐỊNH của CEO: nhìn nhiều góc độ → điều chỉnh
// tham số → xem thay đổi → quyết định. ADR-059 tối giản điều hướng còn 5 mục + Trợ
// Giúp ghim (danh sách + panel lồng nhau kiểu Twenty CRM thay cho thêm mục sidebar
// cho mỗi loại dữ liệu) — xem prototype/layout-redesign-proposal.html đã duyệt.
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import { useAuth } from '../auth/useAuth.js';
import LoginScreen from '../auth/LoginScreen.js';
import { useScenarioData } from '../dashboard/useScenarioData.js';
import Dashboard from '../dashboard/Dashboard.js';
import PricingHub, { type PricingSub } from '../price-list/PricingHub.js';
import InventoryScreen from '../inventory/InventoryScreen.js';
import MaterialsScreen from '../materials/MaterialsScreen.js';
import ExplainPanel from './ExplainPanel.js';
import AssistantChat from './AssistantChat.js';
import HelpScreen from './HelpScreen.js';
import DataSetupScreen from '../data-setup/DataSetupScreen.js';
import PlanningHub, { type PlanningSub } from '../ceo-planner/PlanningHub.js';

const SCENARIO_ID = 'baseline-v3.4';

// ADR-059 — sidebar rút còn 5 mục phẳng (không chia nhóm màu) + Trợ Giúp ghim
// cuối, thay cho 7 mục chia 3 nhóm trước đây (ADR-034/041). "Giá Vốn Theo Lô"
// không còn là mục riêng — vai trò của nó (xem giá vốn + chốt lại giá) chuyển
// vào panel của mục "Nguyên Liệu". "Danh Mục Sản Phẩm" bỏ khỏi sidebar vì đã có
// sẵn nguyên vẹn trong "Thiết Lập" (mục ⑤, ADR-049) — tab riêng chỉ là lối tắt
// trùng lặp. Nhãn vai (XEM/THỬ/CHỈNH THẬT) GIỮ NGUYÊN cơ chế — vẫn là tín hiệu
// an toàn cho từng màn, chỉ không còn hiển thị thành nhóm màu trên sidebar.
type ScreenRole = 'view' | 'sim' | 'edit';
interface NavTab {
  id: string;
  label: string;
  caption: string;
}
const ROLE_META: Record<ScreenRole, { dot: string; tag: string; note: string; bg: string; fg: string; border: string }> = {
  view: { dot: '#6b6b6b', tag: 'CHỈ XEM', note: 'Số tự tính từ Thiết Lập — muốn đổi thì vào Thiết Lập, không sửa trực tiếp ở đây.', bg: '#f0efec', fg: '#4b4b4b', border: '#d8d5cd' },
  sim: { dot: '#1f5fd0', tag: 'GIẢ ĐỊNH — chưa lưu', note: 'Thử "nếu… thì…" trên dữ liệu hiện tại. Rời màn / F5 là mất, KHÔNG đụng dữ liệu thật.', bg: '#eaf1fc', fg: '#1f5fd0', border: '#bcd3f5' },
  edit: { dot: '#a8003b', tag: 'CHỈNH THẬT — lưu là tính lại', note: 'Đổi ở đây rồi bấm Lưu → ghi dữ liệu gốc → mọi màn Theo dõi & Thử tính lại theo.', bg: '#fbeef2', fg: '#a8003b', border: '#f0c4d3' },
};
const NAV_TABS: NavTab[] = [
  { id: 'dashboard', label: 'Tổng Quan', caption: 'nhà máy đang thế nào?' },
  { id: 'materials', label: 'Nguyên Liệu', caption: 'giá vốn — chốt lại giá?' },
  { id: 'pricing', label: 'Bảng Giá', caption: 'giá VF · bảng NPP · phân tích' },
  { id: 'planning', label: 'Kịch Bản & Hoạch Định', caption: 'thử ca/biên, so sánh kịch bản' },
  { id: 'data-setup', label: 'Thiết Lập', caption: 'tài sản · chi phí · nguyên liệu · SKU · giá' },
];
const HELP_TAB: NavTab = { id: 'help', label: '❓ Trợ Giúp', caption: 'giải thích màn hình & thuật ngữ' };
const ROLE_BY_TAB: Record<string, ScreenRole> = {
  dashboard: 'view',
  materials: 'edit', // panel có chốt baseline + sửa lô — CHỈNH THẬT (ADR-059)
  pricing: 'view',
  planning: 'sim',
  'data-setup': 'edit',
};


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
  const go = (tab: string) => setActiveTab(tab === 'pricing' ? 'pricing:vf' : tab === 'planning' ? 'planning:ceo' : tab);

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
          <div style={{ paddingTop: 6 }}>{NAV_TABS.map(navItem)}</div>
          {/* ADR-059 — Trợ Giúp ghim cuối danh sách chính, tách biệt = luôn 1 click */}
          <div style={{ marginTop: 10, borderTop: '1px solid #f2f2f2', paddingTop: 6 }}>{navItem(HELP_TAB)}</div>
        </nav>

        {/* ADR-047 — CÔNG TẮC toàn cục: cách tính giá thành Ống. Lưu vào scenario
            (admin đổi → mọi màn tự tính lại theo, vì app tính client-side). */}
        {data.scenario && (
          <div style={{ borderTop: '1px solid #ececec', padding: '10px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: '#b3b3b3', fontWeight: 700, marginBottom: 5 }}>Cách tính giá thành Ống</div>
            <div style={{ display: 'flex', border: '1px solid #d8d8d8', borderRadius: 4, overflow: 'hidden' }}>
              {([['kg', 'Theo kg'], ['meters', 'Theo m/giờ']] as const).map(([v, label]) => {
                const active = (data.scenario!.pipeCostMethod ?? 'kg') === v;
                const canSwitch = role === 'admin' && !active;
                return (
                  <div
                    key={v}
                    onClick={() => { if (canSwitch) void updateDoc(doc(db, `scenarios/${SCENARIO_ID}`), { pipeCostMethod: v }); }}
                    title={role === 'admin' ? 'Đổi cách tính — mọi màn tính lại theo' : 'Chỉ Toàn Quyền đổi được'}
                    style={{ flex: 1, textAlign: 'center', padding: '5px 4px', fontSize: 10, fontWeight: 600, cursor: canSwitch ? 'pointer' : 'default', background: active ? '#0a0a0a' : '#fff', color: active ? '#fff' : role === 'admin' ? '#555' : '#b3b3b3' }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 8, color: '#b3b3b3', marginTop: 4 }}>
              {(data.scenario.pipeCostMethod ?? 'kg') === 'kg' ? 'Rải đều theo kg (chuẩn Excel)' : 'Theo giờ máy per-size (m/giờ)'}
            </div>
          </div>
        )}

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
            {/* ADR-041/059 — NHÃN VAI màn: người dùng luôn biết đang XEM / THỬ (không
                lưu) / CHỈNH THẬT. Một chỗ áp cho MỌI màn (bỏ nhóm màu sidebar, giữ
                nguyên cơ chế nhãn — vẫn nguồn ROLE_BY_TAB duy nhất). Tab 'help' không
                có banner (nội dung tĩnh, không rủi ro dữ liệu). */}
            {tabId !== 'help' && (() => {
              const sr: ScreenRole = ROLE_BY_TAB[tabId] ?? 'view';
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
            {tabId === 'materials' && tabSub !== 'advanced' && (
              <MaterialsScreen role={role} scenarioId={SCENARIO_ID} scenario={data.scenario} internal={data.internal} onNavigate={go} />
            )}
            {tabId === 'materials' && tabSub === 'advanced' && (
              <div>
                {/* ADR-059 — thao tác hiếm (thêm nguyên liệu mới, ren kim loại mua
                    ngoài) vẫn ở màn cũ InventoryScreen, không nhân bản logic. */}
                <div style={{ padding: '18px 36px 0' }}>
                  <button
                    onClick={() => setActiveTab('materials')}
                    style={{ padding: '7px 14px', background: '#fff', color: '#0a0a0a', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ← Quay lại Nguyên Liệu
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
            {tabId === 'planning' && (
              <PlanningHub
                sub={(tabSub as PlanningSub | undefined) ?? 'ceo'}
                onSubChange={(s) => setActiveTab(`planning:${s}`)}
                onNavigate={go}
                scenario={data.scenario}
                role={role}
                user={authState.user ? { uid: authState.user.uid, email: authState.user.email } : null}
              />
            )}
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
            {tabId === 'help' && <HelpScreen />}
          </>
        )}
        </div>
      </main>
    </div>
  );
}
