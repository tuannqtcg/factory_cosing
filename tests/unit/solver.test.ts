// Unit test — cơ chế bisection/quét rời rạc của src/engine/solver.ts, ĐỘC LẬP
// với nghiệp vụ (dùng hàm số học đơn giản). Test khớp fixture Excel thật nằm ở
// tests/parity/solver.test.ts (skill inverse-solver: round-trip + case DN50 +
// case infeasible phải chạy trên forward function CỦA ENGINE THẬT).
import { describe, expect, it } from 'vitest';
import { solve, solveDiscrete } from '../../src/engine/solver.js';

describe('solve() — bisection thuần, hàm tăng dần', () => {
  const forwardFn = (input: { x: number }) => ({ y: input.x * input.x });

  it('round-trip: hội tụ đúng nghiệm và |forward(solve(t)) - t| < tol', () => {
    const result = solve({
      baseInput: { x: 0 },
      forwardFn,
      freeVarPath: 'x',
      targetSelector: (o) => o.y,
      target: 16,
      bounds: [0, 10],
      tol: 1e-6,
    });
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    expect(result.value).toBeCloseTo(4, 5);
    expect(Math.abs(result.residual)).toBeLessThan(1e-6);
    expect(result.forwardOutput.y).toBeCloseTo(16, 5);
  });

  it('infeasible: mục tiêu vượt achievableRange → trả feasible:false kèm khoảng đạt được, KHÔNG trả số bừa', () => {
    const result = solve({
      baseInput: { x: 0 },
      forwardFn,
      freeVarPath: 'x',
      targetSelector: (o) => o.y,
      target: 1000,
      bounds: [0, 10],
      tol: 1e-6,
    });
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error('unreachable');
    expect(result.achievableRange[0]).toBeCloseTo(0, 6);
    expect(result.achievableRange[1]).toBeCloseTo(100, 6);
    expect(result.reason).toMatch(/không khả thi/);
  });
});

describe('solve() — hàm giảm dần (kiểm tra nhánh increasing=false)', () => {
  const forwardFn = (input: { x: number }) => ({ y: 100 - input.x });

  it('hội tụ đúng khi f giảm dần theo biến dò', () => {
    const result = solve({
      baseInput: { x: 0 },
      forwardFn,
      freeVarPath: 'x',
      targetSelector: (o) => o.y,
      target: 95,
      bounds: [0, 10],
      tol: 1e-6,
    });
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    expect(result.value).toBeCloseTo(5, 5);
  });
});

describe('solveDiscrete() — biến nguyên quét rời rạc (luật #5 skill inverse-solver)', () => {
  const forwardFn = (input: { shifts: number }) => ({ qty: input.shifts * 10 });

  it('tìm đúng giá trị rời rạc khớp mục tiêu', () => {
    const result = solveDiscrete({
      baseInput: { shifts: 1 },
      forwardFn,
      freeVarPath: 'shifts',
      targetSelector: (o) => o.qty,
      target: 20,
      candidates: [1, 2, 3],
    });
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error('unreachable');
    expect(result.value).toBe(2);
    expect(result.iterations).toBe(0);
  });

  it('infeasible khi không có ứng viên rời rạc nào khớp — trả achievableRange theo min/max ứng viên', () => {
    const result = solveDiscrete({
      baseInput: { shifts: 1 },
      forwardFn,
      freeVarPath: 'shifts',
      targetSelector: (o) => o.qty,
      target: 25,
      candidates: [1, 2, 3],
    });
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error('unreachable');
    expect(result.achievableRange).toEqual([10, 30]);
  });
});
