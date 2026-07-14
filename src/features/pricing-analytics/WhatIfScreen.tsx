import { useState, useMemo } from 'react';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { calculateScenario } from '../../engine/scenario.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import { calculateMachineHoursPerUnit } from '../../engine/price-ladder.js';
import type { MachineHourResource } from '../../schemas/resource.js';

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

  // Hook phải đứng TRƯỚC mọi return sớm (Rules of Hooks) — đặt sau return
  // "Đang tải" sẽ crash khi scenario chuyển null → có dữ liệu (số hook đổi giữa 2 lần render).
  const [activeTab, setActiveTab] = useState<'pipe' | 'fitting'>('pipe');

  if (!scenario || !internal || pipeSimulations.length === 0) {
    return <div style={{ fontSize: 12, color: '#737373' }}>Đang tải dữ liệu mô phỏng...</div>;
  }

  const fittingResource = scenario.resources.fitting as MachineHourResource;
  const fittingProducts = scenario.products.filter(p => p.kind === 'fitting');
  const pipeProducts = scenario.products.filter(p => p.kind === 'pipe');

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #e5e5e5', marginBottom: 24 }}>
        {[
          { id: 'pipe', label: 'ỐNG CPVC' },
          { id: 'fitting', label: 'PHỤ KIỆN' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              background: 'none', border: 'none', padding: '0 0 12px 0',
              fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: activeTab === t.id ? '#a8003b' : '#737373',
              borderBottom: `2px solid ${activeTab === t.id ? '#a8003b' : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: -1
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'pipe' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #d8d8d8', padding: 16, borderRadius: 2, marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, color: '#a8003b' }}>
              So Sánh Năng Suất & Chi Phí Ống CPVC Theo Ca
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f5f5f3', color: '#555', textTransform: 'uppercase', fontSize: 9 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #d8d8d8' }}>Chỉ tiêu</th>
                    {pipeSimulations.map(sim => (
                      <th key={sim.shifts} style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8', color: sim.shifts === 3 ? '#16A34A' : '#1a1a1a' }}>
                        Chạy {sim.shifts} Ca{sim.shifts === 3 ? ' (Bình thường)' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Sản lượng (kg/năm)</td>
                    {pipeSimulations.map(sim => (
                      <td key={sim.shifts} style={{ padding: '8px 12px', fontWeight: 600 }}>{sim.output ? fmtVnd(sim.output.capacity.pipe.normalCapacityKgYear) : '—'}</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px dashed #f0f0f0', color: '#737373' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', paddingLeft: 24 }}>Khấu hao & Phân bổ chung (định phí)</td>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.fixedCostPerYear || 0;
                      return <td key={sim.shifts} style={{ padding: '8px 12px' }}>{fmtVnd(cost)} đ</td>;
                    })}
                  </tr>
                  <tr style={{ borderBottom: '1px dashed #f0f0f0', color: '#737373' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', paddingLeft: 24 }}>Biến phí tham chiếu (NVL, Điện nước/kg)</td>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.variableCostPerKg || 0;
                      return <td key={sim.shifts} style={{ padding: '8px 12px' }}>{fmtVnd(cost)} đ/kg</td>;
                    })}
                  </tr>
                  <tr style={{ borderBottom: '1px dashed #f0f0f0', color: '#1a1a1a', fontWeight: 600 }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', paddingLeft: 24 }}>Tổng giá thành (Full Cost/kg)</td>
                    {pipeSimulations.map(sim => {
                      const cost = sim.output?.priceLadder.byLineMaterial.find(c => c.line === 'pipe')?.ladder.breakEvenFullCost || 0;
                      return <td key={sim.shifts} style={{ padding: '8px 12px' }}>{fmtVnd(cost)} đ/kg</td>;
                    })}
                  </tr>
                  <tr style={{ borderBottom: '1px solid #d8d8d8', background: '#fdf2f8' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#a8003b' }}>ĐIỂM HÒA VỐN TẠI MỨC CA NÀY</td>
                    {pipeSimulations.map(sim => {
                      const bep = sim.output?.cvp.byLineMaterial.find(c => c.line === 'pipe')?.breakEvenKgYear || 0;
                      const cap = sim.output?.capacity.pipe.normalCapacityKgYear || 1;
                      const canBreakEven = cap >= bep;
                      return (
                        <td key={sim.shifts} style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#a8003b' }}>{fmtVnd(bep)} kg</div>
                          <div style={{ fontSize: 9, color: canBreakEven ? '#16A34A' : '#DC2626', marginTop: 2 }}>
                            {canBreakEven ? `Đạt được (Cần ${fmtPct(bep/cap)} công suất)` : `⚠ LỖ CHẮC: Tối đa chỉ SX được ${fmtVnd(cap)} kg`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Bảng Phân Tích Chi Phí Từng Mã Ống CPVC (So sánh ca)</div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f5f5f3', color: '#555', textTransform: 'uppercase', fontSize: 9 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #d8d8d8' }}>Tên SP / Kích Cỡ</th>
                    {pipeSimulations.map(sim => (
                      <th key={sim.shifts} style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>
                        Giá Vốn 1m ({sim.shifts} Ca)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipeProducts.map((p) => {
                    return (
                      <tr key={`${p.dn}-${p.materialId}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500 }}>Ống CPVC DN{p.dn} - {p.spec}</td>
                        {pipeSimulations.map(sim => {
                          const chainData = sim.output?.skuPriceChains.find(
                            c => 'dn' in c.productKey && c.productKey.dn === p.dn && c.productKey.materialId === p.materialId
                          )?.chain;
                          const cost = (chainData?.materialCostPerUnit || 0) + (chainData?.processingCostPerUnit || 0);
                          return (
                            <td key={sim.shifts} style={{ padding: '8px 12px' }}>
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
          </div>
        </>
      )}

      {activeTab === 'fitting' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #d8d8d8', padding: 16, borderRadius: 2, marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, color: '#a8003b' }}>
              So Sánh Năng Suất & Chi Phí Phụ Kiện Theo Mức Huy Động
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f5f5f3', color: '#555', textTransform: 'uppercase', fontSize: 9 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #d8d8d8' }}>Chỉ tiêu</th>
                    {fittingSimulations.map(sim => (
                      <th key={sim.util} style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>
                        Huy động {fmtPct(sim.util)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Sản lượng ước tính (kg/năm)</td>
                    {fittingSimulations.map(sim => (
                      <td key={sim.util} style={{ padding: '8px 12px', fontWeight: 600 }}>{sim.output ? fmtVnd(sim.output.capacity.fitting.estimatedProductionKgYear) : '—'}</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px dashed #f0f0f0', color: '#737373' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', paddingLeft: 24 }}>Giờ máy tiêu chuẩn</td>
                    {fittingSimulations.map(sim => (
                       <td key={sim.util} style={{ padding: '8px 12px' }}>{sim.output ? fmtVnd(sim.output.capacity.fitting.normalMachineHoursUtilized) : '—'} giờ</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px dashed #f0f0f0', color: '#737373' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', paddingLeft: 24 }}>Đơn giá MHR (đ/giờ máy)</td>
                    {fittingSimulations.map(sim => (
                       <td key={sim.util} style={{ padding: '8px 12px' }}>{sim.output ? fmtVnd(sim.output.mhrPerMachineHour) : '—'} đ</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px solid #d8d8d8', background: '#fdf2f8' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#a8003b' }}>ĐIỂM HÒA VỐN GIỜ MÁY</td>
                    {fittingSimulations.map(sim => {
                      const bep = sim.output?.cvp.byLineMaterial.find(c => c.line === 'fitting')?.breakEvenMachineHours || 0;
                      const cap = sim.output?.capacity.fitting.normalMachineHoursUtilized || 1;
                      const canBreakEven = cap >= bep;
                      return (
                        <td key={sim.util} style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#a8003b' }}>{fmtVnd(bep)} giờ</div>
                          <div style={{ fontSize: 9, color: canBreakEven ? '#16A34A' : '#DC2626', marginTop: 2 }}>
                            {canBreakEven ? `Đạt được (Cần ${fmtPct(bep/cap)} công suất)` : `⚠ LỖ CHẮC: Tối đa chỉ có ${fmtVnd(cap)} giờ`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Bảng Phân Tích Chi Phí Từng Mã Phụ Kiện (So sánh MHR)</div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f5f5f3', color: '#555', textTransform: 'uppercase', fontSize: 9 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #d8d8d8' }}>Tên SP / Kích Cỡ</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Giờ Máy/SP</th>
                    {fittingSimulations.map(sim => (
                      <th key={sim.util} style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>
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
                      <tr key={`${p.productName}-${p.sizeLabel}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500 }}>{p.productName} - {p.sizeLabel}</td>
                        <td style={{ padding: '8px 12px' }}>{machineHours.toFixed(5)}</td>
                        {fittingSimulations.map(sim => {
                          const chainData = sim.output?.skuPriceChains.find(
                            c => 'productName' in c.productKey && c.productKey.productName === p.productName && c.productKey.sizeLabel === p.sizeLabel
                          )?.chain;
                          const cost = (chainData?.materialCostPerUnit || 0) + (chainData?.processingCostPerUnit || 0);
                          return (
                            <td key={sim.util} style={{ padding: '8px 12px' }}>
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
          </div>
        </>
      )}
    </div>
  );
}
