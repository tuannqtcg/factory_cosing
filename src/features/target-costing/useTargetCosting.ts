// M12.8 — client cho HTTPS Callable `computeTargetCosting` (đã xong từ
// M12.4c/ADR-013). Callable TRẢ kết quả trực tiếp trong response (ADR-013 mục
// 4) — không cần đọc lại `outputs/targetCosting` để hiển thị kết quả vừa
// chạy; hook chỉ đọc doc đó cho MỘT việc: khôi phục "lần chạy gần nhất" khi
// vai pricing/admin mở lại app (đúng ý đồ ADR-013, không phát minh thêm).
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import {
  TargetProfitRequestSchema,
  TargetProfitResultSchema,
  TargetPriceRequestSchema,
  TargetPriceResultSchema,
  type TargetProfitRequest,
  type TargetProfitResult,
  type TargetPriceRequest,
  type TargetPriceResult,
} from '../../schemas/scenario.js';

// Không có schema riêng cho doc `outputs/targetCosting` trong contract đóng
// băng (scenario.md §4 chỉ định hình { kind, request, result } bằng lời) —
// ghép lại từ 2 cặp Request/Result đã đóng băng, KHÔNG sửa schemas/scenario.ts.
const TargetCostingDocSchema = z.union([
  z.object({ kind: z.literal('targetProfit'), request: TargetProfitRequestSchema, result: TargetProfitResultSchema }),
  z.object({ kind: z.literal('targetPrice'), request: TargetPriceRequestSchema, result: TargetPriceResultSchema }),
]);
export type TargetCostingDoc = z.infer<typeof TargetCostingDocSchema>;

const CallableResponseSchema = z.object({
  kind: z.enum(['targetProfit', 'targetPrice']),
  result: z.unknown(),
});

const computeTargetCosting = httpsCallable(functions, 'computeTargetCosting');

export interface TargetCostingClient {
  /** Doc `outputs/targetCosting` — null nếu chưa từng chạy hoặc parse lỗi. */
  lastDoc: TargetCostingDoc | null;
  runTargetProfit: (request: TargetProfitRequest) => Promise<TargetProfitResult>;
  runTargetPrice: (request: TargetPriceRequest) => Promise<TargetPriceResult>;
}

export function useTargetCosting(scenarioId: string, role: AppRole | null): TargetCostingClient {
  const [lastDoc, setLastDoc] = useState<TargetCostingDoc | null>(null);

  useEffect(() => {
    if (role !== 'pricing' && role !== 'admin') return;
    return onSnapshot(doc(db, `scenarios/${scenarioId}/outputs/targetCosting`), (snap) => {
      if (!snap.exists()) {
        setLastDoc(null);
        return;
      }
      const parsed = TargetCostingDocSchema.safeParse(snap.data());
      setLastDoc(parsed.success ? parsed.data : null);
    });
  }, [scenarioId, role]);

  const runTargetProfit = useCallback(async (request: TargetProfitRequest): Promise<TargetProfitResult> => {
    // Luật AGENTS.md #2: validate ở client TRƯỚC KHI gọi (server parse lại lần nữa).
    const parsedRequest = TargetProfitRequestSchema.parse(request);
    const res = await computeTargetCosting(parsedRequest);
    const envelope = CallableResponseSchema.parse(res.data);
    return TargetProfitResultSchema.parse(envelope.result);
  }, []);

  const runTargetPrice = useCallback(async (request: TargetPriceRequest): Promise<TargetPriceResult> => {
    const parsedRequest = TargetPriceRequestSchema.parse(request);
    const res = await computeTargetCosting(parsedRequest);
    const envelope = CallableResponseSchema.parse(res.data);
    return TargetPriceResultSchema.parse(envelope.result);
  }, []);

  return { lastDoc, runTargetProfit, runTargetPrice };
}
