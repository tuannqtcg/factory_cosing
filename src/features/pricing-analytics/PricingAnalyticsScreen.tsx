import { useState } from 'react';
import type { AppRole } from '../../lib/firebase.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import TargetCosting from '../target-costing/TargetCosting.js';
import WhatIfScreen from './WhatIfScreen.js';

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
    <div style={{ padding: '32px 36px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header & Tabs */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>
          Hoạch Định Chiến Lược · Tầng Management
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.3px', marginBottom: 16 }}>
          Phân Tích Định Giá
        </h1>
        
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #d8d8d8' }}>
          {(
            [
              ['what-if', 'Mô phỏng Công suất (What-If)'],
              ['target-costing', 'Định Giá Ngược (Target Costing)'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === id ? '#a8003b' : 'transparent'}`,
                color: activeTab === id ? '#a8003b' : '#737373',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeTab === id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'what-if' && (
          <WhatIfScreen scenarioId={scenarioId} scenario={scenario} internal={internal} />
        )}
        {activeTab === 'target-costing' && (
          <div style={{ marginTop: -32, marginLeft: -36, marginRight: -36 }}>
            {/* Embed TargetCosting directly, negative margin to offset its internal padding */}
            <TargetCosting role={role} scenarioId={scenarioId} scenario={scenario} internal={internal} />
          </div>
        )}
      </div>
    </div>
  );
}
