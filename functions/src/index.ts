// M12.4 + M12.4b + M12.4c — Cloud Function `onScenarioWrite`/`onPlanInputWrite`
// /`computeTargetCosting` (docs/contracts/scenario.md §5, ADR-010, ADR-013).
// Trigger onWrite scenarios/{id}: chạy calculateScenario() (M12.1,
// src/engine/scenario.ts — TÁI DÙNG nguyên, KHÔNG lặp lại công thức) bằng
// Admin SDK (đọc được ScenarioInput đầy đủ kể cả giá vốn), ghi tách
// outputs/internal (ScenarioOutput đầy đủ) + outputs/priceList (chỉ 4 field
// giá cuối + priceLadder — sales-safe). `firestore.rules` (M12.3) đã chặn
// client ghi trực tiếp 2 doc này (`allow write: if false`) — Admin SDK ở đây
// bỏ qua rules, đúng thiết kế.
//
// Orchestration KHÔNG nằm ở đây — engine pure đảm nhận
// (`calculateScenario`/`calculatePlanForScenario`/`computeTarget*ForScenario`),
// các function này chỉ làm auth + I/O Firestore + parse Zod 2 đầu.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString, defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  ScenarioInputSchema,
  ScenarioOutputSchema,
  PriceListDocSchema,
  ProductCatalogDocSchema,
  PlanInputSchema,
  PlanResultSchema,
  TargetProfitRequestSchema,
  TargetProfitResultSchema,
  TargetPriceRequestSchema,
  TargetPriceResultSchema,
  type ScenarioInput,
  type ScenarioOutput,
  type TargetProfitRequest,
  type TargetPriceRequest,
} from '../../src/schemas/scenario.js';
import {
  AppRoleSchema,
  SetUserRoleRequestSchema,
  SetUserRoleResultSchema,
  RoleAuditEntryFieldsSchema,
  type AppRole,
} from '../../src/schemas/role-management.js';
import { CeoAdviceRequestSchema, CeoAdviceResultSchema, type CeoAdviceResult } from '../../src/schemas/ceo-planner.js';
import { generateCeoAdviceMock } from '../../src/engine/ceo-advice-mock.js';
import { AssistantAskRequestSchema, AssistantAnswerSchema, type AssistantAnswer } from '../../src/schemas/assistant.js';
import {
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_DISCLAIMER,
  assistantFallbackAnswer,
} from '../../src/engine/assistant-knowledge.js';
import { calculateScenario } from '../../src/engine/scenario.js';
import { toPriceListDoc } from '../../src/engine/price-list-doc.js';
import { calculatePlanForScenario } from '../../src/engine/plan-support.js';
import { calculatePipeCapacity } from '../../src/engine/pipe.js';
import { calculateFittingCapacity } from '../../src/engine/fitting.js';
import { managementStatusOf } from '../../src/schemas/product.js';
import type { ContinuousKgResource, MachineHourResource } from '../../src/schemas/resource.js';
import {
  computeTargetProfitForScenario,
  computeTargetPriceForScenario,
} from '../../src/engine/target-costing.js';

initializeApp();

// Database Firestore không phải "(default)" cho project thật (đặt tên
// "manufacture" trên Console, xem docs/decisions/ADR-016). Đọc qua tham số
// hóa (functions/.env.<projectId>) để trigger CŨNG lắng nghe đúng database —
// nếu chỉ đổi getFirestore() mà bỏ trống "database" ở trigger, function sẽ
// lắng nghe nhầm "(default)" trống rỗng và KHÔNG BAO GIỜ chạy trên project
// thật (lỗi âm thầm, không có exception nào báo). Emulator/project demo
// (không có file .env riêng) rơi về default "(default)" — không đổi hành vi
// bộ test hiện có.
const firestoreDatabaseId = defineString('FIRESTORE_DATABASE_ID', { default: '(default)' });

// ADR-022 — AI tư vấn CEO. Key Claude API qua Secret (KHÔNG ở client, AGENTS.md #3);
// chưa set secret → callable rơi về mock rule-based. Model đọc thẳng process.env
// (KHÔNG defineString — string param vắng trong .env sẽ hỏi tương tác, treo
// emulators:exec), mặc định model Claude mới nhất phù hợp.
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const ADVISE_MODEL_DEFAULT = 'claude-opus-4-8';

// ADR-045 — dùng CHUNG toPriceListDoc với client (src/engine/price-list-doc.ts).

