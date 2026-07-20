// ADR-040 — test tích hợp HTTPS Callable `askAssistant` (Trợ Lý Ảo toàn app)
// trên Functions + Auth Emulator THẬT. Không set ANTHROPIC_API_KEY → trả câu
// trả lời fallback hướng dẫn (nút không bao giờ chết). Verify: ranh giới quyền,
// AssistantAnswer hợp lệ, audit ghi dấu vết (kind assistant, KHÔNG lưu câu hỏi).
//
// KHÔNG chạy trong `npm test` — chạy qua `npm run test:functions`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { AssistantAnswerSchema } from '../../src/schemas/assistant.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCENARIO_ID = 'assistant-test-scenario';

describe('HTTPS Callable askAssistant (emulator thật, ADR-040)', () => {
  let app: App;
  let db: Firestore;
  let auth: Auth;
  let projectId: string;
  let authPort: number;
  let functionsPort: number;
  const idTokenByUid = new Map<string, string>();

  async function idTokenFor(uid: string, role?: string): Promise<string> {
    const cached = idTokenByUid.get(uid);
    if (cached) return cached;
    await auth.createUser({ uid }).catch(() => undefined);
    if (role) await auth.setCustomUserClaims(uid, { role });
    const customToken = await auth.createCustomToken(uid);
    const res = await fetch(
      `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
    );
    const body = (await res.json()) as { idToken?: string };
    if (!body.idToken) throw new Error(`Auth Emulator không trả idToken cho uid=${uid}`);
    idTokenByUid.set(uid, body.idToken);
    return body.idToken;
  }

  async function callAsk(data: unknown, idToken?: string) {
    const res = await fetch(`http://127.0.0.1:${functionsPort}/${projectId}/us-central1/askAssistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ data }),
    });
    return { status: res.status, json: (await res.json()) as any };
  }

  beforeAll(async () => {
    const firebaseJson = JSON.parse(readFileSync(path.join(rootDir, 'firebase.json'), 'utf8'));
    const firebaserc = JSON.parse(readFileSync(path.join(rootDir, '.firebaserc'), 'utf8'));
    projectId = firebaserc.projects.default;
    authPort = firebaseJson.emulators.auth.port;
    functionsPort = firebaseJson.emulators.functions.port;
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firebaseJson.emulators.firestore.port}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`;
    app = initializeApp({ projectId }, 'ask-assistant-test');
    db = getFirestore(app);
    auth = getAuth(app);
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection(`scenarios/${SCENARIO_ID}/adviceAudit`));
    await deleteApp(app);
  });

  it('admin hỏi → trả AssistantAnswer fallback (chưa set key) + ghi audit kind assistant', async () => {
    const { status, json } = await callAsk(
      { scenarioId: SCENARIO_ID, screenId: 'pricing', question: 'Giá VF neo trên cái gì?', history: [] },
      await idTokenFor('asst-admin', 'admin'),
    );
    expect(status).toBe(200);
    expect(() => AssistantAnswerSchema.parse(json.result)).not.toThrow();
    expect(json.result.generatedByModel).toBe('fallback'); // chưa cấu hình ANTHROPIC_API_KEY
    expect(json.result.answer.length).toBeGreaterThan(20);

    const auditSnap = await db.collection(`scenarios/${SCENARIO_ID}/adviceAudit`).where('uid', '==', 'asst-admin').get();
    expect(auditSnap.size).toBe(1);
    const audit = auditSnap.docs[0]!.data();
    expect(audit).toMatchObject({ kind: 'assistant', role: 'admin', screenId: 'pricing', model: 'fallback' });
    expect(audit.question).toBeUndefined(); // KHÔNG lưu nội dung câu hỏi
  }, 25000);

  it('sales bị permission-denied; anon unauthenticated; request sai schema → invalid-argument', async () => {
    const salesCall = await callAsk(
      { scenarioId: SCENARIO_ID, screenId: 'pricing', question: 'x', history: [] },
      await idTokenFor('asst-sales', 'sales'),
    );
    expect(salesCall.status).toBe(403);

    const anonCall = await callAsk({ scenarioId: SCENARIO_ID, screenId: 'pricing', question: 'x', history: [] });
    expect(anonCall.status).toBe(401);

    const badCall = await callAsk(
      { scenarioId: SCENARIO_ID, screenId: 'pricing', question: '', history: [] },
      await idTokenFor('asst-admin2', 'admin'),
    );
    expect(badCall.status).toBe(400);
  }, 25000);
});
