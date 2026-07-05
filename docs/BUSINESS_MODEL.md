# BUSINESS_MODEL.md — Thuật toán & quy định nghiệp vụ (nguồn: BlazeMaster_Model_v3_3.xlsx)

> File Excel gốc KHÔNG nằm trong repo (dữ liệu chi phí/giá thành/margin nhạy cảm kinh
> doanh — xem `.gitignore`). Tài liệu này + `tests/fixtures/*.json` là bản dịch đầy đủ
> sang thuật toán/số liệu vàng, đủ để cài lại engine mà không cần file Excel.
> Số liệu trong fixture được trích xuất 1 lần (2026-07) bằng script đọc trực tiếp ô
> công thức của Excel — không gõ tay. Khi có bản Excel mới (v3.4+), lặp lại quy trình
> trích xuất, KHÔNG sửa tay số trong JSON.

## 0. Cấu trúc nguồn Excel (6 sheet)
`Assumptions` (tham số chung) → `Ống` + `Phụ kiện` (2 dòng sản phẩm, tính độc lập,
tham chiếu chéo qua tỷ lệ phân bổ chi phí chung theo kg) → `Dashboard` (tổng hợp,
chỉ tham chiếu, không có phép tính riêng) → `Plan_SX` (kế hoạch, tham chiếu ngược
vào Ống/Phụ kiện) → `PriceList` (bảng phẳng 8 giá ống + 91 giá SKU, thuần tham chiếu).

Nguyên tắc dòng chảy: **tham số riêng → công suất → chi phí sản xuất tại công suất
bình thường → giá thành → chuỗi markup → giá niêm yết**. Không có vòng lặp ngược
(trừ 2 tỷ lệ phân bổ chi phí chung, xem §4).

---

## 1. Tham số chung — `tests/fixtures/assumptions.json`
| Field | Giá trị | Ghi chú |
|---|---|---|
| `usdVndRate` | 26.500 | Cập nhật theo tỷ giá bán ra VCB tại ngày báo giá |
| `vatOutputRate` | 8% | VAT đầu ra |
| `mandatoryInsuranceRate` | 23,5% | BHXH 17,5 + BHYT 3 + BHTN 1 + KPCĐ 2, nhân vào quỹ lương |
| `compoundImportTaxRate` | 6% | Kịch bản EU |
| `customsLogisticsFeeRate` | 1% | |
| `markupVfPipe` / `markupVfFitting` | 25% / 40% | Markup từ giá thành đầy đủ → giá VF |
| `markupTcg` | 30% | Giá VF → giá TCG |
| `listPriceMargin` | 30% | Niêm yết = TCG ÷ (1 − margin) |

**Chi phí chung dùng chung 2 dòng** (`sharedFixedCosts.totalPerYear`):
```
total = (lab + vnUlSetup + ulSetup) / depreciationYears + annualComplianceFee + annualLandRent
```
Phân bổ vào từng dòng theo tỷ lệ sản lượng kg (xem §4), KHÔNG theo doanh thu hay giờ máy.

**Tồn kho compound — giá vốn kép** (xem ADR-002):
```
weightedAvgUsd = Σ(lot.tons × lot.priceUsdPerKg) / Σ(lot.tons)     // nếu không có lô nào → dùng replacementPriceUsd
inventoryKg    = Σ(lot.tons) × 1000
```
`replacementPriceUsd` là giá chào mua lô kế tiếp — nhập tay, neo cho compound
landed dùng ĐỊNH GIÁ ở Ống/Phụ kiện §2 (biến `B5`). `weightedAvgUsd` chỉ dùng cho
dòng SỔ SÁCH (biến `B49`/`B60` ở Ống/Phụ kiện).

---

## 2. Ống — `tests/fixtures/pipe.json` (driver: **kg**, đùn liên tục)

### 2.1 Công suất
```
batchesPerYear          = operatingDaysPerYear / (continuousRunDaysPerBatch + maintenanceDaysPerBatch)
designHours3Shift       = batchesPerYear × continuousRunDaysPerBatch × 3 × hoursPerShift
designCapacity3Shift    = extruderActualCapacityKgPerHour × designHours3Shift × yieldRate
normalOperatingHours    = batchesPerYear × continuousRunDaysPerBatch × normalShifts × hoursPerShift
normalCapacityKgYear    = extruderActualCapacityKgPerHour × normalOperatingHours × yieldRate   // = TT200, công suất bình thường TT200/IAS 2
```
`normalShifts = 3` là **định nghĩa "công suất bình thường"** dùng để tính giá thành
chuẩn — đổi số này = đổi chính sách giá, phải có ADR.

