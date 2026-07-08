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

    // outputs/priceList — mọi vai (sales chỉ có nguồn này)
    unsubs.push(
      onSnapshot(
        doc(db, `scenarios/${scenarioId}/outputs/priceList`),
        (snap) => {
          if (!snap.exists()) {
            if (role === 'sales') {
              setData((prev) => ({ ...prev, loading: false, error: 'outputs/priceList chưa có — đã seed scenario chưa?' }));
            }
            return;
          }
          // Luật AGENTS.md #2: validate cả client — dữ liệu hỏng phải lộ ngay thay vì render sai.
          const parsed = PriceListDocSchema.safeParse(snap.data());
          if (!parsed.success) {
            setData((prev) => ({ ...prev, loading: false, error: `PriceListDoc không hợp lệ: ${parsed.error.issues[0]?.message}` }));
            return;
          }
          setData((prev) => ({
            ...prev,
            priceList: parsed.data,
            loading: role === 'sales' ? false : prev.scenario === null || prev.internal === null,
            error: null,
          }));
        },
        fail('Đọc outputs/priceList'),
      ),
    );

    if (role !== 'sales') {
      unsubs.push(
        onSnapshot(
          doc(db, `scenarios/${scenarioId}`),
          (snap) => {
            if (!snap.exists()) {
              setData((prev) => ({ ...prev, loading: false, error: `scenarios/${scenarioId} chưa có — chạy npm run seed:emulator` }));
              return;
            }
            const parsed = ScenarioInputSchema.safeParse(snap.data());
            if (!parsed.success) {
              setData((prev) => ({ ...prev, loading: false, error: `ScenarioInput không hợp lệ: ${parsed.error.issues[0]?.message}` }));
              return;
            }
            setData((prev) => ({ ...prev, scenario: parsed.data, loading: prev.internal === null, error: null }));
          },
          fail('Đọc scenario'),
        ),
      );
      unsubs.push(
        onSnapshot(
          doc(db, `scenarios/${scenarioId}/outputs/internal`),
          (snap) => {
            if (!snap.exists()) return; // Cloud Function chưa tính xong — chờ snapshot sau
            const parsed = ScenarioOutputSchema.safeParse(snap.data());
            if (!parsed.success) {
              setData((prev) => ({ ...prev, loading: false, error: `ScenarioOutput không hợp lệ: ${parsed.error.issues[0]?.message}` }));
              return;
            }
            setData((prev) => ({ ...prev, internal: parsed.data, loading: prev.scenario === null, error: null }));
          },
          fail('Đọc outputs/internal'),
        ),
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [scenarioId, role]);

  return data;
}
