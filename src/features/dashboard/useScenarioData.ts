// M12.5/M12.6 — nguồn dữ liệu Firestore cho các màn hình, tách theo VAI đúng
// scenario.md §5:
// - admin/pricing: `scenarios/{id}` (ScenarioInput đầy đủ) + `outputs/internal`
//   (ScenarioOutput) + `outputs/priceList` — realtime onSnapshot.
// - sales: CHỈ `outputs/priceList` (PriceListDocSchema — thang giá + 4 giá
//   cuối + unit/spec) — không bao giờ chạm scenario doc/outputs/internal
//   (rules chặn, hook cũng không thử đọc để khỏi văng lỗi permission).
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import {
  ScenarioInputSchema,
  ScenarioOutputSchema,
  PriceListDocSchema,
  type ScenarioInput,
  type ScenarioOutput,
  type PriceListDoc,
} from '../../schemas/scenario.js';
import { calculateScenario } from '../../engine/scenario.js';
import { toPriceListDoc } from '../../engine/price-list-doc.js';

export interface ScenarioData {
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  /** outputs/priceList (sales-safe) — nguồn duy nhất của vai sales, màn Bảng Giá dùng cho MỌI vai. */
  priceList: PriceListDoc | null;
  error: string | null;
  loading: boolean;
}

const EMPTY: ScenarioData = { scenario: null, internal: null, priceList: null, error: null, loading: true };

export function useScenarioData(scenarioId: string, role: AppRole | null): ScenarioData {
  const [data, setData] = useState<ScenarioData>(EMPTY);

  useEffect(() => {
    if (!role || role === 'production') return; // production không có màn nào đọc scenario/priceList (M12.7 dùng planInputs)
    setData(EMPTY);
    const fail = (context: string) => (err: unknown) =>
      setData((prev) => ({ ...prev, loading: false, error: `${context}: ${err instanceof Error ? err.message : String(err)}` }));

    const unsubs: Array<() => void> = [];

    if (role === 'sales') {
      // Sales KHÔNG đọc được scenario doc (rules) → vẫn phải đọc outputs/priceList
      // do Cloud Function tính. (ADR-026: hiện chỉ admin/pricing đăng nhập.)
      unsubs.push(
        onSnapshot(
          doc(db, `scenarios/${scenarioId}/outputs/priceList`),
          (snap) => {
            if (!snap.exists()) {
              setData((prev) => ({ ...prev, loading: false, error: 'outputs/priceList chưa có — đã seed scenario chưa?' }));
              return;
            }
            const parsed = PriceListDocSchema.safeParse(snap.data());
            if (!parsed.success) {
              setData((prev) => ({ ...prev, loading: false, error: `PriceListDoc không hợp lệ: ${parsed.error.issues[0]?.message}` }));
              return;
            }
            setData((prev) => ({ ...prev, priceList: parsed.data, loading: false, error: null }));
          },
          fail('Đọc outputs/priceList'),
        ),
      );
      return () => unsubs.forEach((u) => u());
    }

    // ADR-045 — admin/pricing TỰ TÍNH internal + priceList NGAY từ scenario doc,
    // KHÔNG đọc outputs/* (không phụ thuộc Cloud Function — Bảng Giá cập nhật ngay
    // khi Lưu, không lo function bị xóa/không deploy trong project dùng chung).
    unsubs.push(
      onSnapshot(
        doc(db, `scenarios/${scenarioId}`),
        (snap) => {
          if (!snap.exists()) {
            setData((prev) => ({ ...prev, loading: false, error: `scenarios/${scenarioId} chưa có — chạy npm run seed:production` }));
            return;
          }
          const parsed = ScenarioInputSchema.safeParse(snap.data());
          if (!parsed.success) {
            setData((prev) => ({ ...prev, scenario: null, internal: null, priceList: null, loading: false, error: `ScenarioInput không hợp lệ: ${parsed.error.issues[0]?.message}` }));
            return;
          }
          const scenario = parsed.data;
          try {
            const internal = ScenarioOutputSchema.parse(calculateScenario(scenario));
            const priceList = toPriceListDoc(internal, scenario.products, scenario.materials);
            setData({ scenario, internal, priceList, loading: false, error: null });
          } catch (e) {
            // Dữ liệu gốc lỗi (SKU trỏ nguyên liệu đã xóa, trùng khóa…) — lộ ngay
            // thay vì hiển thị giá cũ sai. Vẫn giữ scenario để màn chỉnh sửa được.
            setData({ scenario, internal: null, priceList: null, loading: false, error: `Không tính được giá từ dữ liệu gốc: ${e instanceof Error ? e.message : String(e)}` });
          }
        },
        fail('Đọc scenario'),
      ),
    );

    return () => unsubs.forEach((u) => u());
  }, [scenarioId, role]);

  return data;
}