### 2.2 Chi phí sản xuất tại công suất bình thường
```
compoundLandedPerKg   = compoundReplacementPriceUsdPerKg × (1 + importTaxRate + logisticsFeeRate) × usdVndRate
materialPerKgFinished = compoundLandedPerKg / yieldRate            // hao hụt phế dồn vào tử số — phế không tái chế (UL)
extruderDepreciation  = (extruderPriceEach × extruderCount + moldPullerCutterCost) / depreciationYears
labor                 = normalShifts × peoplePerShift × avgSalaryMonthly × monthsSalaryPerYear × (1 + mandatoryInsuranceRate)
electricity           = electricityKw × electricityPricePerKwh × normalOperatingHours
water                 = waterM3PerHour × waterPricePerM3 × normalOperatingHours
sharedCostAllocationRatio = normalCapacityKgYear / (normalCapacityKgYear + fitting.estimatedProductionKgYear)
sharedCostAllocated       = assumptions.sharedFixedCosts.totalPerYear × sharedCostAllocationRatio
totalProcessingCostPerYear = extruderDepreciation + maintenancePerYear + labor + electricity + water + sharedCostAllocated
unitProcessingCostPerKg    = totalProcessingCostPerYear / normalCapacityKgYear
fullCostPerKg              = materialPerKgFinished + packagingCostPerKg + unitProcessingCostPerKg   // = "Giá thành đầy đủ (tại CS bình thường)" — breakEvenFullCost
vfPricePerKg               = fullCostPerKg × (1 + markupVfPipe)
```
**Sổ sách vs định giá** (ADR-002): `bookCompoundLandedPerKg` dùng
`assumptions.inventory.pipeWeightedAvgUsd` thay cho `compoundReplacementPriceUsdPerKg`
trong cùng công thức trên → `bookFullCostPerKg`. Chênh lệch giữa 2 dòng = lãi/(lỗ)
giữ kho (xem §5).

### 2.3 Bảng giá theo DN (đơn trọng kg/m riêng từng DN)
```
breakEvenPerM   = fullCostPerKg × unitWeightKgPerM
vfPricePerM     = breakEvenPerM × (1 + markupVfPipe)
tcgPricePerM    = vfPricePerM × (1 + markupTcg)
listPriceBeforeVat = ROUNDUP(tcgPricePerM / (1 − listPriceMargin), -2)   // làm tròn lên hàng trăm
listPriceWithVat   = listPriceBeforeVat × (1 + vatOutputRate)
```
8 DN cố định: DN20…DN100 (SDR 13.5) — dữ liệu đầy đủ trong `pipe.priceLadderByDN`.

### 2.4 CVP (hòa vốn) — driver kg
```
variableCostPerKg       = materialPerKgFinished + packagingCostPerKg + (electricityKw×electricityPricePerKwh + waterM3PerHour×waterPricePerM3) / (extruderActualCapacityKgPerHour × yieldRate)
contributionMarginPerKg = vfPricePerKg − variableCostPerKg
fixedCostPerYear         = extruderDepreciation + maintenancePerYear + labor + sharedCostAllocated   // KHÔNG gồm điện/nước (đã ở biến phí)
breakEvenKgYear          = fixedCostPerYear / contributionMarginPerKg
pctOfNormalCapacity      = breakEvenKgYear / normalCapacityKgYear
```

### 2.5 Thang giá theo bậc ca (1/2/3 ca) — `pipe.capacityTiers`
Cùng công thức §2.2 nhưng thay `normalShifts` bằng 1/2/3 và nhân công theo đúng số
ca đó (chi phí chung phân bổ GIỮ NGUYÊN mức hiện hành, không tính lại theo bậc ca).

---

## 3. Phụ kiện — `tests/fixtures/fitting.json` (driver: **giờ máy / MHR**, ép phun)

### 3.1 Bảng khuôn theo size (`fitting.moldTable`, 8 size)
```
shotsPerHour  = 3600 / cycleTimeSec
unitsPerHour  = shotsPerHour × cavity
```
`moldSetCount` — số bộ khuôn cùng size, ràng buộc công suất ở Plan_SX §6.4 (khuôn
chỉ chạy trên 1 máy tại 1 thời điểm).