// ADR-014 (M12.7) — danh mục SP + tham số vận hành cho vai production dựng
// form Kế Hoạch SX. TUYỆT ĐỐI không field giá (xem ADR-014 mục 1).
function toProductCatalogDoc(scenarioInput: ScenarioInput) {
  const pipeResource = scenarioInput.resources.pipe as ContinuousKgResource;
  const fittingResource = scenarioInput.resources.fitting as MachineHourResource;
  const fittingProducts = scenarioInput.products.filter((p) => p.kind === 'fitting');
  const pipeCapacity = calculatePipeCapacity(pipeResource);
  const fittingCapacity = calculateFittingCapacity(fittingResource, fittingProducts);
  const materialNameOf = (id: string) => scenarioInput.materials.find((m) => m.id === id)?.name ?? id;

  return ProductCatalogDocSchema.parse({
    pipes: scenarioInput.products
      .filter((p) => p.kind === 'pipe')
      .map((p) => ({
        dn: p.dn,
        unitWeightKgPerM: p.unitWeightKgPerM,
        materialId: p.materialId,
        materialName: materialNameOf(p.materialId),
      })),
    fittings: fittingProducts.map((p) => ({
      productName: p.productName,
      sizeLabel: p.sizeLabel,
      unit: p.unit,
      unitWeightKg: p.unitWeightKg,
      cycleTimeSec: p.cycleTimeSec,
      cavity: p.cavity,
      managementStatus: managementStatusOf(p, fittingResource.moldAssets),
      materialId: p.materialId,
      materialName: materialNameOf(p.materialId),
    })),
    params: {
      pipe: {
        yieldRate: pipeResource.yieldRate,
        actualCapacityKgPerHour: pipeResource.actualCapacityKgPerHour,
        hoursPerShift: pipeResource.hoursPerShift,
        hoursAvailablePerShiftYear: pipeCapacity.normalOperatingHours / pipeResource.normalShifts,
        peoplePerShift: pipeResource.peoplePerShift,
      },
      fitting: {
        yieldRate: fittingResource.yieldRate,
        normalMachineHoursUtilizedYear: fittingCapacity.normalMachineHoursUtilized,
        peoplePerShift: fittingResource.peoplePerShift,
      },
    },
  });
}

export const onScenarioWrite = onDocumentWritten(
  { document: 'scenarios/{scenarioId}', database: firestoreDatabaseId },
  async (event) => {
  const { scenarioId } = event.params;
  const db = getFirestore(firestoreDatabaseId.value());
  const afterSnap = event.data?.after;

  if (!afterSnap?.exists) {
    // scenario bị xóa — dọn MỌI doc outputs đã tính (chỉ Cloud Function ghi
    // các doc này; outputs/plan thêm từ M12.4b, productCatalog từ M12.7 —
    // planInputs là INPUT của production, không phải doc tính ra, KHÔNG tự xóa).
    await Promise.all([
      db.doc(`scenarios/${scenarioId}/outputs/internal`).delete(),
      db.doc(`scenarios/${scenarioId}/outputs/priceList`).delete(),
      db.doc(`scenarios/${scenarioId}/outputs/plan`).delete(),
      db.doc(`scenarios/${scenarioId}/outputs/productCatalog`).delete(),
    ]);
    return;
  }

  const scenarioInput = ScenarioInputSchema.parse(afterSnap.data());
  const scenarioOutput = ScenarioOutputSchema.parse(calculateScenario(scenarioInput));

  await Promise.all([
    db.doc(`scenarios/${scenarioId}/outputs/internal`).set(scenarioOutput),
    db.doc(`scenarios/${scenarioId}/outputs/priceList`).set(toPriceListDoc(scenarioOutput, scenarioInput.products, scenarioInput.materials)),
    db.doc(`scenarios/${scenarioId}/outputs/productCatalog`).set(toProductCatalogDoc(scenarioInput)),
  ]);
});

