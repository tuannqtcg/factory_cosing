// ADR-017 — cơ chế cấp/thu hồi custom claim `role` cho Firebase Auth user thật
// (còn treo từ M12.10, xem docs/contracts/scenario.md "Còn treo"). Độc lập
// với ScenarioInput/Output — role là thuộc tính của USER, không của scenario
// nào, nên KHÔNG đặt trong scenario.ts. Chỉ Cloud Function `setUserRole`
// (Admin SDK, admin-only) mới ghi; client chỉ đọc audit log.
import { z } from 'zod';

export const AppRoleSchema = z.enum(['admin', 'pricing', 'sales', 'production']);
export type AppRole = z.infer<typeof AppRoleSchema>;

export const SetUserRoleRequestSchema = z.object({
  targetUid: z.string().min(1),
  role: AppRoleSchema,
});
export type SetUserRoleRequest = z.infer<typeof SetUserRoleRequestSchema>;

export const SetUserRoleResultSchema = z.object({
  targetUid: z.string(),
  targetEmail: z.string().nullable(),
  oldRole: AppRoleSchema.nullable(),
  newRole: AppRoleSchema,
});
export type SetUserRoleResult = z.infer<typeof SetUserRoleResultSchema>;

// Doc `roleAudit/{entryId}` (top-level, KHÔNG dưới scenarios/{id} — role
// không thuộc về 1 scenario) — APPEND ONLY (firestore.rules cấm update/delete
// kể cả admin, giống pattern priceLockAudit). `at` = serverTimestamp()
// (FieldValue sentinel) — KHÔNG qua Zod trước khi ghi, giống priceLockAudit.
export const RoleAuditEntryFieldsSchema = z.object({
  targetUid: z.string(),
  targetEmail: z.string().nullable(),
  oldRole: AppRoleSchema.nullable(),
  newRole: AppRoleSchema,
  changedByUid: z.string(),
  changedByEmail: z.string().nullable(),
});
export type RoleAuditEntryFields = z.infer<typeof RoleAuditEntryFieldsSchema>;
