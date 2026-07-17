import { useState, useMemo } from 'react';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { calculateScenario } from '../../engine/scenario.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import { calculateMachineHoursPerUnit } from '../../engine/price-ladder.js';
import type { MachineHourResource } from '../../schemas/resource.js';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  // Hook PHẢI gọi vô điều kiện, TRƯỚC mọi early-return (rules-of-hooks) — nếu để
  // sau `if (!scenario) return` thì lúc dữ liệu tải xong số hook đổi → React ném lỗi.
  const [activeTab, setActiveTab] = useState<'pipe' | 'fitting'>('pipe');

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

  return (
    <div>
      <TabsList className="mb-6">
        {[
          { id: 'pipe', label: 'ỐNG CPVC' },
          { id: 'fitting', label: 'PHỤ KIỆN' },
        ].map((t) => (
          <TabsTrigger
            key={t.id}
            active={activeTab === t.id}
            onClick={() => setActiveTab(t.id as any)}
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {activeTab === 'pipe' && (
        <>
          <Card className="mb-6 p-4">
            <div className="mb-3 text-eyebrow font-bold uppercase tracking-[.06em] text-foreground">
              So Sánh Năng Suất & Chi Phí Ống CPVC Theo Ca
            </div>

            <div className="overflow-x-auto">
              <Table className="text-right text-xs tabular-nums">
                <TableHeader>
                  <TableRow>
                    <TableHead>Chỉ tiêu</TableHead>
                    {pipeSimulations.map(sim => (
                      <TableHead key={sim.shifts} className={cn('text-right', sim.shifts === 3 ? 'text-success' : 'text-foreground')}>
                        Chạy {sim.shifts} Ca{sim.shifts === 3 ? ' (Bình thường)' : ''}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-left font-semibold">Sản lượng (kg/năm)</TableCell>
                    {pipeSimulations.map(sim => (
                      <TableCell key={sim.shifts} className="font-semibold">{sim.output ? fmtVnd(sim.output.capacity.pipe.normalCapacityKgYear) : '—'}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="border-dashed text-muted-foreground">
                    <TableCell className="pl-6 text-left">Khấu hao & Phân bổ chung (định phí)</TableCell>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.fixedCostPerYear || 0;
                      return <TableCell key={sim.shifts}>{fmtVnd(cost)} đ</TableCell>;
                    })}
                  </TableRow>
                  <TableRow className="border-dashed text-muted-foreground">
                    <TableCell className="pl-6 text-left">Biến phí tham chiếu (NVL, Điện nước/kg)</TableCell>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.variableCostPerKg || 0;
                      return <TableCell key={sim.shifts}>{fmtVnd(cost)} đ/kg</TableCell>;
                    })}
                  </TableRow>
                  <TableRow className="border-dashed font-semibold text-foreground">
                    <TableCell className="pl-6 text-left">Tổng giá thành (Full Cost/kg)</TableCell>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.priceLadder.byLineMaterial.find(c => c.line === 'pipe')?.ladder.breakEvenFullCost || 0;
                      return <TableCell key={sim.shifts}>{fmtVnd(cost)} đ/kg</TableCell>;
                    })}
                  </TableRow>
                  <TableRow className="bg-muted">
                    <TableCell className="text-left font-bold text-foreground">ĐIỂM HÒA VỐN TẠI MỨC CA NÀY</TableCell>
                    {pipeSimulations.map(sim => {
                      const bep = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.breakEvenKgYear || 0;
                      const cap = sim.output?.capacity.pipe.normalCapacityKgYear || 1;
                      const canBreakEven = cap >= bep;
                      return (
                        <TableCell key={sim.shifts}>
                          <div className="font-bold text-foreground">{fmtVnd(bep)} kg</div>
                          <div className={cn('mt-0.5 text-eyebrow', canBreakEven ? 'text-success' : 'text-destructive')}>
                            {canBreakEven ? `Đạt được (Cần ${fmtPct(bep/cap)} công suất)` : `⚠ LỖ CHẮC: Tối đa chỉ SX được ${fmtVnd(cap)} kg`}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-bold text-foreground">Bảng Phân Tích Chi Phí Từng Mã Ống CPVC (So sánh ca)</div>
            </div>

            <div className="overflow-x-auto">
              <Table className="text-right text-xs tabular-nums">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên SP / Kích Cỡ</TableHead>
                    {pipeSimulations.map(sim => (
                      <TableHead key={sim.shifts} className="text-right">
                        Giá Vốn 1m ({sim.shifts} Ca)
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipeProducts.map((p) => {
                    return (
                      <TableRow key={`${p.dn}-${p.materialId}`}>
                        <TableCell className="text-left font-medium">Ống CPVC DN{p.dn} - {p.spec}</TableCell>
                        {pipeSimulations.map(sim => {
                          const chainData = sim.output?.skuPriceChains.find(
                            c => 'dn' in c.productKey && c.productKey.dn === p.dn && c.productKey.materialId === p.materialId
                          )?.chain;
                          const cost = (chainData?.materialCostPerUnit || 0) + (chainData?.processingCostPerUnit || 0);
                          return (
                            <TableCell key={sim.shifts}>
                              {fmtVnd(cost)} đ
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
              <Table className="text-right text-xs tabular-nums">
                <TableHeader>
                  <TableRow>
                    <TableHead>Chỉ tiêu</TableHead>
                    {fittingSimulations.map(sim => (
                      <TableHead key={sim.util} className="text-right">
                        Huy động {fmtPct(sim.util)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-left font-semibold">Sản lượng ước tính (kg/năm)</TableCell>
                    {fittingSimulations.map(sim => (
                      <TableCell key={sim.util} className="font-semibold">{sim.output ? fmtVnd(sim.output.capacity.fitting.estimatedProductionKgYear) : '—'}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="border-dashed text-muted-foreground">
                    <TableCell className="pl-6 text-left">Giờ máy tiêu chuẩn</TableCell>
                    {fittingSimulations.map(sim => (
                       <TableCell key={sim.util}>{sim.output ? fmtVnd(sim.output.capacity.fitting.normalMachineHoursUtilized) : '—'} giờ</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="border-dashed text-muted-foreground">
                    <TableCell className="pl-6 text-left">Đơn giá MHR (đ/giờ máy)</TableCell>
                    {fittingSimulations.map(sim => (
                       <TableCell key={sim.util}>{sim.output ? fmtVnd(sim.output.mhrPerMachineHour) : '—'} đ</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted">
                    <TableCell className="text-left font-bold text-foreground">ĐIỂM HÒA VỐN GIỜ MÁY</TableCell>
                    {fittingSimulations.map(sim => {
                      const bep = sim.output?.cvp.byLineMaterial.find(c => c.line === 'fitting')?.breakEvenMachineHours || 0;
                      const cap = sim.output?.capacity.fitting.normalMachineHoursUtilized || 1;
                      const canBreakEven = cap >= bep;
                      return (
                        <TableCell key={sim.util}>
                          <div className="font-bold text-foreground">{fmtVnd(bep)} giờ</div>
                          <div className={cn('mt-0.5 text-eyebrow', canBreakEven ? 'text-success' : 'text-destructive')}>
                            {canBreakEven ? `Đạt được (Cần ${fmtPct(bep/cap)} công suất)` : `⚠ LỖ CHẮC: Tối đa chỉ có ${fmtVnd(cap)} giờ`}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-bold text-foreground">Bảng Phân Tích Chi Phí Từng Mã Phụ Kiện (So sánh MHR)</div>
            </div>

            <div className="overflow-x-auto">
              <Table className="text-right text-xs tabular-nums">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên SP / Kích Cỡ</TableHead>
                    <TableHead className="text-right">Giờ Máy/SP</TableHead>
                    {fittingSimulations.map(sim => (
                      <TableHead key={sim.util} className="text-right">
                        Giá Vốn 1 SP ({fmtPct(sim.util)})
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fittingProducts.map((p) => {
                    const machineHours = calculateMachineHoursPerUnit(
                      p.cycleTimeSec || 0,
                      p.cavity || 1,
                      fittingResource.yieldRate
                    );

                    return (
                      <TableRow key={`${p.productName}-${p.sizeLabel}`}>
                        <TableCell className="text-left font-medium">{p.productName} - {p.sizeLabel}</TableCell>
                        <TableCell>{machineHours.toFixed(5)}</TableCell>
                        {fittingSimulations.map(sim => {
                          const chainData = sim.output?.skuPriceChains.find(
                            c => 'productName' in c.productKey && c.productKey.productName === p.productName && c.productKey.sizeLabel === p.sizeLabel
                          )?.chain;
                          const cost = (chainData?.materialCostPerUnit || 0) + (chainData?.processingCostPerUnit || 0);
                          return (
                            <TableCell key={sim.util}>
                              {fmtVnd(cost)} đ
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