// M12.4b (ADR-010) — `production` ghi PlanInput vào planInputs/{period} →
// tính PlanResult, GHI ĐÈ `outputs/plan` (1 doc DUY NHẤT theo path
// scenario.md §5, không sub-collection theo period — outputs/plan = kết quả
// của lần ghi planInput GẦN NHẤT, lý do ở ADR-010).
export const onPlanInputWrite = onDocumentWritten(
  { document: 'scenarios/{scenarioId}/planInputs/{period}', database: firestoreDatabaseId },
  async (event) => {
  const { scenarioId } = event.params;
  const db = getFirestore(firestoreDatabaseId.value());
  const planOutputRef = db.doc(`scenarios/${scenarioId}/outputs/plan`);
  const afterSnap = event.data?.after;

  if (!afterSnap?.exists) {
    // planInput bị xóa — dọn kết quả (đối xứng onScenarioWrite; outputs/plan
    // không lưu period nguồn nên không phân biệt được kết quả đang đứng có
    // thuộc period vừa xóa hay không → dọn luôn cho khỏi stale, ghi lại
    // planInput bất kỳ sẽ tính lại).
    await planOutputRef.delete();
    return;
  }

  const scenarioSnap = await db.doc(`scenarios/${scenarioId}`).get();
  if (!scenarioSnap.exists) {
    // planInput ghi vào scenario chưa/không tồn tại — không có gì để tính,
    // không throw (v2 mặc định không retry, throw chỉ làm bẩn log).
    console.error(`onPlanInputWrite: scenarios/${scenarioId} không tồn tại — bỏ qua planInputs/${event.params.period}`);
    return;
  }

  const scenarioInput = ScenarioInputSchema.parse(scenarioSnap.data());
  const planInput = PlanInputSchema.parse(afterSnap.data());
  const planResult = PlanResultSchema.parse(calculatePlanForScenario(scenarioInput, planInput));

  await planOutputRef.set(planResult);
});

// M12.4c (ADR-010 mục 3, ADR-013) — Target Costing T2/T3: HTTPS Callable
// (request/response rời rạc, KHÔNG phải trigger). Vai `pricing`/`admin` (custom
// claim `role`, bảng scenario.md §6). Phân biệt T2/T3 bằng field đặc thù của
// request (`targetProfitVnd` ⇔ T2, `targetListPriceVnd` ⇔ T3 — ADR-013 mục 4).
// Kết quả: TRẢ trực tiếp + GHI ĐÈ `outputs/targetCosting` (1 doc duy nhất,
// {kind, request, result} — request GẦN NHẤT, đối xứng outputs/plan).
export const computeTargetCosting = onCall(async (request) => {
  const role = request.auth?.token?.role;
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Cần đăng nhập để chạy Target Costing.');
  }
  if (role !== 'pricing' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Chỉ vai pricing/admin được chạy Target Costing (scenario.md §6, ADR-006).');
  }

  const data = request.data as Record<string, unknown> | null;
  const isT2 = data !== null && typeof data === 'object' && 'targetProfitVnd' in data;
  let parsed;
  try {
    parsed = isT2 ? TargetProfitRequestSchema.parse(data) : TargetPriceRequestSchema.parse(data);
  } catch (err) {
    throw new HttpsError('invalid-argument', `Request không khớp TargetProfitRequest/TargetPriceRequest: ${String(err)}`);
  }

  const db = getFirestore(firestoreDatabaseId.value());
  const scenarioSnap = await db.doc(`scenarios/${parsed.scenarioId}`).get();
  if (!scenarioSnap.exists) {
    throw new HttpsError('not-found', `scenarios/${parsed.scenarioId} không tồn tại.`);
  }
  const scenarioInput = ScenarioInputSchema.parse(scenarioSnap.data()) as ScenarioInput;

  let kind: 'targetProfit' | 'targetPrice';
  let result;
  try {
    if (isT2) {
      kind = 'targetProfit';
      result = TargetProfitResultSchema.parse(computeTargetProfitForScenario(scenarioInput, parsed as TargetProfitRequest));
    } else {
      kind = 'targetPrice';
      result = TargetPriceResultSchema.parse(computeTargetPriceForScenario(scenarioInput, parsed as TargetPriceRequest));
    }
  } catch (err) {
    // Lỗi engine ném ra ở tầng validate request (freeVarPath ngoài allowlist,
    // productKey sai/không có SKU, materialId không thuộc line) — lỗi CỦA
    // REQUEST, không phải lỗi hệ thống.
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : String(err));
  }

  await db.doc(`scenarios/${parsed.scenarioId}/outputs/targetCosting`).set({ kind, request: parsed, result });
  return { kind, result };
});

