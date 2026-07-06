# CHANGELOG — Costing App Kit

## v1.10 (2026-07-06) — Pha 3 M3: engine Phụ kiện (fitting.ts)
`src/engine/fitting.ts` — `calculateFittingCapacity()` +
`calculateFittingCostAtNormalCapacity()` (BUSINESS_MODEL §3.2-3.3), khớp tuyệt
đối `mhrPerMachineHour = 1344175.79463858` (trái tim ADR-001).

**Sửa lỗi thiếu sót**: `MachineHourResourceSchema` (M1) thiếu `depreciationYears`
(khấu hao MÁY ép — tách khỏi `MoldAsset.usefulLifeYears` là khấu hao KHUÔN) —
bổ sung vào `src/schemas/resource.ts` + `docs/contracts/resource.md`.

**Quyết định thiết kế**: tách `machineDepreciationPerYear` và
`moldDepreciationPerYear` thành 2 field riêng (Excel gộp chung 1
`machineMoldDepreciation`) — chuẩn bị sẵn cho M4 (khấu hao khuôn động theo
`asOfYear`, ADR-007) chỉ cần sửa field mold, không đụng field máy. Verify: 2
field cộng lại khớp tuyệt đối số Excel gốc.

`npm test` 18/18 xanh. **M4 tiếp theo**: lọc `moldDepreciationPerYear` theo
`asOfYear` — xem `docs/PHASE3_PLAN.md`.

## v1.9 (2026-07-06) — Pha 3 M2: engine Ống (pipe.ts)
`src/engine/pipe.ts` — `calculatePipeCapacity()` + `calculatePipeCostAtNormalCapacity()`
(BUSINESS_MODEL §2.1-2.2), khớp tuyệt đối `tests/fixtures/pipe.json.costAtNormalCapacity`
(`fullCostPerKg=106204.729733113`, `vfPricePerKg=132755.912166391`).

**Sửa lỗi thiếu sót phát hiện khi viết engine** (không phải ADR — không đổi
nghiệp vụ): `ContinuousKgResourceSchema`/`MachineHourResourceSchema` (M1) THIẾU
12 field mà công thức §2.2/§3.3 luôn cần (`packagingCostPerKg`,
`avgSalaryMonthly`, `monthsSalaryPerYear`, `electricityKw(PerMachineHour)`,
`electricityPricePerKwh`, `waterM3Per(Machine)Hour`, `waterPricePerM3`,
`avgProductivityKgPerMachineHour`) — bổ sung vào `src/schemas/resource.ts` +
`docs/contracts/resource.md` + `tests/unit/schemas.test.ts`, vẫn 10/10 xanh.

`npm run typecheck` sạch, `npm test` 14/14 xanh (10 schema + 4 parity pipe).
**M3 tiếp theo**: `src/engine/fitting.ts` — xem `docs/PHASE3_PLAN.md`.

## v1.8 (2026-07-06) — Schema ĐÓNG BĂNG, mở Pha 3 (M1: scaffold + src/schemas)
User duyệt schema Pha 2 ("thực hiện theo đề xuất") → 5 file `docs/contracts/*.md`
chính thức ĐÓNG BĂNG. Yêu cầu chia Pha 3 thành nhiều milestone nhỏ để tiết kiệm
tool call/token — xem `docs/PHASE3_PLAN.md` (bảng trạng thái M1..M12).

| File | Thay đổi |
|---|---|
| docs/PHASE3_PLAN.md | MỚI — lộ trình 12 milestone, mỗi milestone tự chứa (code + test xanh + commit) |
| package.json, tsconfig.json | MỚI — scaffold TypeScript strict + Zod + Vitest |
| src/schemas/{resource,product,cost-pool,pricing-chain,scenario}.ts | MỚI — code thật từ 5 file contract, không sửa cấu trúc so với `.md` |
| tests/unit/schemas.test.ts | MỚI — 10 test parse toàn bộ fixture thật (mold-assets 66 dòng, fitting.skus 91 dòng, pipe 8 dòng) + test xác nhận Zod từ chối `thresholdPct` chưa chuẩn hóa đơn vị |
| docs/CONTEXT_PASTE.md | Pha 2 → Pha 3, trỏ PHASE3_PLAN.md, ghi rõ M1 đã xong |

