// ADR-045 — dựng PriceListDoc (sales-safe: 4 giá cuối + thang giá + unit/spec)
// từ ScenarioOutput. TÁCH ra module CHUNG để dùng ở CẢ 2 nơi:
//  - functions/ (Cloud Function onScenarioWrite, khi có deploy);
//  - client (useScenarioData) — app admin/pricing TỰ TÍNH, KHÔNG phụ thuộc Cloud
//    Function (tránh kẹt Bảng Giá khi function bị xóa/không deploy — project chung).
// skuPriceChains do calculateScenario() dựng bằng products.map() CÙNG THỨ TỰ →
// zip theo index, vẫn đối chiếu khóa để không bao giờ ghi nhầm hàng khi engine đổi.
import {
  PriceListDocSchema,
  type ScenarioInput,
  type ScenarioOutput,
  type PriceListDoc,
} from '../schemas/scenario.js';

export function toPriceListDoc(
  output: ScenarioOutput,
  products: ScenarioInput['products'],
  materials: ScenarioInput['materials'],
): PriceListDoc {
  return PriceListDocSchema.parse({
    priceLadder: output.priceLadder,
    skuPriceChains: output.skuPriceChains.map((sku, i) => {
      const product = products[i];
      const matches =
        product !== undefined &&
        product.materialId === sku.productKey.materialId &&
        (product.kind === 'pipe'
          ? product.dn === sku.productKey.dn
          : product.productName === sku.productKey.productName && product.sizeLabel === sku.productKey.sizeLabel);
      if (!matches) {
        throw new Error(`skuPriceChains[${i}] không khớp products[${i}] — thứ tự engine đổi? Không dựng priceList sai hàng.`);
      }
      const material = materials.find((m) => m.id === product.materialId);
      return {
        productKey: sku.productKey,
        managementStatus: sku.managementStatus,
        // ADR-013: 2 mã optional — CHỈ đính khi có giá trị (Firestore từ chối undefined).
        ...(material?.designationCode !== undefined ? { materialDesignationCode: material.designationCode } : {}),
        ...(material?.classificationCode !== undefined ? { materialClassificationCode: material.classificationCode } : {}),
        unit: product.kind === 'pipe' ? 'mét' : product.unit,
        spec: (product.kind === 'pipe' ? product.spec : product.schedule) ?? '',
        chain: {
          vfPricePerUnit: sku.chain.vfPricePerUnit,
          tcgPricePerUnit: sku.chain.tcgPricePerUnit,
          listPriceBeforeVat: sku.chain.listPriceBeforeVat,
          listPriceWithVat: sku.chain.listPriceWithVat,
        },
      };
    }),
  });
}
