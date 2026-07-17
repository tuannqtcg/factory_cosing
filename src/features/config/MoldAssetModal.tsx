// ADR-033 — modal Quản lý Khuôn mẫu Phụ kiện. TRÌNH BÀY: Tailwind + shadcn/ui
// (Card/Input/Button), overlay đen mờ, KHÔNG inline-style hardcode. Chrome đen–trắng;
// nút Lưu = ĐEN (Button default). Logic/props/format số giữ NGUYÊN.
import React, { useState } from 'react';
import type { MoldAsset } from '../../schemas/resource.js';
import { fmtVnd } from '../../lib/format.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface MoldAssetModalProps {
  initialMolds: MoldAsset[];
  onSave: (molds: MoldAsset[]) => void;
  onClose: () => void;
  canEdit: boolean;
}

export function MoldAssetModal({ initialMolds, onSave, onClose, canEdit }: MoldAssetModalProps) {
  const [molds, setMolds] = useState<MoldAsset[]>([...initialMolds]);

  const handleChange = (index: number, key: keyof MoldAsset, value: string | number) => {
    const newMolds = [...molds];
    // Need to cast to any to bypass TS complaining about spread with union keys
    const updatedMold: any = { ...newMolds[index] };
    updatedMold[key] = value;
    newMolds[index] = updatedMold as MoldAsset;
    setMolds(newMolds);
  };

  const totalCost = molds.reduce((sum, m) => sum + m.costVnd, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-full w-full max-w-[900px] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Quản lý Danh sách Khuôn mẫu Phụ kiện</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Tổng cộng: <strong className="text-foreground">{molds.length}</strong> bộ khuôn — Tổng giá trị:{' '}
              <strong className="text-foreground tabular-nums">{fmtVnd(totalCost)} đ</strong>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng" className="text-xl text-muted-foreground">
            &times;
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Table>
            <TableHeader className="sticky -top-6 z-10 bg-card">
              <TableRow>
                <TableHead>Tên Khuôn / Kích thước</TableHead>
                <TableHead className="w-[80px] text-right">Số Cavity</TableHead>
                <TableHead className="w-[160px] text-right">Nguyên giá (VND)</TableHead>
                <TableHead className="w-[110px] text-right">Khấu hao (năm)</TableHead>
                <TableHead className="w-[90px] text-right">Năm mua</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {molds.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Input
                      type="text"
                      value={m.label}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(i, 'label', e.target.value)}
                      className="h-8 border-transparent bg-transparent px-2 font-medium text-foreground shadow-none focus-visible:border-input focus-visible:bg-card focus-visible:ring-0"
                    />
                    <div className="pl-2 text-eyebrow text-faint">Mã: {m.id}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={m.cavity}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(i, 'cavity', parseFloat(e.target.value) || 0)}
                      className="h-8 px-2 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={m.costVnd}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(i, 'costVnd', parseFloat(e.target.value) || 0)}
                      className="h-8 px-2 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={m.usefulLifeYears}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(i, 'usefulLifeYears', parseFloat(e.target.value) || 0)}
                      className="h-8 px-2 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={m.purchaseYear}
                      disabled={!canEdit}
                      onChange={(e) => handleChange(i, 'purchaseYear', parseFloat(e.target.value) || 0)}
                      className="h-8 px-2 text-right tabular-nums"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {canEdit ? (
          <div className="flex justify-end gap-3 border-t bg-muted px-6 py-4">
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button onClick={() => onSave(molds)}>Lưu Thay Đổi</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t bg-muted px-6 py-4">
            <div className="text-xs text-muted-foreground">Bạn không có quyền chỉnh sửa tài sản khuôn. Vui lòng liên hệ Admin.</div>
            <Button variant="outline" onClick={onClose}>Đóng</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
