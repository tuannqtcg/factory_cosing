# ADR-003: Lộ trình tổng quát hóa — không universal hóa sớm
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN

Phase 1: app cho đúng BlazeMaster, hardcode 2 driver. Phase 2: engine pure function
+ driver plugin + UI sinh từ schema. Phase 3: template ngành khác CHỈ khi có nhu cầu
thật; routing đa công đoạn CHỈ khi có đơn hàng đòi hỏi. Lý do: nghĩa địa phần mềm
đầy tool "universal" chết vì tổng quát hóa trước khi có người dùng thứ hai.
