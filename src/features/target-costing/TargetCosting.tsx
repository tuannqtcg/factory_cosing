// M12.8 — màn hình Định Giá Ngược (Target Costing, vai pricing/admin), dựng
// đúng mockup Pha 1 đã duyệt (2026-07-09): 2 chế độ T2 (lợi nhuận mục tiêu,
// dạng đóng) / T3 (giá bán mục tiêu, bisection theo SKU). Khác mockup (số
// tuyến tính minh họa trên client) — MỌI kết quả ở đây là số THẬT từ HTTPS
// Callable `computeTargetCosting` (M12.4c, ADR-013) chạy `solve()`/
// `solveTargetProfit()` trên `calculateScenario()` thật; client KHÔNG lắp lại
// công thức engine (đúng ranh giới đã giữ ở Plan/PriceList).
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button/Badge/Segmented),
// KHÔNG inline-style hardcode. Logic/props/interface/exports giữ NGUYÊN; màu CHỈ
// dành cho DỮ LIỆU/trạng thái (khả thi/không khả thi), chrome = đen–trắng–xám.
import { useMemo, useState } from 'react';
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import type { AppRole } from '../../lib/firebase.js';
import type { ScenarioInput, ScenarioOutput, TargetProfitResult, TargetPriceResult } from '../../schemas/scenario.js';
import { referenceMaterialOf } from '../../engine/scenario.js';
import { useTargetCosting } from './useTargetCosting.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Line = 'pipe' | 'fitting';

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-3.5 w-[3px] shrink-0 rounded-sm bg-foreground" />
      <div className="text-eyebrow font-semibold uppercase tracking-[.1em] text-foreground">{title}</div>
      {note && <div className="ml-1 text-eyebrow text-muted-foreground">{note}</div>}
    </div>
  );
}

// ── Allowlist biến dò T3 hiển thị (ADR-013 mục 3) — path build khớp
//    TARGET_PRICE_FREE_VARS trong src/engine/target-costing.ts ─────────────
type FreeVarKind = 'compound' | 'utilization' | 'markupVf' | 'markupTcg' | 'listPriceMargin';
const FREE_VAR_DEFS: Array<{ id: FreeVarKind; label: string; lineFilter?: Line; needsMaterialIndex?: boolean }> = [
  { id: 'utilization', label: 'Mức huy động công suất PK', lineFilter: 'fitting' },
  { id: 'compound', label: 'Giá compound (USD/kg)', needsMaterialIndex: true },
  { id: 'markupVf', label: 'Markup VF theo nguyên liệu', needsMaterialIndex: true },
  { id: 'markupTcg', label: 'Markup TCG' },
  { id: 'listPriceMargin', label: 'Biên giá niêm yết' },
];
function buildFreeVarPath(kind: FreeVarKind, materialIndex: number): string {
  switch (kind) {
    case 'utilization':
      return 'resources.fitting.normalUtilizationFactor';
    case 'compound':
      return `materials.${materialIndex}.inventory.replacementPriceUsdPerKg`;
    case 'markupVf':
      return `materials.${materialIndex}.markupVf`;
    case 'markupTcg':
      return 'costPool.markup.markupTcg';
    case 'listPriceMargin':
      return 'costPool.markup.listPriceMargin';
  }
}
function fmtFreeVarValue(kind: FreeVarKind, v: number): string {
  return kind === 'compound' ? `${fmtUsd(v)} USD/kg` : fmtPct(v);
}