### 3.2 Công suất xưởng ép
```
batchesPerYear             = operatingDaysPerYear / (continuousRunDaysPerBatch + maintenanceDaysPerBatch)
totalMachines               = machineTypeACount + machineTypeBCount
designMachineHours3Shift    = batchesPerYear × continuousRunDaysPerBatch × 3 × hoursPerShift × totalMachines
normalMachineHoursUtilized  = batchesPerYear × continuousRunDaysPerBatch × normalShifts × hoursPerShift × totalMachines × normalUtilizationFactor
estimatedProductionKgYear   = normalMachineHoursUtilized × avgProductivityKgPerMachineHour
```
Mặc định `normalShifts = 1`, `normalUtilizationFactor = 60%` — đổi 2 ô này = đổi
chính sách công suất chuẩn (khác hẳn Ống dùng cố định 3 ca), phải có ADR nếu đổi.
`hệ số huy động` gánh: đổi khuôn, chờ liệu, sự cố — KHÔNG phải hiệu suất máy.

### 3.3 MHR — đơn giá giờ máy (trái tim ADR-001)
```
compoundLandedPerKg = compoundReplacementPriceUsdPerKg × (1 + importTaxRate + logisticsFeeRate) × usdVndRate
machineMoldDepreciation = (machineTypeAPrice×machineTypeACount + machineTypeBPrice×machineTypeBCount + moldSetCostTotal66) / depreciationYears
labor        = normalShifts × peoplePerShift × avgSalaryMonthly × monthsSalaryPerYear × (1 + mandatoryInsuranceRate)
electricity  = electricityKwPerMachineHour × electricityPricePerKwh × normalMachineHoursUtilized
water        = waterM3PerMachineHour × waterPricePerM3 × normalMachineHoursUtilized
sharedCostAllocationRatio = estimatedProductionKgYear / (estimatedProductionKgYear + pipe.normalCapacityKgYear)
sharedCostAllocated       = assumptions.sharedFixedCosts.totalPerYear × sharedCostAllocationRatio
totalProcessingCostPerYear = machineMoldDepreciation + moldMaintenancePerYear + labor + electricity + water + sharedCostAllocated
mhrPerMachineHour          = totalProcessingCostPerYear / normalMachineHoursUtilized      // ĐƠN GIÁ GIỜ MÁY — MHR
```
`mhrPerMachineHour` là số DUY NHẤT dùng để tính giá từng SKU (§3.4) — không có
"chi phí gia công/kg" đồng đều cho phụ kiện; số quy-kg (`processingCostPerKgRef`)
chỉ để tham chiếu/so sánh, KHÔNG dùng để chào giá SKU.

### 3.4 Giá từng SKU (`fitting.skus`, 91 dòng)
```
machineHoursPerUnit  = cycleTimeSec / (3600 × cavity × yieldRate)     // phế vẫn tốn giờ máy → yield ở MẪU SỐ
materialCostPerUnit  = unitWeightKg × (compoundLandedPerKg / yieldRate + packagingCostPerKg)   // phế vẫn tốn nhựa → yield ở TỬ SỐ vật liệu
processingCostPerUnit = machineHoursPerUnit × mhrPerMachineHour
breakEvenPerUnit      = materialCostPerUnit + processingCostPerUnit + brassInsertCost
vfPricePerUnit        = breakEvenPerUnit × (1 + markupVfFitting)
tcgPricePerUnit       = vfPricePerUnit × (1 + markupTcg)
listPriceBeforeVat    = ROUNDUP(tcgPricePerUnit / (1 − listPriceMargin), -2)
listPriceWithVat      = listPriceBeforeVat × (1 + vatOutputRate)
```
13 họ sản phẩm × nhiều size = 91 SKU: Tê đều/giảm/ren trong, Cút 90º/45º/ren
trong, Nối thẳng/giảm/ren ngoài/ren trong, Mặt bích, Nắp bịt, Lơ thu.
`brassInsertCost` (ren đồng) hiện = 0 cho toàn bộ 91 SKU trong dữ liệu gốc — vẫn
phải giữ field vì có SKU tương lai cần ren đồng.