**M1 hoàn tất**: `npm run typecheck` sạch, `npm test` 10/10 xanh. **M2 tiếp theo**:
`src/engine/pipe.ts` (công suất + chi phí SX Ống tại CS bình thường).

## v1.7 (2026-07-06) — Schema nháp Pha 2 (5 file contract, CHƯA đóng băng)
Hiện thực hóa ADR-001..008 thành Zod schema cụ thể. Chưa phải quyết định kiến
trúc mới (không ADR), chỉ là bước chuyển ADR → schema đúng vai trò Pha 2.

| File | Nội dung | Nguồn |
|---|---|---|
| docs/contracts/resource.md | `Resource` (continuous_kg \| machine_hour) + `MoldAsset` | ADR-001, ADR-003, ADR-007 |
| docs/contracts/product.md | `Product` (pipe \| fitting) + BOM ren kim loại + `managementStatusOf()` tính ra | ADR-001, ADR-007, ADR-008 |
| docs/contracts/cost-pool.md | SharedFixedCosts, NonProductionCosts, CurrencyParams, MarkupChain | assumptions.json |
| docs/contracts/pricing-chain.md | PriceLockPolicy generic (input/output tách), CompoundInventory + MetalInsertCatalog, thang giá 5 bậc | ADR-002, ADR-004, ADR-008 |
| docs/contracts/scenario.md | ScenarioInput/Output tổng hợp, Plan_SX (T1), solver contract (T2/T3), Firestore doc split + bảng phân quyền 4 vai × 6 vùng | ADR-005, ADR-006, PROJECT_SPEC §3/§5 |

**Phát hiện cần xử lý trước Pha 3**: `thresholdPct` lệch đơn vị giữa
`assumptions.json` (thập phân 0.03) và `metal-insert.json` (số nguyên 5) —
schema chốt dùng thập phân, cần chuẩn hóa khi migrate fixture.

**Trạng thái**: schema NHÁP, chưa đóng băng — chờ user duyệt cổng thứ 2.

## v1.6 (2026-07-06) — Pha 1 duyệt, mở cổng Pha 2
User duyệt UI chính thức cho prototype (Pha 1). Không đổi nghiệp vụ, chỉ chuyển
pha trong quy trình 4 pha có cổng.

| File | Thay đổi | Lý do |
|---|---|---|
| docs/CONTEXT_PASTE.md | Đổi khối "TRẠNG THÁI HIỆN TẠI" Pha 1 → Pha 2 | Phản ánh đúng cổng vừa mở, việc tiếp theo là flow + schema Zod |
| docs/sessions/SESSION_2026-07-06.md | MỚI — ghi lại quyết định duyệt Pha 1 | Luật bất biến #6 (AGENTS.md): mọi phiên phải ghi session log |

## v1.5 (2026-07) — đóng gói tri thức cho phiên mới (ADR-007/008 đã đủ dữ liệu)
KHÁC BIỆT so với kit v1.4 (thuần đồng bộ tài liệu, không đổi nghiệp vụ so với các
bản cập nhật cuối v1.4):

| File | Thay đổi | Lý do |
|---|---|---|
| docs/CONTEXT_PASTE.md | Thêm khối "TRẠNG THÁI HIỆN TẠI" ở đầu file; viết lại điểm 8, 9 (ADR-007/008 từ "chờ dữ liệu" → "đã có số liệu thật"); thêm điểm 10 (8 SKU tạm loại khỏi danh mục quản lý) | File này là bản duy nhất được dán vào đầu phiên mới — phải phản ánh đúng trạng thái mới nhất, không được để "chờ dữ liệu" khi đã có rồi |
| docs/PROJECT_SPEC.md §2 | Thêm mục "Bổ sung ngoài Excel v3.4" ghi rõ ADR-007/008 đã trong phạm vi v1 | Constitution phải khớp thực tế các ADR đã chấp nhận |
| docs/GLOSSARY.md | +2 thuật ngữ: insertCatalog, managementStatus | UI tiếng Việt nhất quán khi lên Pha 2 |

**Lý do bump version dù không đổi nghiệp vụ**: các bản ghi "Cập nhật lần 1-5" bên
dưới (trong v1.4) đã đưa nghiệp vụ vào trạng thái ổn định, nhưng nằm rải rác thành
nhiều đoạn nhỏ khó quét nhanh — v1.5 gom lại thành 1 bản CONTEXT_PASTE.md sạch, để
phiên chat mới không cần đọc lại toàn bộ lịch sử session mới nắm được trạng thái.