// ADR-017 — cấp/thu hồi custom claim `role` cho Firebase Auth user thật.
// Còn treo từ M12.10 (scenario.md "Còn treo"): `scripts/seed-emulator.ts` gọi
// Admin SDK trực tiếp CHỈ dùng được cho Emulator (môi trường tin cậy) — cần 1
// cơ chế cho project thật. Hướng đã chọn: Cloud Function onCall admin-only +
// audit log (không phải quy trình thủ công ngoài app), CHƯA cần UI riêng (gọi
// qua script, xem scripts/bootstrap-admin.ts cho lần cấp admin ĐẦU TIÊN — vấn
// đề con-gà-quả-trứng: chưa có admin nào thì chưa ai gọi được function này).
export const setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Cần đăng nhập để đổi role.');
  }
  if (request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Chỉ vai admin được cấp/thu hồi role (ADR-017).');
  }

  let parsed;
  try {
    parsed = SetUserRoleRequestSchema.parse(request.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', `Request không khớp SetUserRoleRequest: ${String(err)}`);
  }

  const auth = getAuth();
  let targetUser;
  try {
    targetUser = await auth.getUser(parsed.targetUid);
  } catch {
    throw new HttpsError('not-found', `Không tìm thấy user với uid ${parsed.targetUid}.`);
  }

  const oldRoleParsed = AppRoleSchema.safeParse(targetUser.customClaims?.role);
  const oldRole: AppRole | null = oldRoleParsed.success ? oldRoleParsed.data : null;

  await auth.setCustomUserClaims(parsed.targetUid, { ...targetUser.customClaims, role: parsed.role });

  const db = getFirestore(firestoreDatabaseId.value());
  const auditEntry = RoleAuditEntryFieldsSchema.parse({
    targetUid: parsed.targetUid,
    targetEmail: targetUser.email ?? null,
    oldRole,
    newRole: parsed.role,
    changedByUid: request.auth.uid,
    changedByEmail: request.auth.token.email ?? null,
  });
  await db.collection('roleAudit').add({ ...auditEntry, at: FieldValue.serverTimestamp() });

  return SetUserRoleResultSchema.parse({
    targetUid: parsed.targetUid,
    targetEmail: targetUser.email ?? null,
    oldRole,
    newRole: parsed.role,
  });
});

// ADR-022 — HTTPS Callable `adviseScenario`: AI tư vấn cho màn Trợ Lý CEO.
// Gọi Claude API phía server (key qua Secret); chưa cấu hình key hoặc lỗi → mock
// rule-based (nút không bao giờ chết). CHỈ nhận số liệu output đã tính, ghi audit.
export const adviseScenario = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  const role = request.auth?.token?.role;
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Cần đăng nhập để hỏi AI tư vấn.');
  }
  if (role !== 'pricing' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Chỉ vai pricing/admin được dùng AI tư vấn (ADR-006/022).');
  }

  let parsed;
  try {
    parsed = CeoAdviceRequestSchema.parse(request.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', `Request không khớp CeoAdviceRequest: ${String(err)}`);
  }

  // Sinh nhận định: ưu tiên Claude API khi có secret; lỗi/hết quota/chưa cấu hình → mock.
  let result: CeoAdviceResult;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const s = parsed.plannerResult.summary;
      const system =
        'Bạn là trợ lý tài chính cho CEO nhà máy CPVC. Đọc số liệu định giá + hiệu quả năm và ' +
        'đưa 4-7 nhận định NGẮN GỌN bằng tiếng Việt để CEO cầm đi đàm phán (sàn giá lùi tới đâu theo ' +
        'thang giá 5 bậc, rủi ro giá nguyên liệu, độ tin cậy thu hồi vốn, bức tranh năm). ' +
        'Trả về DUY NHẤT một mảng JSON: [{"topic":"...","message":"..."}] — không văn bản ngoài JSON.';
      const msg = await client.messages.create({
        model: process.env.ADVISE_MODEL ?? ADVISE_MODEL_DEFAULT,
        max_tokens: 2000,
        thinking: { type: 'adaptive' },
        system,
        messages: [{ role: 'user', content: JSON.stringify({ pipe: parsed.plannerResult.pipe, fitting: parsed.plannerResult.fitting, summary: s }) }],
      });
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      const jsonStart = text.indexOf('[');
      const jsonEnd = text.lastIndexOf(']');
      const items = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Array<{ topic: string; message: string }>;
      result = CeoAdviceResultSchema.parse({ generatedByModel: msg.model, items, disclaimer: 'Thuế TNDN 20% là ước tính. Nhận định tham khảo, không thay quyết định của CEO.' });
    } catch {
      result = generateCeoAdviceMock(parsed.plannerResult); // fallback khi Claude lỗi
    }
  } else {
    result = generateCeoAdviceMock(parsed.plannerResult);
  }

  // Audit: dấu vết ai gọi, khi nào, model gì (KHÔNG lưu nội dung nhạy cảm).
  const db = getFirestore(firestoreDatabaseId.value());
  await db.collection(`scenarios/${parsed.scenarioId}/adviceAudit`).add({
    uid: request.auth.uid,
    email: request.auth.token.email ?? null,
    role,
    model: result.generatedByModel,
    at: FieldValue.serverTimestamp(),
  });

  return result;
});