### 3.5 MHR theo bậc công suất (`fitting.mhrByCapacityTier`)
6 kịch bản = {1,2,3 ca} × {60%, 85% huy động}, cùng công thức §3.3 thay
`normalShifts`/`normalUtilizationFactor`, chi phí chung phân bổ GIỮ NGUYÊN.
`deltaVsStandard = tier.mhr / standard.mhr − 1` — dùng cảnh báo lệch giá khi đổi
chính sách công suất.

### 3.6 CVP phụ kiện (quy kg theo mix)
```
variableCostPerKg       = compoundLandedPerKg/yieldRate + packagingCostPerKg + (electricityKwPerMachineHour×electricityPricePerKwh + waterM3PerMachineHour×waterPricePerM3) / avgProductivityKgPerMachineHour
contributionMarginPerKg = vfPricePerKgRef − variableCostPerKg
fixedCostPerYear         = machineMoldDepreciation + moldMaintenancePerYear + labor + sharedCostAllocated
breakEvenKgYear          = fixedCostPerYear / contributionMarginPerKg
breakEvenMachineHours    = breakEvenKgYear / avgProductivityKgPerMachineHour
pctOfUtilizedHours       = breakEvenMachineHours / normalMachineHoursUtilized
```
Lưu ý: CVP phụ kiện quy đổi giờ máy → kg bằng `avgProductivityKgPerMachineHour`
(năng suất bình quân theo mix) — một xấp xỉ hợp lý ở mức tổng hợp, KHÔNG dùng số
này để định giá từng SKU (dùng MHR trực tiếp, xem §3.4).

---

## 4. Thang giá 5 bậc (Dashboard) — cùng công thức cho Ống & Phụ kiện
| Bậc | Công thức | Ai dùng |
|---|---|---|
| 1. Sàn biến phí (`variableCostFloor`) | `= cvp.variableCostPerKg` | Ranh đỏ tuyệt đối — không ai được bán thủng |
| 2. Hòa vốn tiền mặt (`cashBreakEven`) | `= variableCostFloor + (maintenancePerYear + labor + (annualComplianceFee + annualLandRent) × sharedCostAllocationRatio) / normalCapacityKgYear` — loại khấu hao (không phải dòng tiền) khỏi định phí | Quản trị — mức phòng thủ khi dòng tiền còn dương |
| 3. Giá thành đầy đủ (`breakEvenFullCost`) | `= fullCostPerKg` (Ống) / `= processingCostPerKgRef` quy đổi (Phụ kiện) | Giá vốn chuẩn TT200 — GĐ duyệt mới bán tới đây |
| 4. Hòa vốn toàn DN (`enterpriseBreakEven`) | `= fullCostPerKg + (operatingCostPerYear + financialCostPerYear) × revenueShare / normalCapacityKgYear`, trong đó `revenueShare = (capacity_dòng-này × vfPrice_dòng-này) / Σ_2-dòng(capacity × vfPrice)` — phân bổ theo TỶ TRỌNG DOANH THU tại giá VF, không theo kg | Giá bán thường ngày PHẢI trên mức này |
| 5. Giá mục tiêu (`targetPrice`) | `= vfPricePerKg` | Giá chào chuẩn — khoảng lùi 5→4→3 theo thẩm quyền |

Công thức chính xác từng bậc 2 và 4 tham chiếu chéo cả 2 sheet Ống + Phụ kiện (chi
phí ngoài SX phân bổ theo tỷ trọng doanh thu VF, không theo kg) — xem
`tests/fixtures/dashboard.json` cho số liệu vàng, và giữ nguyên logic tham chiếu
chéo này khi viết engine (không tách rời 2 driver ở bậc 2/4).

**Quy tắc thẩm quyền bán giá** (áp dụng UI phân quyền — xem PROJECT_SPEC §5):
bán dưới bậc 3 → cần duyệt GĐ; bán dưới bậc 4 (hòa vốn tiền mặt) → KHÔNG được bán
(trừ trường hợp đặc biệt được duyệt riêng); vai `sales` mặc định chỉ thấy bậc 3–5.

---

## 5. Giá vốn kép & tồn kho (ADR-002)
```
holdingGainLoss = Σ_dòng[ (replacementPriceUsd − weightedAvgUsd) × inventoryKg ] × (1 + importTaxRate + logisticsFeeRate) × usdVndRate
```
Dương = tái tạo > bình quân → lãi giữ kho (mua sớm giá rẻ), KHÔNG nhường vào giá
bán. Âm = tái tạo < bình quân → cảnh báo trích dự phòng giảm giá HTK (VAS 02) +
khuyến nghị reprice xuống. Ngưỡng khuyến nghị reprice bảng giá: lệch ±3–5% giữa
giá tái tạo và bình quân gia quyền.

