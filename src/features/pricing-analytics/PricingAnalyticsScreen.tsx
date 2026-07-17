import { useState } from 'react';
import type { AppRole } from '../../lib/firebase.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import TargetCosting from '../target-costing/TargetCosting.js';
import WhatIfScreen from './WhatIfScreen.js';
import { cn } from '@/lib/utils';

export default function PricingAnalyticsScreen({
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
  const [activeTab, setActiveTab] = useState<'what-if' | 'target-costing'>('what-if');
  // ADR-026 — bỏ guard "chỉ dành cho vai X": chỉ admin/pricing đăng nhập được (ADR-023).

  return (
    <div className="flex h-full flex-col px-9 py-8">
      {/* Header & Tabs */}
      <div className="mb-6">
        <div className="mb-1.5 text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">
          Hoạch Định Chiến Lược · Tầng Management
        </div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground">
          Phân Tích Định Giá
        </h1>

        {/* Sub-tabs */}
        <div className="flex border-b border-input">
          {(
            [
              ['what-if', 'Mô phỏng Công suất (What-If)'],
              ['target-costing', 'Định Giá Ngược (Target Costing)'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'border-b-2 px-4 py-2 text-[13px] transition-colors',
                activeTab === id
                  ? 'border-foreground font-bold text-foreground'
                  : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'what-if' && (
          <WhatIfScreen scenarioId={scenarioId} scenario={scenario} internal={internal} />
        )}
        {activeTab === 'target-costing' && (
          <div className="-mx-9 -mt-8">
            {/* Embed TargetCosting directly, negative margin to offset its internal padding */}
            <TargetCosting role={role} scenarioId={scenarioId} scenario={scenario} internal={internal} />
          </div>
        )}
      </div>
    </div>
  );
}
