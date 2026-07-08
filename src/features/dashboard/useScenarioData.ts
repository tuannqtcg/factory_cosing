// M12.5 — nguồn dữ liệu màn Dashboard, tách theo VAI đúng scenario.md §5:
// - admin/pricing: `scenarios/{id}` (ScenarioInput đầy đủ) + `outputs/internal`
//   (ScenarioOutput) — realtime onSnapshot.
// - sales: CHỈ `outputs/priceList` (thang giá + 4 giá cuối) — không bao giờ
//   chạm scenario doc/outputs/internal (rules chặn, hook cũng không thử đọc
//   để khỏi văng lỗi permission).
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import {
  ScenarioInputSchema,
  ScenarioOutputSchema,
  type ScenarioInput,
  type ScenarioOutput,
} from '../../schemas/scenario.js';

export interface ScenarioData {
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  /** priceLadder từ outputs/priceList — nguồn duy nhất cho vai sales. */
  salesPriceLadder: ScenarioOutput['priceLadder'] | null;
  error: string | null;
  loading: boolean;
}

export function useScenarioData(scenarioId: string, role: AppRole | null): ScenarioData {
  const [data, setData] = useState<ScenarioData>({
    scenario: null,
    internal: null,
    salesPriceLadder: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!role) return;
    setData({ scenario: null, internal: null, salesPriceLadder: null, error: null, loading: true });
    const fail = (context: string) => (err: unknown) =>
      setData((prev) => ({ ...prev, loading: false, error: `${context}: ${err instanceof Error ? err.message : String(err)}` }));

    if (role === 'sales') {
      return onSnapshot(
        doc(db, `scenarios/${scenarioId}/outputs/priceList`),
        (snap) => {
          const raw = snap.data();
          setData({
            scenario: null,
            internal: null,
            salesPriceLadder: raw ? (raw.priceLadder as ScenarioOutput['priceLadder']) : null,
            error: snap.exists() ? null : 'outputs/priceList chưa có — đã seed scenario chưa?',
            loading: false,
          });
        },
        fail('Đọc outputs/priceList'),
      );
    }

    // admin/pricing (production không có tab Dashboard — AppShell không render)
    const unsubScenario = onSnapshot(
      doc(db, `scenarios/${scenarioId}`),
      (snap) => {
        if (!snap.exists()) {
          setData((prev) => ({ ...prev, loading: false, error: `scenarios/${scenarioId} chưa có — chạy npm run seed:emulator` }));
          return;
        }
        // Luật AGENTS.md #2: validate cả client — dữ liệu hỏng phải lộ ngay thay vì render sai.
        const parsed = ScenarioInputSchema.safeParse(snap.data());
        if (!parsed.success) {
          setData((prev) => ({ ...prev, loading: false, error: `ScenarioInput không hợp lệ: ${parsed.error.issues[0]?.message}` }));
          return;
        }
        setData((prev) => ({ ...prev, scenario: parsed.data, loading: prev.internal === null, error: null }));
      },
      fail('Đọc scenario'),
    );
    const unsubInternal = onSnapshot(
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
    );
    return () => {
      unsubScenario();
      unsubInternal();
    };
  }, [scenarioId, role]);

  return data;
}