**Độ nhạy giá** (dùng cho what-if UI):
```
deltaPipeCostPerKg = Δcompound_usd × (1 + importTaxRate + logisticsFeeRate) × usdVndRate / yieldRate
deltaListPrice      = deltaPipeCostPerKg × (1+markupVf) × (1+markupTcg) / (1-listPriceMargin)
```

---

## 6. Kế hoạch sản xuất (Plan_SX) — quy tắc, không phải số liệu vàng
Sheet này là **template nhập liệu** (input = 0 mặc định) nên không có "số vàng" để
parity-test — nhưng công thức/luật cảnh báo PHẢI tái tạo đúng trong engine phần kế
hoạch (`src/features/plan`):

1. **Quy đổi kế hoạch → giờ máy**: ống nhập MÉT theo DN → kg thành phẩm (×đơn
   trọng) → kg nạp máy (÷yieldRate) → giờ máy đùn (÷actualCapacity) → ngày SX
   (÷(batchesPerYear×continuousRunDays)). Phụ kiện nhập SỐ LƯỢNG theo SKU → giờ
   máy (×machineHoursPerUnit) → kg thành phẩm (×unitWeightKg) → kg nạp máy
   (÷yieldRate).
2. **Đánh giá ca máy** (áp dụng riêng Ống và Phụ kiện):
   `giờ khả dụng 1 ca/kỳ = capacity_formula × hệ số kỳ (số tháng/12)`; so tổng giờ
   cần với 1×/2×/3× giờ khả dụng → "OK", "CẢNH BÁO cần Nca", hoặc thiếu cả 3 ca →
   tính số máy cần thêm bằng ROUNDUP.
3. **Ràng buộc khuôn theo size** (chỉ Phụ kiện): tổng giờ máy cần cho 1 size DN so
   với `moldSetCount(size) × giới hạn giờ 3-ca-huy-động` — vượt → cảnh báo thiếu
   khuôn kèm số bộ cần thêm (ROUNDUP). Đây là ràng buộc RIÊNG của phụ kiện — ống
   không có khái niệm "khuôn theo size" giới hạn công suất tương tự.
4. **Nguyên liệu + ngoại tệ cần**: kg cần mua = kg nạp máy × (1 + hệ số dự phòng
   NVL); giá trị VNĐ = ×compoundLandedPerKg; ngoại tệ gốc = ×giá USD gốc (không
   nhân thuế/phí — dùng cho kế hoạch LC).
5. **Nhân công cần tuyển** = MAX(0, số ca cần × người/ca − nhân công hiện có).
6. **Chi phí/kg thực tế tại sản lượng kế hoạch** (chỉ Ống, dùng đánh giá công suất
   nhàn rỗi): `variableCostFloor + fixedCostPerYear × hệ số kỳ / kg kế hoạch` — so
   với `fullCostPerKg` chuẩn, dương = đang gánh công suất nhàn rỗi.

---

## 7. Bảng giá (PriceList) — quy tắc tổng hợp
Thuần là **phép chiếu phẳng** (flatten), không có công thức riêng: 8 dòng ống (từ
`pipe.priceLadderByDN`, cột giá = `listPriceBeforeVat`/`listPriceWithVat`) nối
tiếp 91 dòng phụ kiện (từ `fitting.skus`, cùng 2 cột). Thứ tự hiển thị UI nên theo
đúng thứ tự này (ống trước, rồi theo nhóm sản phẩm phụ kiện) — xem
`tests/fixtures/price-list.json` cho thứ tự chuẩn 99 dòng.

---

## 8. Bảng đối chiếu thuật ngữ code ↔ Excel ↔ UI
Xem `docs/GLOSSARY.md`. Các field mới trong fixture chưa có ở glossary
(`machineHoursPerUnit`, `sharedCostAllocationRatio`, `brassInsertCost`,
`moldSetCount`, `normalUtilizationFactor`...) dùng tên tiếng Anh camelCase, bổ
sung nhãn tiếng Việt vào GLOSSARY khi lên UI thật (Pha 2).
