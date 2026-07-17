// M12.9d — màn hình Tham Số (tab `assumptions`, vai admin/pricing), theo
// mockup Pha 1 đã duyệt: giá tái tạo + khóa bảng giá (ADR-004) + markup VF +
// thuế NK/logistics (ADR-012) — TỪNG nguyên liệu độc lập (thay 2 field
// markupVFOng/markupVFPK cứng của prototype gốc). `thresholdPct` admin-only
// theo TỪNG phần tử mảng (ADR-015, rules đã vá M12.9d) — field khóa client
// khớp đúng enforcement server, không chỉ trang trí.
// TRÌNH BÀY (ADR-033): Tailwind + shadcn/ui (Card/Input/Button/Badge), KHÔNG
// inline-style hardcode — màu lấy từ CSS variables (src/index.css). Logic giữ
// NGUYÊN; màu CHỈ dành cho DỮ LIỆU/trạng thái (KHÓA/MỞ KHÓA, % lệch, field admin-only).
import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput, type ScenarioOutput } from '../../schemas/scenario.js';
import type { Material } from '../../schemas/material.js';
import type { MetalInsertCatalogEntry } from '../../schemas/pricing-chain.js';
import { writePriceLockAuditEntry } from '../../lib/priceLockAudit.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

function numField(
  label: string,
  value: number,
  onChange: (v: number) => void,
  opts: { unit?: string; locked?: boolean; step?: string } = {},
) {
  const disabled = !!opts.locked;
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-1 text-eyebrow font-semibold uppercase tracking-[.05em] text-foreground">
        <span>{label}</span>
        {opts.locked && <span className="text-[11px] opacity-75">🔒</span>}
      </span>
      <Input
        type="number"
        step={opts.step ?? '0.01'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-9 text-right text-[13px] font-semibold tabular-nums disabled:bg-muted"
      />
      {opts.unit && <div className="mt-1 text-right text-eyebrow text-faint">{opts.unit}</div>}
    </label>
  );
}

