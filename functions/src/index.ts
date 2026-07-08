// M12.4 + M12.4b — Cloud Function `onScenarioWrite`/`onPlanInputWrite`
// (docs/contracts/scenario.md §5, ADR-010).
// Trigger onWrite scenarios/{id}: chạy calculateScenario() (M12.1,
// src/engine/scenario.ts — TÁI DÙNG nguyên, KHÔNG lặp lại công thức) bằng
// Admin SDK (đọc được ScenarioInput đầy đủ kể cả giá vốn), ghi tách
// outputs/internal (ScenarioOutput đầy đủ) + outputs/priceList (chỉ 4 field
// giá cuối + priceLadder — sales-safe). `firestore.rules` (M12.3) đã chặn
// client ghi trực tiếp 2 doc này (`allow write: if false`) — Admin SDK ở đây
// bỏ qua rules, đúng thiết kế.
//
// PHẠM VI (xem ADR-010): outputs/targetCosting HOÃN sang M12.4c —
// TargetPriceRequestSchema (T3) chưa có trường chọn SKU cụ thể cho solver,
// không tự phát minh cấu trúc mới. outputs/plan đã có `onPlanInputWrite`
// (M12.4b) — orchestration nằm ở engine pure
// `calculatePlanForScenario()` (src/engine/plan-support.ts), function này chỉ
// làm I/O Firestore.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  ScenarioInputSchema,
  ScenarioOutputSchema,
  PlanInputSchema,
  PlanResultSchema,
  type ScenarioOutput,
} from '../../src/schemas/scenario.js';
import { calculateScenario } from '../../src/engine/scenario.js';
import { calculatePlanForScenario } from '../../src/engine/plan-support.js';

initializeApp();

function toPriceListDoc(output: ScenarioOutput) {
  return {
    priceLadder: output.priceLadder,
    skuPriceChains: output.skuPriceChains.map((sku) => ({
      productKey: sku.productKey,
      managementStatus: sku.managementStatus,
      chain: {
        vfPricePerUnit: sku.chain.vfPricePerUnit,
        tcgPricePerUnit: sku.chain.tcgPricePerUnit,
        listPriceBeforeVat: sku.chain.listPriceBeforeVat,
        listPriceWithVat: sku.chain.listPriceWithVat,
      },
    })),
  };
}

export const onScenarioWrite = onDocumentWritten('scenarios/{scenarioId}', async (event) => {
  const { scenarioId } = event.params;
  const db = getFirestore();
  const afterSnap = event.data?.after;

  if (!afterSnap?.exists) {
    // scenario bị xóa — dọn MỌI doc outputs đã tính (chỉ Cloud Function ghi
    // các doc này; outputs/plan thêm từ M12.4b — planInputs là INPUT của
    // production, không phải doc tính ra, KHÔNG tự xóa).
    await Promise.all([
      db.doc(`scenarios/${scenarioId}/outputs/internal`).delete(),
      db.doc(`scenarios/${scenarioId}/outputs/priceList`).delete(),
      db.doc(`scenarios/${scenarioId}/outputs/plan`).delete(),
    ]);
    return;
  }

  const scenarioInput = ScenarioInputSchema.parse(afterSnap.data());
  const scenarioOutput = ScenarioOutputSchema.parse(calculateScenario(scenarioInput));

  await Promise.all([
    db.doc(`scenarios/${scenarioId}/outputs/internal`).set(scenarioOutput),
    db.doc(`scenarios/${scenarioId}/outputs/priceList`).set(toPriceListDoc(scenarioOutput)),
  ]);
});

// M12.4b (ADR-010) — `production` ghi PlanInput vào planInputs/{period} →
// tính PlanResult, GHI ĐÈ `outputs/plan` (1 doc DUY NHẤT theo path
// scenario.md §5, không sub-collection theo period — outputs/plan = kết quả
// của lần ghi planInput GẦN NHẤT, lý do ở ADR-010).
export const onPlanInputWrite = onDocumentWritten('scenarios/{scenarioId}/planInputs/{period}', async (event) => {
  const { scenarioId } = event.params;
  const db = getFirestore();
  const planOutputRef = db.doc(`scenarios/${scenarioId}/outputs/plan`);
  const afterSnap = event.data?.after;

  if (!afterSnap?.exists) {
    // planInput bị xóa — dọn kết quả (đối xứng onScenarioWrite; outputs/plan
    // không lưu period nguồn nên không phân biệt được kết quả đang đứng có
    // thuộc period vừa xóa hay không → dọn luôn cho khỏi stale, ghi lại
    // planInput bất kỳ sẽ tính lại).
    await planOutputRef.delete();
    return;
  }

  const scenarioSnap = await db.doc(`scenarios/${scenarioId}`).get();
  if (!scenarioSnap.exists) {
    // planInput ghi vào scenario chưa/không tồn tại — không có gì để tính,
    // không throw (v2 mặc định không retry, throw chỉ làm bẩn log).
    console.error(`onPlanInputWrite: scenarios/${scenarioId} không tồn tại — bỏ qua planInputs/${event.params.period}`);
    return;
  }

  const scenarioInput = ScenarioInputSchema.parse(scenarioSnap.data());
  const planInput = PlanInputSchema.parse(afterSnap.data());
  const planResult = PlanResultSchema.parse(calculatePlanForScenario(scenarioInput, planInput));

  await planOutputRef.set(planResult);
});
