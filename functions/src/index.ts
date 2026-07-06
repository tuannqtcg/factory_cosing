// M12.4 — Cloud Function `onScenarioWrite` (docs/contracts/scenario.md §5, ADR-010).
// Trigger onWrite scenarios/{id}: chạy calculateScenario() (M12.1,
// src/engine/scenario.ts — TÁI DÙNG nguyên, KHÔNG lặp lại công thức) bằng
// Admin SDK (đọc được ScenarioInput đầy đủ kể cả giá vốn), ghi tách
// outputs/internal (ScenarioOutput đầy đủ) + outputs/priceList (chỉ 4 field
// giá cuối + priceLadder — sales-safe). `firestore.rules` (M12.3) đã chặn
// client ghi trực tiếp 2 doc này (`allow write: if false`) — Admin SDK ở đây
// bỏ qua rules, đúng thiết kế.
//
// PHẠM VI (xem ADR-010): outputs/plan và outputs/targetCosting HOÃN sang
// M12.4b/M12.4c — chưa có hàm dẫn xuất `moldSetCountBySizeDN` từ
// moldAssets+products (Plan_SX) và TargetPriceRequestSchema (T3) chưa có
// trường chọn SKU cụ thể cho solver — không tự phát minh cấu trúc mới.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ScenarioInputSchema, ScenarioOutputSchema, type ScenarioOutput } from '../../src/schemas/scenario.js';
import { calculateScenario } from '../../src/engine/scenario.js';

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
    // scenario bị xóa — dọn outputs đã tính (chỉ Cloud Function ghi 2 doc này).
    await Promise.all([
      db.doc(`scenarios/${scenarioId}/outputs/internal`).delete(),
      db.doc(`scenarios/${scenarioId}/outputs/priceList`).delete(),
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
