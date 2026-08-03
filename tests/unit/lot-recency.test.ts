// ADR-064 — user 2026-08-02: nhập 2 lô (Lô 1, Lô 2) thì lô có SỐ THỨ TỰ CAO
// HƠN phải luôn là lô GẦN NHẤT, không phải Lô 1. Trước ADR-064, lastLotPriceOf
// coi lots[0] là gần nhất (UI chèn lô mới lên đầu) — đổi cả 2 sang: UI append
// vào cuối + engine đọc lots[length-1] (bỏ qua lô chưa điền/tons=0).
import { describe, expect, it } from 'vitest';
import { lastLotPriceOf } from '../../src/engine/scenario.js';

describe('ADR-064 — lastLotPriceOf: lô GẦN NHẤT = phần tử CUỐI mảng có tons > 0', () => {
  it('mảng rỗng ⇒ null', () => {
    expect(lastLotPriceOf([])).toBeNull();
  });

  it('1 lô duy nhất ⇒ giá của chính lô đó', () => {
    expect(lastLotPriceOf([{ tons: 10, priceUsdPerKg: 3.03 }])).toBe(3.03);
  });

  it('2 lô — lô THỨ 2 (index cao hơn, nhập sau) là giá GẦN NHẤT, không phải lô 1', () => {
    const lots = [
      { tons: 10, priceUsdPerKg: 2.6 }, // Lô 1 — nhập trước
      { tons: 5, priceUsdPerKg: 3.47 }, // Lô 2 — nhập sau, GẦN NHẤT
    ];
    expect(lastLotPriceOf(lots)).toBe(3.47);
  });

  it('lô cuối chưa điền (tons=0, placeholder mới bấm "+Thêm lô") ⇒ bỏ qua, lấy lô liền trước', () => {
    const lots = [
      { tons: 10, priceUsdPerKg: 2.6 },
      { tons: 5, priceUsdPerKg: 3.47 },
      { tons: 0, priceUsdPerKg: 0 }, // vừa bấm thêm, chưa nhập số
    ];
    expect(lastLotPriceOf(lots)).toBe(3.47);
  });

  it('dữ liệu fixture cũ đệm rỗng ở CUỐI mảng (5 lô, chỉ lô đầu có số) ⇒ vẫn đúng lô có tons>0', () => {
    const lots = [
      { tons: 10, priceUsdPerKg: 3.03 },
      { tons: 0, priceUsdPerKg: 0 },
      { tons: 0, priceUsdPerKg: 0 },
      { tons: 0, priceUsdPerKg: 0 },
      { tons: 0, priceUsdPerKg: 0 },
    ];
    expect(lastLotPriceOf(lots)).toBe(3.03);
  });

  it('mọi lô đều tons=0 ⇒ null (chưa có lô nào thật)', () => {
    expect(lastLotPriceOf([{ tons: 0, priceUsdPerKg: 0 }])).toBeNull();
  });
});