## v1.4 (2026-07) — khấu hao khuôn theo thời gian + ren kim loại mua ngoài (CHỜ DỮ LIỆU)
KHÁC BIỆT so với kit v1.3:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-007-time-phased-mold-depreciation.md | MỚI — khuôn phụ kiện tách thành `moldAsset` riêng (giá, năm mua, số năm khấu hao) thay vì 1 số gộp; MHR tính động theo `asOfYear` | User xác nhận: chuẩn bị cho khuôn mua sau (mở rộng SKU) — khấu hao lệch pha, không còn là hằng số |
| docs/decisions/ADR-008-purchased-metal-insert.md | MỚI — ren kim loại (đồng thau) cho 4 họ SKU ren là dòng nguyên liệu thứ 2, áp giá vốn kép (ADR-002) thay vì cộng thẳng `brassInsertCost` tĩnh | User xác nhận: xử lý giống hệt compound (bình quân gia quyền vs giá tái tạo) |
| docs/GLOSSARY.md | +4 thuật ngữ: moldAsset, asOfYear, purchasedMetalInsert, insertQtyPerUnit | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | +điểm 8, 9: khấu hao khuôn theo thời gian, ren kim loại mua ngoài | Đồng bộ bản nén 1 trang |

**Cập nhật cùng ngày**: user cung cấp thêm — khuôn `purchaseYear = 2026` (giá để
trống, tự nhập sau); ren kim loại mua VND trong nước (không ngoại tệ/DUTY), có
tồn kho riêng, và có khóa giá riêng độc lập với compound (mở rộng ADR-004). Cả 2
ADR nay đã CHẤP NHẬN đầy đủ về nguyên tắc.

**Cập nhật lần 2 cùng ngày — nhận số liệu thật**: user upload 2 file hợp đồng/bảng
giá thật:
- `tests/fixtures/mold-assets.json` — giá 66/66 khuôn (từ
  `contract_mold_price_from_David2506062.pdf`). Verify: Σ giá USD × 26.500 =
  6.542.850.000đ, khớp tuyệt đối `moldSetCostTotal66` hiện có. Phát hiện: 66 khuôn
  chỉ sản xuất được 83/91 SKU (nhiều khuôn dùng chung nhiều biến thể); 8 SKU
  (Cút ren trong ×3, Tê ren trong ×4, Tê giảm 50x40 ×1) CHƯA có khuôn — user xác
  nhận đúng (chưa sản xuất thật), khớp đúng kịch bản ADR-007.
- `tests/fixtures/metal-insert.json` — đơn giá 11/11 SKU ren kim loại (từ
  `Gia_phu_kien_ren.pdf`). Phạm vi thu hẹp đúng thực tế: CHỈ Nối ren trong (7) +
  Nối ren ngoài (4) = 11 SKU cần ren kim loại — khớp chính xác với 11 SKU có khuôn
  ở trên; Cút/Tê ren trong không có cả khuôn lẫn giá ren (nhất quán).
- ADR-007/008 cập nhật trạng thái "ĐÃ CÓ SỐ LIỆU" — còn thiếu: giá khuôn mới khi
  mua thêm cho 8 SKU kia; baseline/ngưỡng khóa giá ban đầu + tồn kho ban đầu cho
  ren kim loại (ADR-008).

**Cập nhật lần 3 cùng ngày — tồn kho ban đầu ren kim loại**: user cung cấp số lượng
tồn kho (10 dòng, đơn vị Cái). Phát hiện quan trọng: ren kim loại thực chất chỉ có
**10 loại vật tư theo (renType, ptSize)**, không phải 11 loại theo SKU — SKU
"20xPT15" và "25xPT15" dùng CHUNG 1 loại ren PT15 (cùng giá 16.200đ, xác nhận qua
đối chiếu giá đã có). Thêm `insertCatalog` (10 dòng, có tồn kho) + `skuToInsertMap`
vào `tests/fixtures/metal-insert.json`. Tổng tồn kho: 29.000 cái, 1.016.300.000đ (1
lô duy nhất → bình quân gia quyền = giá tái tạo). ADR-008 chỉ còn thiếu
baseline/ngưỡng khóa giá ban đầu.

