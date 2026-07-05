---
name: schema-design
description: Thiết kế Zod schema và API contract (Pha 2) cho Costing App — schema-first, discriminated union cho product types, hợp đồng dữ liệu đóng băng trước khi code. Dùng khi định nghĩa hoặc sửa cấu trúc dữ liệu.
---

# Skill: Schema Design (Pha 2)

## Luật
1. Schema-first: viết Zod TRƯỚC, suy ra TypeScript type bằng z.infer. Không viết type tay.
2. Mô hình lõi (từ Excel v3.3 — xem ADR-001, ADR-002):
   - `Scenario` { resources, costPools, products, pricingChain, inventoryLots }
   - `Resource` driver: z.discriminatedUnion('driverType', [continuous_kg, machine_hour])
   - `Product` : pipe (kg/m) | fitting (cycle_s, cavity, brass) — discriminated union
   - `InventoryLot` { tons, priceUsd } + replacementPrice → dual costing (ADR-002)
   - `PriceLockPolicy` { baselineUsd, replacementUsd, thresholdPct } →
     pricingPrice = |repl/base−1| > threshold ? repl : base (ADR-004);
     kế hoạch ngoại tệ LUÔN dùng replacementUsd, không dùng giá khóa
3. Mọi trường tiền tệ: number VNĐ nguyên (không float tiền lẻ), USD cho phép 4 số lẻ.
4. Đặt tên: tiếng Anh camelCase trong code, nhãn tiếng Việt trong `GLOSSARY.md`.
5. Kết thúc pha: file `docs/contracts/<feature>.md` gồm schema + endpoints + phân quyền
   theo vai (admin / pricing / sales / production) — ĐÓNG BĂNG, sửa phải có ADR.

## Anti-pattern cấm
- Optional tràn lan để "linh hoạt" — mọi optional phải có lý do ghi chú.
- any / unknown lọt ra ngoài boundary parse.
- Schema client khác schema server.
