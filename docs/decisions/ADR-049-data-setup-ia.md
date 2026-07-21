# ADR-049 — Gộp cấu hình thành màn "Thiết lập dữ liệu" (IA — chỉ trình bày lại)

- **Ngày**: 2026-07-20
- **Trạng thái**: Đang làm (user duyệt bố cục prototype Pha 1 — `prototype/data-setup.html`)
- **Kế thừa**: ADR-018 (CAPEX/vốn động), ADR-007 (khấu hao khuôn), ADR-012 (multi-material), ADR-033 (design)

## Bối cảnh
2–3 mục "Dữ liệu gốc" (Tham Số · Cấu Hình Nhà Máy · Danh Mục) cắt theo loại máy/dòng
nên mỗi màn trộn lẫn nhiều bản chất kế toán (tài sản + vận hành + chi phí chung + tài
chính). User yêu cầu gộp thành **1 màn "Thiết lập dữ liệu"** xếp theo trật tự kế toán,
tách rõ ô NHẬP vs số TỰ TÍNH, dễ cho CEO/tài chính.

## Quyết định
1. Màn mới `DataSetupScreen` (tab `data-setup`), rail 6 mục con theo dòng chảy kế toán:
   ① Tài sản cố định · ② Chi phí chế biến · ③ Chi phí chung & ngoài SX · ④ Nguyên liệu ·
   ⑤ Danh mục SP · ⑥ Tham số tài chính; + "Báo cáo lãi/lỗ" (đọc, ở nhóm Theo dõi).
2. **CHỈ TRÌNH BÀY LẠI** — không schema mới, không engine mới, không ADR đổi logic:
   - Ô nhập ghi vào đúng field đang có (`resources.pipe/fitting`, `costPool.sharedFixedCosts`…),
     cùng chỗ Tham Số/Cấu Hình đang ghi; lưu qua `ScenarioInputSchema.safeParse` + `setDoc`.
   - Số `fx` (khấu hao, phân bổ, tổng) DÙNG công thức engine đang có: khấu hao thẳng =
     nguyên giá×SL/đời (khớp `extruderDepreciationPerYear` pipe.ts, machine dep fitting.ts,
     `sharedFixedCostsTotalPerYear` cost-pool.ts); khấu hao khuôn gọi `moldDepreciationPerYear`
     (ADR-007, theo năm mua). Chỉ hiển thị, không cho sửa.
3. **Phân loại tài sản đúng dữ liệu cũ**: máy đùn/kéo-cắt → Ống; máy ép/khuôn → Phụ kiện;
   **lab + UL + VN-UL + nhà xưởng → Chung** (khấu hao đời `sharedFixedCosts.depreciationYears`).
   Khuôn giữ logic dùng chung (nhiều SKU/1 khuôn, ADR-007/012/038) — quản lý qua `MoldAssetModal`.
4. **Phân bổ chi phí chung** = `sharedCostAllocationRatio` đang có (theo sản lượng kg/năm,
   Ống 93,2% / PK 6,8%) — tự tính, không nhập tay.
5. **Chi phí ngoài SX** (vận hành + tài chính) chỉ ở P&L (lãi/lỗ), KHÔNG vào giá thành/kg.
6. Luồng 1 chiều: Thiết lập → engine → báo cáo. Trợ Lý CEO = lớp giả định đọc cùng nguồn,
   không ghi ngược (trừ "Áp dụng vào thật", ADR-041).

## Trạng thái / còn treo
- **XONG toàn bộ mục** ①→⑦ + Báo cáo lãi/lỗ (typecheck + 380 test + build xanh). Mọi số
  `fx` kiểm chứng khớp engine đến từng đồng:
  - ① Khấu hao: Ống 2.326.037.867 · PK 2.824.550.000 · Chung 478.500.000 đ/năm.
  - ② Chế biến Ống = totalProcessingCostPerYear − sharedCostAllocated = 6.115.280.867.
  - ③ Phân bổ chung → Ống 1.168.797.614 (= sharedCostAllocated); tỷ lệ 93,2/6,8.
  - ⑦ Giá VF = giá thành × (1+markup) = targetPrice (Ống 135.890 · PK 252.846).
  - Báo cáo: doanh thu 95,6 tỷ · LN trước thuế 16,74 tỷ · sau thuế 13,39 tỷ (dashboard KPIs).
- **Markup VF chuyển ④ → ⑦** (ADR-049 bổ sung): markup là tầng ĐỊNH GIÁ, áp trên giá thành
  đầy đủ (đã có chi phí + hòa vốn), KHÔNG phải biến của nguyên liệu. Mục ⑦ hiển thị per-compound
  giá thành đầy đủ (fx) → hòa vốn (fx) → markup VF (nhập) → giá VF (fx live), kèm markup kênh TCG/NPP.
- Ô nhập có hiệu ứng hover/focus (viền + quầng đỏ) để phân biệt ô gõ được (class `.ds-in`).
- ⑤ Danh mục SP = nhúng ProductsScreen có sẵn (2 form độc lập — nhắc lưu mục khác trước).
- **Còn treo**: gỡ tab Tham Số/Cấu Hình khỏi nav khi user xác nhận màn mới thay thế đủ; cân nhắc
  hợp nhất 1 form (tránh clobber ⑤). Báo cáo đọc `form` (live) — chưa nối realtime doc.
