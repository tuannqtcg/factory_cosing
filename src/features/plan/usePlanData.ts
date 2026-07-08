// M12.7 — dữ liệu màn Kế Hoạch SX (vai production/admin), đúng ranh giới
// scenario.md §5 + ADR-014: đọc `outputs/productCatalog` (danh mục, không
// giá) + `outputs/plan` (kết quả server tính) + `planInputs/{period}` (input
// đã lưu); ghi DUY NHẤT `planInputs/{period}` — KHÔNG chạm scenarios/{id}.
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import {
  ProductCatalogDocSchema,
  PlanInputSchema,
  PlanResultSchema,
  type ProductCatalogDoc,
  type PlanInput,
  type PlanResult,
} from '../../schemas/scenario.js';

export interface PlanData {
  catalog: ProductCatalogDoc | null;
  planResult: PlanResult | null;
  /** PlanInput đã lưu trên Firestore (nạp form lần đầu). */
  savedInput: PlanInput | null;
  error: string | null;
  /** Ghi planInputs/{period} — Cloud Function onPlanInputWrite sẽ tự tính outputs/plan. */
  savePlanInput: (input: PlanInput) => Promise<string | null>;
}

export function usePlanData(scenarioId: string, period: string, role: AppRole | null): PlanData {
  const [catalog, setCatalog] = useState<ProductCatalogDoc | null>(null);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [savedInput, setSavedInput] = useState<PlanInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = role === 'production' || role === 'admin';

  useEffect(() => {
    if (!enabled) return;
    const fail = (context: string) => (err: unknown) =>
      setError(`${context}: ${err instanceof Error ? err.message : String(err)}`);

    const unsubs = [
      onSnapshot(
        doc(db, `scenarios/${scenarioId}/outputs/productCatalog`),
        (snap) => {
          if (!snap.exists()) {
            setError('outputs/productCatalog chưa có — đã seed scenario chưa? (ADR-014, Cloud Function tự ghi)');
            return;
          }
          const parsed = ProductCatalogDocSchema.safeParse(snap.data());
          if (!parsed.success) {
            setError(`ProductCatalogDoc không hợp lệ: ${parsed.error.issues[0]?.message}`);
            return;
          }
          setCatalog(parsed.data);
          setError(null);
        },
        fail('Đọc outputs/productCatalog'),
      ),
      onSnapshot(
        doc(db, `scenarios/${scenarioId}/outputs/plan`),
        (snap) => {
          if (!snap.exists()) {
            setPlanResult(null); // chưa từng lưu kế hoạch — panel kết quả trống
            return;
          }
          const parsed = PlanResultSchema.safeParse(snap.data());
          if (!parsed.success) {
            setError(`PlanResult không hợp lệ: ${parsed.error.issues[0]?.message}`);
            return;
          }
          setPlanResult(parsed.data);
        },
        fail('Đọc outputs/plan'),
      ),
      onSnapshot(
        doc(db, `scenarios/${scenarioId}/planInputs/${period}`),
        (snap) => {
          if (!snap.exists()) {
            setSavedInput(null);
            return;
          }
          const parsed = PlanInputSchema.safeParse(snap.data());
          setSavedInput(parsed.success ? parsed.data : null);
        },
        fail('Đọc planInputs'),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [scenarioId, period, enabled]);

  const savePlanInput = async (input: PlanInput): Promise<string | null> => {
    // Luật #2: validate client TRƯỚC khi ghi (server-side onPlanInputWrite parse lại lần nữa).
    const parsed = PlanInputSchema.safeParse(input);
    if (!parsed.success) return `PlanInput không hợp lệ: ${parsed.error.issues[0]?.message}`;
    try {
      await setDoc(doc(db, `scenarios/${scenarioId}/planInputs/${parsed.data.period}`), parsed.data);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  };

  return { catalog, planResult, savedInput, error, savePlanInput };
}
