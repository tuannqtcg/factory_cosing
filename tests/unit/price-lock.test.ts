// Parity test — skill excel-parity-testing: 5 kịch bản nghiệm thu ADR-004
// trong tests/fixtures/price-lock-scenarios.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluatePriceLock } from '../../src/engine/price-lock.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const fixture = loadFixture<any>('price-lock-scenarios.json');

describe('evaluatePriceLock — 5 kịch bản ADR-004 (price-lock-scenarios.json)', () => {
  for (const scenario of fixture.scenarios) {
    it(`kịch bản ${scenario.id}: ${scenario.label}`, () => {
      const result = evaluatePriceLock({
        baseline: fixture.baselineUsd,
        thresholdPct: fixture.thresholdPct,
        replacement: scenario.replacementUsd,
        lastLotPrice: scenario.lastLotPriceUsd ?? null,
      });

      if (scenario.deviationPct !== undefined) {
        expect(result.deviationPct).toBeCloseTo(scenario.deviationPct, 6);
      }
      expect(result.isLocked).toBe(scenario.expectedLockStatus === 'KHÓA');
      expect(result.pricingPrice).toBeCloseTo(scenario.expectedPricingPriceUsd, 6);

      if (scenario.expectedStalenessWarning) {
        expect(result.stalenessWarning).toBe(scenario.expectedStalenessWarning);
      } else {
        expect(result.stalenessWarning).toBeNull();
      }
    });
  }
});