// ADR-040 — HTTPS Callable `askAssistant`: Trợ Lý Ảo toàn app. CEO hỏi tự do ở
// bất kỳ màn nào; server gọi Claude với kiến thức ngành CPVC + nghiệp vụ app
// (assistant-knowledge.ts) + số liệu ĐÃ TÍNH của kịch bản (đọc bằng Admin SDK).
// Chưa set ANTHROPIC_API_KEY hoặc Claude lỗi → fallback hướng dẫn (không chết).
// Audit dùng chung collection adviceAudit (kind: 'assistant').
export const askAssistant = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  const role = request.auth?.token?.role;
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Cần đăng nhập để hỏi trợ lý.');
  }
  if (role !== 'pricing' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Chỉ vai pricing/admin được dùng trợ lý (ADR-006).');
  }

  let parsed;
  try {
    parsed = AssistantAskRequestSchema.parse(request.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', `Request không khớp AssistantAskRequest: ${String(err)}`);
  }

  let answer: AssistantAnswer;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      // Ngữ cảnh số liệu GỌN từ dữ liệu đã tính — không tính lại công thức nào.
      const db = getFirestore(firestoreDatabaseId.value());
      const [scenarioSnap, internalSnap] = await Promise.all([
        db.doc(`scenarios/${parsed.scenarioId}`).get(),
        db.doc(`scenarios/${parsed.scenarioId}/outputs/internal`).get(),
      ]);
      const scenario = scenarioSnap.exists ? ScenarioInputSchema.parse(scenarioSnap.data()) : null;
      const internal = internalSnap.exists ? ScenarioOutputSchema.parse(internalSnap.data()) : null;
      const context = {
        screenId: parsed.screenId,
        materials: scenario?.materials.map((m) => ({
          name: m.name,
          markupVf: m.markupVf,
          replacementUsdPerKg: m.inventory.replacementPriceUsdPerKg,
          baselineUsdPerKg: m.inventory.priceLock.baseline,
          thresholdPct: m.inventory.priceLock.thresholdPct,
          inventoryLots: m.inventory.lots,
        })),
        markup: scenario?.costPool.markup,
        usdVndRate: scenario?.costPool.currency.usdVndRate,
        priceLadderPerKg: internal?.priceLadder.byLineMaterial.map((e) => ({
          line: e.line,
          materialId: e.materialId,
          ladder: e.ladder,
        })),
        priceLock: internal?.priceLock.byMaterial,
      };

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: process.env.ADVISE_MODEL ?? ADVISE_MODEL_DEFAULT,
        max_tokens: 1500,
        thinking: { type: 'adaptive' },
        system: ASSISTANT_SYSTEM_PROMPT,
        messages: [
          ...parsed.history.map((h) => ({ role: h.role, content: h.text })),
          {
            role: 'user' as const,
            content: `context: ${JSON.stringify(context)}\n\nCâu hỏi (đang đứng ở màn "${parsed.screenId}"): ${parsed.question}`,
          },
        ],
      });
      const text = msg.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
      answer = AssistantAnswerSchema.parse({
        generatedByModel: msg.model,
        answer: text || assistantFallbackAnswer(parsed.question),
        disclaimer: ASSISTANT_DISCLAIMER,
      });
    } catch {
      answer = AssistantAnswerSchema.parse({
        generatedByModel: 'fallback',
        answer: assistantFallbackAnswer(parsed.question),
        disclaimer: ASSISTANT_DISCLAIMER,
      });
    }
  } else {
    answer = AssistantAnswerSchema.parse({
      generatedByModel: 'fallback',
      answer: assistantFallbackAnswer(parsed.question),
      disclaimer: ASSISTANT_DISCLAIMER,
    });
  }

  // Audit: ai hỏi, khi nào, ở màn nào, model gì — KHÔNG lưu nội dung câu hỏi.
  const db = getFirestore(firestoreDatabaseId.value());
  await db.collection(`scenarios/${parsed.scenarioId}/adviceAudit`).add({
    kind: 'assistant',
    uid: request.auth.uid,
    email: request.auth.token.email ?? null,
    role,
    screenId: parsed.screenId,
    model: answer.generatedByModel,
    at: FieldValue.serverTimestamp(),
  });

  return answer;
});
