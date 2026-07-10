// M12.10 (security-review) — audit log cho thao tác "Chốt Baseline Mới" (ADR-004
// re-lock giá). Dùng chung giữa Dashboard.tsx (M12.5) và AssumptionsScreen.tsx
// (M12.9d) — 2 nơi duy nhất gọi hành động này.
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import type { AppRole } from './firebase.js';
import { PriceLockAuditEntryFieldsSchema } from '../schemas/scenario.js';

export async function writePriceLockAuditEntry(
  scenarioId: string,
  entry: {
    materialId: string;
    materialName: string;
    oldBaselineUsdPerKg: number;
    newBaselineUsdPerKg: number;
    changedByUid: string;
    changedByEmail: string | null;
    changedByRole: Extract<AppRole, 'admin' | 'pricing'>;
  },
): Promise<void> {
  const fields = PriceLockAuditEntryFieldsSchema.parse(entry);
  await addDoc(collection(db, `scenarios/${scenarioId}/priceLockAudit`), { ...fields, at: serverTimestamp() });
}