export default function AssumptionsScreen({
  role,
  user,
  scenarioId,
  scenario,
  internal,
}: {
  role: AppRole;
  /** M12.10 (security-review) — ai đổi baseline, ghi vào priceLockAudit. */
  user: { uid: string; email: string | null } | null;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
}) {
  // ADR-026 — bỏ guard "chỉ dành cho vai X" (chỉ admin/pricing đăng nhập được).
  // GIỮ `isAdmin`: `thresholdPct` là admin-only (ADR-015) khớp firestore.rules —
  // đây là ranh giới bảo mật, không phải điều hướng theo vai.
  const isAdmin = role === 'admin';
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  // Bản chụp baseline lúc TẢI/LƯU GẦN NHẤT — diff với form lúc lưu để biết
  // material nào vừa đổi baseline (M12.10 audit log), không phụ thuộc user bấm
  // nút "Chốt Baseline Mới" hay tự gõ tay — log theo KẾT QUẢ, không theo cơ chế UI.
  const lastPersistedMaterialsRef = useRef<Material[] | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
    lastPersistedMaterialsRef.current = scenario.materials;
  }

  if (!form || !internal) {
    return <div className="px-9 py-8 text-sm text-muted-foreground">Đang tải kịch bản + kết quả tính…</div>;
  }

  const setMaterials = (updater: (materials: Material[]) => Material[]) =>
    setForm((f) => (f ? { ...f, materials: updater(f.materials) } : f));
  const updateMaterialField = (matId: string, key: 'markupVf' | 'importTaxRate' | 'customsLogisticsFeeRate', value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, [key]: value })));
  const updateReplacement = (matId: string, value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, replacementPriceUsdPerKg: value } })));
  const updateBaseline = (matId: string, value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: value } } })));
  const updateThreshold = (matId: string, value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, thresholdPct: value } } })));
  const chotBaseline = (matId: string) =>
    setMaterials((mats) =>
      mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: m.inventory.replacementPriceUsdPerKg } } })),
    );

  const setInsert = (updater: (entries: MetalInsertCatalogEntry[]) => MetalInsertCatalogEntry[]) =>
    setForm((f) => (f ? { ...f, inventory: { ...f.inventory, metalInsert: updater(f.inventory.metalInsert) } } : f));
  const updateInsertThreshold = (key: string, value: number) =>
    setInsert((entries) => entries.map((e) => (`${e.renType}|${e.ptSize}` !== key ? e : { ...e, priceLock: { ...e.priceLock, thresholdPct: value } })));

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    const parsed = ScenarioInputSchema.safeParse(form);
    if (!parsed.success) {
      setSaveState('error');
      setSaveError(`Dữ liệu không hợp lệ: ${parsed.error.issues[0]?.message ?? 'lỗi không rõ'}`);
      return;
    }
    // M12.10 (security-review) — phát hiện material nào ĐỔI baseline TRƯỚC khi
    // ghi (so với bản đã lưu gần nhất), để ghi audit log SAU KHI ghi thành công.
    const prevMaterials = lastPersistedMaterialsRef.current ?? [];
    const baselineChanges = parsed.data.materials
      .map((m) => ({ m, prev: prevMaterials.find((p) => p.id === m.id) }))
      .filter(({ m, prev }) => prev && prev.inventory.priceLock.baseline !== m.inventory.priceLock.baseline);
    try {
      await setDoc(doc(db, `scenarios/${scenarioId}`), parsed.data);
      setSaveState('saved');
      lastPersistedMaterialsRef.current = parsed.data.materials;
      if (user && (role === 'admin' || role === 'pricing')) {
        await Promise.all(
          baselineChanges.map(({ m, prev }) =>
            writePriceLockAuditEntry(scenarioId, {
              materialId: m.id,
              materialName: m.name,
              oldBaselineUsdPerKg: prev!.inventory.priceLock.baseline,
              newBaselineUsdPerKg: m.inventory.priceLock.baseline,
              changedByUid: user.uid,
              changedByEmail: user.email,
              changedByRole: role,
            }),
          ),
        );
      }
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="px-9 py-8">
      <div className="mb-5">
        <div className="mb-1.5 text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Quản Trị Dữ Liệu Gốc</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tham Số</h1>
            <div className="mt-1 text-xs text-muted-foreground">Giá tái tạo · khóa bảng giá (ADR-004) · markup VF · thuế NK/logistics — TỪNG nguyên liệu</div>
          </div>
          <Button onClick={() => void handleSave()} disabled={saveState === 'saving'} className="uppercase tracking-[.06em]">
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & Cập Nhật'}
          </Button>
        </div>
        {saveState === 'saved' && <div className="mt-1.5 text-xs font-semibold text-success">✓ Đã lưu — Cloud Function sẽ tự tính lại toàn bộ giá thành</div>}
        {saveState === 'error' && <div className="mt-1.5 text-xs text-destructive">{saveError}</div>}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="h-3.5 w-[3px] shrink-0 rounded-sm bg-primary" />
        <div className="text-eyebrow font-bold uppercase tracking-[.12em] text-foreground">Tham số theo từng nguyên liệu</div>
      </div>

      {form.materials.map((m) => {
        const lockEntry = internal.priceLock.byMaterial.find((e) => e.materialId === m.id);
        const isLocked = lockEntry?.evaluation.isLocked ?? true;
        return (
          <Card key={m.id} className="mb-3.5 overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b bg-muted px-4 py-3">
              <div>
                <div className="text-[13px] font-bold text-foreground">{m.name}</div>
                <div className="mt-0.5 text-eyebrow text-muted-foreground">{m.code} · {m.originLabel}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isLocked ? 'success' : 'destructive'}>{isLocked ? 'KHÓA' : 'MỞ KHÓA'}</Badge>
                {!isLocked && (
                  <Button size="sm" onClick={() => chotBaseline(m.id)} className="uppercase tracking-[.04em]">
                    Chốt Baseline Mới
                  </Button>
                )}
              </div>
            </div>
            <div className="p-4">
              {lockEntry && (
                <div className="mb-3 text-xs text-muted-foreground">
                  Lệch vs baseline: <b className={cn('tabular-nums', isLocked ? 'text-success' : 'text-destructive')}>{fmtPct(lockEntry.evaluation.deviationPct)}</b>
                  {lockEntry.evaluation.stalenessWarning && <span> · ⚠ {lockEntry.evaluation.stalenessWarning}</span>}
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {numField('Giá tái tạo (thị trường)', m.inventory.replacementPriceUsdPerKg, (v) => updateReplacement(m.id, v), { unit: 'USD/kg' })}
                {numField('Baseline khóa giá', m.inventory.priceLock.baseline, (v) => updateBaseline(m.id, v), { unit: 'USD/kg' })}
                {numField('Ngưỡng khóa', m.inventory.priceLock.thresholdPct, (v) => updateThreshold(m.id, v), { unit: 'tỷ lệ (0,03=3%)', locked: !isAdmin })}
                {numField('Markup VF', m.markupVf, (v) => updateMaterialField(m.id, 'markupVf', v), { unit: 'tỷ lệ' })}
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-3">
                {numField('Thuế nhập khẩu', m.importTaxRate, (v) => updateMaterialField(m.id, 'importTaxRate', v), { unit: 'tỷ lệ' })}
                {numField('Phí logistics/hải quan', m.customsLogisticsFeeRate, (v) => updateMaterialField(m.id, 'customsLogisticsFeeRate', v), { unit: 'tỷ lệ' })}
              </div>
            </div>
          </Card>
        );
      })}

      <div className="mb-3 mt-6 flex items-center gap-2">
        <div className="h-3.5 w-[3px] shrink-0 rounded-sm bg-primary" />
        <div className="text-eyebrow font-bold uppercase tracking-[.12em] text-foreground">Ngưỡng khóa giá ren kim loại</div>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {['Loại ren', 'Size PT', 'Baseline', 'Ngưỡng (%)'].map((h, i) => (
                <TableHead key={h} className={cn(i < 2 ? 'text-left' : 'text-right')}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.inventory.metalInsert.map((entry) => {
              const key = `${entry.renType}|${entry.ptSize}`;
              return (
                <TableRow key={key}>
                  <TableCell className="text-xs text-foreground">Ren {entry.renType}</TableCell>
                  <TableCell className="text-xs text-foreground">PT {entry.ptSize}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-foreground">{fmtVnd(entry.priceLock.baseline)} đ</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.priceLock.thresholdPct}
                      disabled={!isAdmin}
                      onChange={(e) => updateInsertThreshold(key, parseFloat(e.target.value) || 0)}
                      className="h-8 w-[70px] px-2 text-right text-xs tabular-nums disabled:bg-muted"
                    />{' '}
                    {!isAdmin && <span className="text-[10px] opacity-75">🔒</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 rounded-md border bg-muted px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Đánh giá khóa bảng giá (KHÓA/MỞ KHÓA, % lệch, cảnh báo staleness) lấy THẲNG từ <code className="rounded bg-card px-1">outputs/internal.priceLock</code> — không tính lại ở client
        (ADR-004, luật "client không lắp lại công thức engine"). Trường thuế/phí/markup có thể khác giữa các nguyên liệu (BlazeMaster EU 6% vs Corzan AIFTA 0%).
      </div>
    </div>
  );
}