**Cập nhật lần 4 cùng ngày — chốt ngưỡng khóa giá**: user xác nhận **ngưỡng khóa
giá ren kim loại = 5%**, baseline = giá hiện hành tại lần chốt đầu tiên (độ lệch=0%,
KHÓA). Thêm `priceLock` vào cả 10 dòng `insertCatalog`. **ADR-008 nay ĐẦY ĐỦ DỮ
LIỆU cho 11 SKU hiện có** — sẵn sàng lên schema Pha 2 chính thức.

**Cập nhật lần 5 cùng ngày — loại tạm 8 SKU khỏi danh mục quản lý**: user xác nhận
loại TẠM THỜI cả 8 SKU chưa có khuôn (7 SKU ren + Tê giảm 50x40, nhất quán theo
tiêu chí "chưa có khuôn thật", không chỉ riêng nhóm ren). Prototype: thêm
`EXCLUDED_SKUS` + `isExcludedSku()`, filter tại 3 nơi — bảng giá SKU Phụ Kiện,
tab Bảng Giá (100→92 dòng), Kế Hoạch SX Phụ Kiện (91→83). Dữ liệu Excel gốc KHÔNG
xóa, chỉ ẩn khỏi màn hình vận hành. ADR-007 cập nhật quyết định bổ sung.

## v1.3 (2026-07) — phân tầng top-down theo đối tượng xem
KHÁC BIỆT so với kit v1.2:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-006-audience-tiers.md | MỚI — 2 tầng top-down: vận hành (`production`, T1, Plan_SX) vs chiến lược (`pricing`/`admin`, T2/T3 + giá thâm nhập, Target Costing) | Mức độ quan tâm/quyết định của SX quản lý và CEO khác nhau — không gộp 1 màn hình |
| docs/PROJECT_SPEC.md §1, §2, §3 | Gắn 2 tầng vào bảng vai; thêm `src/engine/solver.ts` vào kiến trúc | Đồng bộ constitution với ADR-005/006 |
| docs/GLOSSARY.md | +4 thuật ngữ: operationalTopDown, strategicTopDown, targetProfit, penetrationPrice | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | +điểm 7: phân tầng top-down theo vai | Đồng bộ bản nén 1 trang |

## v1.2 (2026-07) — chốt ý đồ hoạch định hai chiều
KHÁC BIỆT so với kit v1.1:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-005-dual-direction.md | MỚI — forward engine + inverse solver, 3 câu hỏi top-down (T1/T2/T3) | Chốt ý đồ gốc: app là công cụ hoạch định, không phải máy tính giá |
| skills/inverse-solver | MỚI — luật giải ngược bằng bisection trên forward function, cấm công thức ngược viết tay | Solver là module bắt buộc của engine, không phải tính năng cơi nới sau |
| docs/CONTEXT_PASTE.md | +điểm 6: hai chiều hoạch định (bottom-up/top-down) | Đồng bộ bản nén 1 trang với ADR-005 |

## v1.1 (2026-07) — bổ sung cơ chế khóa bảng giá | nguồn Excel: v3.4
KHÁC BIỆT so với kit v1.0 (nguồn v3.3):

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-004-price-lock.md | MỚI — luật khóa baseline+ngưỡng, 5 kịch bản nghiệm thu | Nghiệp vụ mới chốt: bảng giá chỉ đổi khi lệch vượt ngưỡng % |
| skills/excel-parity-testing | Nguồn chân lý v3.3→v3.4; thêm fixture khóa giá | Engine phải tái tạo hành vi khóa |
| skills/schema-design | Thêm `PriceLockPolicy` vào mô hình lõi; luật ngoại tệ dùng replacement | Schema pha 2 phải chứa policy này |
| AGENTS.md, CLAUDE.md, PROJECT_SPEC §2 | Trỏ nguồn v3.4; phạm vi thêm khóa giá | Đồng bộ constitution |
| docs/GLOSSARY.md | +4 thuật ngữ: baselinePrice, priceLockThreshold, priceLockStatus, stalenessWarning | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | MỚI — bản nén 1 trang để paste vào phiên chat/design mới | Khởi động phiên không cần cả repo |

## v1.0 (2026-07) — khởi tạo
AGENTS.md, CLAUDE.md, 4 skills theo pha, PROJECT_SPEC, ADR-001..003,
GLOSSARY, SESSION_TEMPLATE, settings.json guardrails. Nguồn Excel: v3.3.
