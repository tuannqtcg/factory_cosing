import { useState, useMemo } from 'react';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { calculateScenario } from '../../engine/scenario.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import { calculateMachineHoursPerUnit } from '../../engine/price-ladder.js';
import type { MachineHourResource } from '../../schemas/resource.js';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function WhatIfScreen({
  scenarioId,
  scenario,
  internal,
}: {
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
}) {
  const pipeSimulations = useMemo(() => {
    if (!scenario) return [];
    return [1, 2, 3].map(shifts => {
      try {
        const clonedInput = JSON.parse(JSON.stringify(scenario)) as ScenarioInput;
        if (clonedInput.resources.pipe.driverType === 'continuous_kg') {
          clonedInput.resources.pipe.normalShifts = shifts;
        }
        return { shifts, output: calculateScenario(clonedInput) };
      } catch (e) {
        return { shifts, output: null };
      }
    });
  }, [scenario]);

  const fittingUtils = [0.4, 0.6, 0.85, 1.0];
  const fittingSimulations = useMemo(() => {
    if (!scenario) return [];
    return fittingUtils.map(util => {
      try {
        const clonedInput = JSON.parse(JSON.stringify(scenario)) as ScenarioInput;
        if (clonedInput.resources.fitting.driverType === 'machine_hour') {
          clonedInput.resources.fitting.normalUtilizationFactor = util;
        }
        return { util, output: calculateScenario(clonedInput) };
      } catch (e) {
        return { util, output: null };
      }
    });
  }, [scenario]);

  if (!scenario || !internal || pipeSimulations.length === 0) {
    return <div className="text-xs text-muted-foreground">Đang tải dữ liệu mô phỏng...</div>;
  }

  const fittingResource = scenario.resources.fitting as MachineHourResource;
  const fittingProducts = scenario.products.filter(p => p.kind === 'fitting');
  const pipeProducts = scenario.products.filter(p => p.kind === 'pipe');

  const [activeTab, setActiveTab] = useState<'pipe' | 'fitting'>('pipe');

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-border">
        {[
          { id: 'pipe', label: 'ỐNG CPVC' },
          { id: 'fitting', label: 'PHỤ KIỆN' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-xs font-bold uppercase tracking-[.06em] transition-colors',
              activeTab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'pipe' && (
        <>
          <Card className="mb-6 p-4">
            <div className="mb-3 text-eyebrow font-bold uppercase tracking-[.06em] text-foreground">
              So Sánh Năng Suất & Chi Phí Ống CPVC Theo Ca
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs tabular-nums">
                <thead>
                  <tr className="bg-muted text-eyebrow uppercase text-muted-foreground">
                    <th className="border-b px-3 py-2 text-left">Chỉ tiêu</th>
                    {pipeSimulations.map(sim => (
                      <th key={sim.shifts} className={cn('border-b px-3 py-2', sim.shifts === 3 ? 'text-success' : 'text-foreground')}>
                        Chạy {sim.shifts} Ca{sim.shifts === 3 ? ' (Bình thường)' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-3 py-2 text-left font-semibold">Sản lượng (kg/năm)</td>
                    {pipeSimulations.map(sim => (
                      <td key={sim.shifts} className="px-3 py-2 font-semibold">{sim.output ? fmtVnd(sim.output.capacity.pipe.normalCapacityKgYear) : '—'}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-dashed text-muted-foreground">
                    <td className="px-3 py-2 pl-6 text-left">Khấu hao & Phân bổ chung (định phí)</td>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.fixedCostPerYear || 0;
                      return <td key={sim.shifts} className="px-3 py-2">{fmtVnd(cost)} đ</td>;
                    })}
                  </tr>
                  <tr className="border-b border-dashed text-muted-foreground">
                    <td className="px-3 py-2 pl-6 text-left">Biến phí tham chiếu (NVL, Điện nước/kg)</td>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.variableCostPerKg || 0;
                      return <td key={sim.shifts} className="px-3 py-2">{fmtVnd(cost)} đ/kg</td>;
                    })}
                  </tr>
                  <tr className="border-b border-dashed font-semibold text-foreground">
                    <td className="px-3 py-2 pl-6 text-left">Tổng giá thành (Full Cost/kg)</td>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.priceLadder.byLineMaterial.find(c => c.line === 'pipe')?.ladder.breakEvenFullCost || 0;
                      return <td key={sim.shifts} className="px-3 py-2">{fmtVnd(cost)} đ/kg</td>;
                    })}
                  </tr>
                  <tr className="border-b bg-muted">
                    <td className="px-3 py-2 text-left font-bold text-foreground">ĐIỂM HÒA VỐN TẠI MỨC CA NÀY</td>
                    {pipeSimulations.map(sim => {
                      const bep = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.breakEvenKgYear || 0;
                      const cap = sim.output?.capacity.pipe.normalCapacityKgYear || 1;
                      const canBreakEven = cap >= bep;
                      return (
                        <td key={sim.shifts} className="px-3 py-2">
                          <div className="font-bold text-foreground">{fmtVnd(bep)} kg</div>
                          <div className={cn('mt-0.5 text-eyebrow', canBreakEven ? 'text-success' : 'text-destructive')}>
                            {canBreakEven ? `Đạt được (Cần ${fmtPct(bep/cap)} công suất)` : `⚠ LỖ CHẮC: Tối đa chỉ SX được ${fmtVnd(cap)} kg`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-bold text-foreground">Bảng Phân Tích Chi Phí Từng Mã Ống CPVC (So sánh ca)</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs tabular-nums">
                <thead>
                  <tr className="bg-muted text-eyebrow uppercase text-muted-foreground">
                    <th className="border-b px-3 py-2 text-left">Tên SP / Kích Cỡ</th>
                    {pipeSimulations.map(sim => (
                      <th key={sim.shifts} className="border-b px-3 py-2">
                        Giá Vốn 1m ({sim.shifts} Ca)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipeProducts.map((p) => {
                    return (
                      <tr key={`${p.dn}-${p.materialId}`} className="border-b">
                        <td className="px-3 py-2 text-left font-medium">Ống CPVC DN{p.dn} - {p.spec}</td>
                        {pipeSimulations.map(sim => {
                          const chainData = sim.output?.skuPriceChains.find(
                            c => 'dn' in c.productKey && c.productKey.dn === p.dn && c.productKey.materialId === p.materialId
                          )?.chain;
                          const cost = (chainData?.materialCostPerUnit || 0) + (chainData?.processingCostPerUnit || 0);
                          return (
                            <td key={sim.shifts} className="px-3 py-2">
                              {fmtVnd(cost)} đ
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'fitting' && (
        <>
          <Card className="mb-6 p-4">
            <div className="mb-3 text-eyebrow font-bold uppercase tracking-[.06em] text-foreground">
              So Sánh Năng Suất & Chi Phí Phụ Kiện Theo Mức Huy Động
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs tabular-nums">
                <thead>
                  <tr className="bg-muted text-eyebrow uppercase text-muted-foreground">
                    <th className="border-b px-3 py-2 text-left">Chỉ tiêu</th>
                    {fittingSimulations.map(sim => (
                      <th key={sim.util} className="border-b px-3 py-2">
                        Huy động {fmtPct(sim.util)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-3 py-2 text-left font-semibold">Sản lượng ước tính (kg/năm)</td>
                    {fittingSimulations.map(sim => (
                      <td key={sim.util} className="px-3 py-2 font-semibold">{sim.output ? fmtVnd(sim.output.capacity.fitting.estimatedProductionKgYear) : '—'}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-dashed text-muted-foreground">
                    <td className="px-3 py-2 pl-6 text-left">Giờ máy tiêu chuẩn</td>
                    {fittingSimulations.map(sim => (
                       <td key={sim.util} className="px-3 py-2">{sim.output ? fmtVnd(sim.output.capacity.fitting.normalMachineHoursUtilized) : '—'} giờ</td>
                    ))}
                  </tr>
                  <tr className="border-b border-dashed text-muted-foreground">
                    <td className="px-3 py-2 pl-6 text-left">Đơn giá MHR (đ/giờ máy)</td>
                    {fittingSimulations.map(sim => (
                       <td key={sim.util} className="px-3 py-2">{sim.output ? fmtVnd(sim.output.mhrPerMachineHour) : '—'} đ</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted">
                    <td className="px-3 py-2 text-left font-bold text-foreground">ĐIỂM HÒA VỐN GIỜ MÁY</td>
                    {fittingSimulations.map(sim => {
                      const bep = sim.output?.cvp.byLineMaterial.find(c => c.line === 'fitting')?.breakEvenMachineHours || 0;
                      const cap = sim.output?.capacity.fitting.normalMachineHoursUtilized || 1;
                      const canBreakEven = cap >= bep;
                      return (
                        <td key={sim.util} className="px-3 py-2">
                          <div className="font-bold text-foreground">{fmtVnd(bep)} giờ</div>
                          <div className={cn('mt-0.5 text-eyebrow', canBreakEven ? 'text-success' : 'text-destructive')}>
                            {canBreakEven ? `Đạt được (Cần ${fmtPct(bep/cap)} công suất)` : `⚠ LỖ CHẮC: Tối đa chỉ có ${fmtVnd(cap)} giờ`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-bold text-foreground">Bảng Phân Tích Chi Phí Từng Mã Phụ Kiện (So sánh MHR)</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs tabular-nums">
                <thead>
                  <tr className="bg-muted text-eyebrow uppercase text-muted-foreground">
                    <th className="border-b px-3 py-2 text-left">Tên SP / Kích Cỡ</th>
                    <th className="border-b px-3 py-2">Giờ Máy/SP</th>
                    {fittingSimulations.map(sim => (
                      <th key={sim.util} className="border-b px-3 py-2">
                        Giá Vốn 1 SP ({fmtPct(sim.util)})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fittingProducts.map((p) => {
                    const machineHours = calculateMachineHoursPerUnit(
                      p.cycleTimeSec || 0,
                      p.cavity || 1,
                      fittingResource.yieldRate
                    );

                    return (
                      <tr key={`${p.productName}-${p.sizeLabel}`} className="border-b">
                        <td className="px-3 py-2 text-left font-medium">{p.productName} - {p.sizeLabel}</td>
                        <td className="px-3 py-2">{machineHours.toFixed(5)}</td>
                        {fittingSimulations.map(sim => {
                          const chainData = sim.output?.skuPriceChains.find(
                            c => 'productName' in c.productKey && c.productKey.productName === p.productName && c.productKey.sizeLabel === p.sizeLabel
                          )?.chain;
                          const cost = (chainData?.materialCostPerUnit || 0) + (chainData?.processingCostPerUnit || 0);
                          return (
                            <td key={sim.util} className="px-3 py-2">
                              {fmtVnd(cost)} đ
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