export default function TargetCosting({
  role,
  scenarioId,
  scenario,
  internal,
}: {
  role: AppRole;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
}) {
  // ADR-026 — bỏ guard "chỉ dành cho vai X": chỉ admin/pricing đăng nhập được (ADR-023).
  const { lastDoc, runTargetProfit, runTargetPrice } = useTargetCosting(scenarioId, role);

  const [mode, setMode] = useState<'t2' | 't3'>('t2');

  // ── T2 state ───────────────────────────────────────────────────────────
  const [t2Line, setT2Line] = useState<Line>('pipe');
  const [t2MaterialId, setT2MaterialId] = useState<string | null>(null); // null = tham chiếu
  const [t2ProfitVnd, setT2ProfitVnd] = useState(0);
  const [t2Result, setT2Result] = useState<TargetProfitResult | null>(null);
  const [t2Loading, setT2Loading] = useState(false);
  const [t2Error, setT2Error] = useState<string | null>(null);

  // ── T3 state ───────────────────────────────────────────────────────────
  const [t3Line, setT3Line] = useState<Line>('pipe');
  const [t3SkuKey, setT3SkuKey] = useState<string | null>(null); // key = index trong danh sách filter bên dưới
  const [t3FreeVar, setT3FreeVar] = useState<FreeVarKind>('compound');
  const [t3Penetration, setT3Penetration] = useState(false);
  const [t3TargetVnd, setT3TargetVnd] = useState(260000);
  const [t3Result, setT3Result] = useState<TargetPriceResult | null>(null);
  const [t3Loading, setT3Loading] = useState(false);
  const [t3Error, setT3Error] = useState<string | null>(null);

  const t2Materials = useMemo(
    () => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === t2Line && p.materialId === m.id)) : []),
    [scenario, t2Line],
  );

  const t3Skus = useMemo(() => {
    if (!internal) return [];
    const activeChains = internal.skuPriceChains.filter((s) => s.managementStatus === 'active');
    return activeChains.filter((s) => (t3Line === 'pipe' ? s.productKey.dn !== undefined : s.productKey.productName !== undefined));
  }, [internal, t3Line]);
  const t3ShowMaterial = useMemo(() => new Set(t3Skus.map((s) => s.productKey.materialId)).size > 1, [t3Skus]);
  const t3SelectedSku = t3Skus.find((s, i) => (t3SkuKey ?? '0') === String(i)) ?? t3Skus[0] ?? null;
  const t3MaterialIndex = scenario && t3SelectedSku ? scenario.materials.findIndex((m) => m.id === t3SelectedSku.productKey.materialId) : -1;
  const t3AvailableFreeVars = FREE_VAR_DEFS.filter((f) => !f.lineFilter || f.lineFilter === t3Line);

  if (!scenario || !internal) {
    return <div className="px-9 py-8 text-xs text-muted-foreground">Đang tải kịch bản + kết quả tính…</div>;
  }

  const handleT2Submit = async () => {
    setT2Loading(true);
    setT2Error(null);
    try {
      const result = await runTargetProfit({
        scenarioId,
        productLine: t2Line,
        targetProfitVnd: t2ProfitVnd,
        // Callable JSON-encode biến `undefined` thành `null` — chỉ đưa field
        // vào object khi CÓ chọn (bỏ trống thật sự = không có key, đúng ngữ
        // nghĩa "materialId optional" của TargetProfitRequestSchema).
        ...(t2MaterialId ? { materialId: t2MaterialId } : {}),
      });
      setT2Result(result);
    } catch (err) {
      setT2Error(err instanceof Error ? err.message : String(err));
      setT2Result(null);
    } finally {
      setT2Loading(false);
    }
  };

  const handleT3Submit = async () => {
    if (!t3SelectedSku || t3MaterialIndex < 0) return;
    setT3Loading(true);
    setT3Error(null);
    try {
      const productKey =
        t3Line === 'pipe'
          ? { dn: t3SelectedSku.productKey.dn, materialId: t3SelectedSku.productKey.materialId }
          : { productName: t3SelectedSku.productKey.productName, sizeLabel: t3SelectedSku.productKey.sizeLabel, materialId: t3SelectedSku.productKey.materialId };
      const result = await runTargetPrice({
        scenarioId,
        productLine: t3Line,
        targetListPriceVnd: t3TargetVnd,
        freeVarPath: buildFreeVarPath(t3FreeVar, t3MaterialIndex),
        isPenetrationPrice: t3Penetration,
        productKey,
      });
      setT3Result(result);
    } catch (err) {
      setT3Error(err instanceof Error ? err.message : String(err));
      setT3Result(null);
    } finally {
      setT3Loading(false);
    }
  };

  const t2ResolvedMaterialName =
    (t2MaterialId ? t2Materials.find((m) => m.id === t2MaterialId) : referenceMaterialOf(scenario.materials, scenario.products, t2Line))
      ?.name ?? '—';
  const t2UnitLabel = t2Line === 'pipe' ? 'kg/năm' : 'giờ máy/năm';
  const t2Capacity = t2Line === 'pipe' ? internal.capacity.pipe.normalCapacityKgYear : internal.capacity.fitting.normalMachineHoursUtilized;
  const t2Cvp = internal.cvp.byLineMaterial.find(
    (e) => e.line === t2Line && e.materialId === (t2MaterialId ?? referenceMaterialOf(scenario.materials, scenario.products, t2Line)?.id),
  );

  const t3SkuLabel = (s: (typeof t3Skus)[number]) =>
    t3Line === 'pipe' ? s.productKey.dn! : `${s.productKey.productName} ${s.productKey.sizeLabel}`;

  const fieldLabelCls = 'mb-1.5 block text-eyebrow font-semibold uppercase tracking-[.06em] text-faint';

  return (
    <div className="px-9 py-8">
      <div className="mb-2">
        <div className="text-eyebrow uppercase tracking-[.14em] text-faint">Hoạch Định Chiến Lược · Tầng Top-Down</div>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Định Giá Ngược — Target Costing</h1>
        <p className="mt-1 max-w-[720px] text-xs leading-relaxed text-muted-foreground">
          Nhập MỤC TIÊU (lợi nhuận kỳ vọng hoặc giá bán bị ép từ thị trường) → hệ thống giải ngược biến vận hành cần đạt
          bằng inverse solver (ADR-005) chạy XUÔI trên engine thật — mọi nghiệm đều được xác nhận lại bằng forward-verify.
        </p>
      </div>

      {lastDoc && (
        <div className="mb-1 mt-3.5 rounded-md border bg-muted px-3 py-2 text-eyebrow text-muted-foreground">
          Lần chạy gần nhất: {lastDoc.kind === 'targetProfit' ? 'T2 · Lợi nhuận mục tiêu' : 'T3 · Giá bán mục tiêu'} —{' '}
          {lastDoc.kind === 'targetProfit'
            ? `dòng ${lastDoc.request.productLine === 'pipe' ? 'Ống' : 'Phụ kiện'}, mục tiêu ${fmtVnd(lastDoc.request.targetProfitVnd)} đ`
            : lastDoc.result.feasible
              ? `mục tiêu ${fmtVnd(lastDoc.request.targetListPriceVnd)} đ, khả thi`
              : `mục tiêu ${fmtVnd(lastDoc.request.targetListPriceVnd)} đ, không khả thi`}
        </div>
      )}

      <Segmented
        className="my-4"
        options={[
          { id: 't2', label: 'T2 · Lợi Nhuận Mục Tiêu' },
          { id: 't3', label: 'T3 · Giá Bán Mục Tiêu' },
        ]}
        value={mode}
        onChange={(v) => setMode(v)}
      />

      {mode === 't2' && (
        <div>
          <SectionHeader title="Lợi nhuận mục tiêu → sản lượng cần đạt" note="Dạng đóng — CVP (M8), không cần bisection" />
          <Card className="grid grid-cols-[280px_1fr] overflow-hidden p-0">
            <div className="border-r bg-muted p-5">
              <label className="mb-3.5 block">
                <span className={fieldLabelCls}>Dòng sản phẩm</span>
                <Segmented
                  options={[
                    { id: 'pipe', label: 'Ống CPVC' },
                    { id: 'fitting', label: 'Phụ Kiện' },
                  ]}
                  value={t2Line}
                  onChange={(v) => { setT2Line(v); setT2MaterialId(null); }}
                />
              </label>
              {t2Materials.length > 1 && (
                <label className="mb-3.5 block">
                  <span className={fieldLabelCls}>Nguyên liệu (bỏ trống = tham chiếu)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {t2Materials.map((m) => (
                      <Button
                        key={m.id}
                        variant={t2MaterialId === m.id ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setT2MaterialId(m.id)}
                      >
                        {m.name}
                      </Button>
                    ))}
                  </div>
                </label>
              )}
              <label className="mb-3.5 block">
                <span className={fieldLabelCls}>Lợi nhuận mục tiêu (đ/năm)</span>
                <Input
                  type="number"
                  value={t2ProfitVnd}
                  step={100000000}
                  onChange={(e) => setT2ProfitVnd(parseFloat(e.target.value) || 0)}
                  className="text-right font-semibold tabular-nums"
                />
                <div className="mt-1 text-eyebrow text-muted-foreground">0 = tìm đúng sản lượng hòa vốn.</div>
              </label>
              <Button
                onClick={() => void handleT2Submit()}
                disabled={t2Loading}
                className="w-full uppercase tracking-[.04em]"
              >
                {t2Loading ? 'Đang tính…' : 'Tính'}
              </Button>
              {t2Error && <div className="mt-2.5 text-eyebrow text-destructive">{t2Error}</div>}
            </div>
            <div>
              {!t2Result && !t2Loading && (
                <div className="px-6 py-16 text-center text-xs text-faint">Nhập lợi nhuận mục tiêu rồi bấm "Tính".</div>
              )}
              {t2Loading && <div className="px-6 py-16 text-center text-xs text-muted-foreground">Đang tính CVP…</div>}
              {t2Result && !t2Loading && (
                <>
                  <div className="grid grid-cols-3">
                    <div className="border-r p-4">
                      <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-faint">Sản lượng cần đạt</div>
                      <div className="text-xl font-bold tabular-nums text-foreground">{fmtVnd(t2Result.requiredQtyKgOrMachineHours)}</div>
                      <div className="mt-1 text-eyebrow text-muted-foreground">{t2UnitLabel} · nguyên liệu {t2ResolvedMaterialName}</div>
                    </div>
                    <div className="border-r p-4">
                      <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-faint">Số ca cần</div>
                      <div className="text-xl font-bold tabular-nums text-foreground">
                        {t2Result.requiredShifts.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ca
                      </div>
                      <div className="mt-1 text-eyebrow text-muted-foreground">CS bình thường {fmtVnd(t2Capacity)} {t2UnitLabel} tại 3 ca</div>
                    </div>
                    <div className="p-4">
                      <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-faint">Q hòa vốn (lợi nhuận=0)</div>
                      <div className="text-xl font-bold tabular-nums text-foreground">{t2Cvp ? fmtVnd(t2Cvp.breakEvenKgYear) : '—'}</div>
                      <div className="mt-1 text-eyebrow text-muted-foreground">kg/năm · số vàng CVP (M8)</div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'm-4 rounded-md border px-3.5 py-2.5 text-xs font-bold',
                      t2Result.feasibleWithinNormalCapacity
                        ? 'border-success/25 bg-success-tint text-success'
                        : 'border-destructive/25 bg-destructive-tint text-destructive',
                    )}
                  >
                    {t2Result.feasibleWithinNormalCapacity
                      ? 'KHẢ THI trong công suất bình thường'
                      : 'VƯỢT công suất bình thường — cần tăng ca / đầu tư thêm (đối chiếu Kế Hoạch SX)'}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {mode === 't3' && (
        <div>
          <SectionHeader title="Giá bán mục tiêu → biến vận hành cần đạt" note="Bisection trên forward function — nghiệm luôn forward-verify" />
          <Card className="grid grid-cols-[280px_1fr] overflow-hidden p-0">
            <div className="border-r bg-muted p-5">
              <label className="mb-3.5 block">
                <span className={fieldLabelCls}>Dòng sản phẩm</span>
                <Segmented
                  options={[
                    { id: 'pipe', label: 'Ống CPVC' },
                    { id: 'fitting', label: 'Phụ Kiện' },
                  ]}
                  value={t3Line}
                  onChange={(v) => { setT3Line(v); setT3SkuKey(null); setT3FreeVar('compound'); }}
                />
              </label>
              <label className="mb-3.5 block">
                <span className={fieldLabelCls}>Chọn SKU</span>
                <Select
                  value={t3SkuKey ?? '0'}
                  onChange={(e) => {
                    setT3SkuKey(e.target.value);
                    const sku = t3Skus[parseInt(e.target.value, 10)];
                    if (sku) setT3TargetVnd(sku.chain.listPriceBeforeVat);
                  }}
                >
                  {t3Skus.map((s, i) => (
                    <option key={`${t3SkuLabel(s)}|${s.productKey.materialId}`} value={i}>
                      {t3SkuLabel(s)}
                      {t3ShowMaterial ? ` · ${s.productKey.materialId}` : ''} — hiện tại {fmtVnd(s.chain.listPriceBeforeVat)} đ
                    </option>
                  ))}
                </Select>
              </label>
              <label className="mb-3.5 block">
                <span className={fieldLabelCls}>Biến dò (allowlist ADR-013)</span>
                <Select
                  value={t3FreeVar}
                  onChange={(e) => setT3FreeVar(e.target.value as FreeVarKind)}
                >
                  {t3AvailableFreeVars.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </Select>
              </label>
              <label className="mb-3.5 flex items-start gap-2 rounded-md border border-input bg-card px-2.5 py-2.5">
                <input type="checkbox" checked={t3Penetration} onChange={(e) => setT3Penetration(e.target.checked)} className="mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-foreground">Giá bị ép từ thị trường / đấu thầu</div>
                  <div className="mt-0.5 text-eyebrow leading-relaxed text-muted-foreground">Chỉ khác nguồn gốc mục tiêu — dùng chung 1 cơ chế giải ngược (ADR-013 mục 5).</div>
                </div>
              </label>
              <label className="mb-3.5 block">
                <span className={fieldLabelCls}>Giá niêm yết mục tiêu (đ, trước VAT)</span>
                <Input
                  type="number"
                  value={t3TargetVnd}
                  step={1000}
                  onChange={(e) => setT3TargetVnd(parseFloat(e.target.value) || 0)}
                  className="text-right font-semibold tabular-nums"
                />
              </label>
              <Button
                onClick={() => void handleT3Submit()}
                disabled={t3Loading || !t3SelectedSku}
                className="w-full uppercase tracking-[.04em]"
              >
                {t3Loading ? 'Đang giải ngược…' : 'Giải ngược'}
              </Button>
              {t3Error && <div className="mt-2.5 text-eyebrow text-destructive">{t3Error}</div>}
            </div>
            <div>
              {!t3Result && !t3Loading && (
                <div className="px-6 py-16 text-center text-xs text-faint">Chọn SKU + biến dò rồi bấm "Giải ngược".</div>
              )}
              {t3Loading && <div className="px-6 py-16 text-center text-xs text-muted-foreground">Đang giải ngược (bisection trên engine thật)…</div>}
              {t3Result && !t3Loading && t3SelectedSku && (
                t3Result.feasible ? (
                  <>
                    <div className="m-4 rounded-md border border-success/25 bg-success-tint px-3.5 py-2.5 text-xs font-bold text-success">
                      KHẢ THI — nghiệm hội tụ trong dải cho phép
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="border-r px-4 pb-4">
                        <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-faint">{FREE_VAR_DEFS.find((f) => f.id === t3FreeVar)?.label}</div>
                        <div className="text-xl font-bold tabular-nums text-foreground">{fmtFreeVarValue(t3FreeVar, t3Result.value)}</div>
                      </div>
                      <div className="px-4 pb-4">
                        <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-faint">Giá niêm yết mục tiêu</div>
                        <div className="text-xl font-bold tabular-nums text-foreground">{fmtVnd(t3TargetVnd)} đ</div>
                      </div>
                    </div>
                    <div className="mx-4 mb-4 rounded-md border border-dashed border-input bg-muted p-3.5">
                      <div className="mb-2.5 text-eyebrow font-semibold uppercase tracking-[.08em] text-faint">
                        ✓ Forward-verify — chạy XUÔI lại calculateScenario() với nghiệm vừa tìm
                      </div>
                      {(() => {
                        const verifySku = t3Result.forwardOutput.skuPriceChains.find(
                          (s) =>
                            s.productKey.materialId === t3SelectedSku.productKey.materialId &&
                            (t3Line === 'pipe' ? s.productKey.dn === t3SelectedSku.productKey.dn : s.productKey.productName === t3SelectedSku.productKey.productName && s.productKey.sizeLabel === t3SelectedSku.productKey.sizeLabel),
                        );
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 text-eyebrow">
                            <div className="rounded-md border border-input bg-card px-2.5 py-1.5">
                              <div className="text-eyebrow uppercase text-faint">Biến đã set</div>
                              <div className="mt-px font-bold tabular-nums text-foreground">{fmtFreeVarValue(t3FreeVar, t3Result.value)}</div>
                            </div>
                            <span className="text-faint">→</span>
                            <div className="rounded-md border border-success/25 bg-success-tint px-2.5 py-1.5">
                              <div className="text-eyebrow uppercase text-faint">listPriceBeforeVat ({t3SkuLabel(t3SelectedSku)})</div>
                              <div className="mt-px font-bold tabular-nums text-success">{verifySku ? fmtVnd(verifySku.chain.listPriceBeforeVat) : '—'} đ</div>
                            </div>
                            <span className="text-faint">=?</span>
                            <div className="rounded-md border border-input bg-card px-2.5 py-1.5">
                              <div className="text-eyebrow uppercase text-faint">Mục tiêu</div>
                              <div className="mt-px font-bold tabular-nums text-foreground">{fmtVnd(t3TargetVnd)} đ</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="m-4 rounded-md border border-destructive/25 bg-destructive-tint px-3.5 py-2.5 text-xs font-bold text-destructive">
                      KHÔNG KHẢ THI — mục tiêu ngoài dải đạt được của biến này
                    </div>
                    <div className="m-4 rounded-md border border-destructive/25 bg-destructive-tint px-3.5 py-2.5 text-xs text-destructive">
                      <b>Khoảng đạt được:</b> {fmtVnd(Math.min(...t3Result.achievableRange))} đ → {fmtVnd(Math.max(...t3Result.achievableRange))} đ.{' '}
                      {t3Result.reason}
                    </div>
                  </>
                )
              )}
            </div>
          </Card>
          <div className="mt-3 rounded-md border bg-muted px-2.5 py-2 text-eyebrow leading-relaxed text-muted-foreground">
            Biến nguyên "số ca" (<code className="rounded bg-background px-1 font-mono">shifts</code>) chưa vào allowlist v1 — hoãn tới khi có màn hình cần
            <code className="rounded bg-background px-1 font-mono"> solveDiscrete()</code> (ADR-013 cuối mục).
          </div>
        </div>
      )}
    </div>
  );
}
