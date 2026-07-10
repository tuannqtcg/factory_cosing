// ADR-017 — test tích hợp HTTPS Callable `setUserRole` (functions/src/index.ts)
// trên Firestore + Functions + Auth Emulator THẬT: tạo user với custom claim
// `role` qua Admin SDK, đổi custom token lấy idToken thật, gọi callable qua
// giao thức HTTP onCall — verify CẢ việc set claim thật (đọc lại qua
// auth.getUser) lẫn ranh giới quyền (chỉ admin gọi được) và audit log
// roleAudit/{entryId} ghi đúng, không chỉ tin code đọc claim đúng.
//
// KHÔNG chạy trong `npm test` — chạy qua `npm run test:functions`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('HTTPS Callable setUserRole (emulator thật, ADR-017)', () => {
  let app: App;
  let db: Firestore;
  let auth: Auth;
  let projectId: string;
  let authPort: number;
  let functionsPort: number;
  const idTokenByUid = new Map<string, string>();

  /** Đổi custom token (Admin SDK) lấy idToken THẬT từ Auth Emulator — idToken mang custom claim `role`. */
  async function idTokenFor(uid: string, role?: string): Promise<string> {
    const cached = idTokenByUid.get(uid);
    if (cached) return cached;
    await auth.createUser({ uid }).catch(() => undefined); // đã tồn tại từ lần chạy trước → bỏ qua
    if (role) await auth.setCustomUserClaims(uid, { role });
    const customToken = await auth.createCustomToken(uid);
    const res = await fetch(
      `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );
    const body = (await res.json()) as { idToken?: string };
    if (!body.idToken) throw new Error(`Auth Emulator không trả idToken cho uid=${uid}: ${JSON.stringify(body)}`);
    idTokenByUid.set(uid, body.idToken);
    return body.idToken;
  }

  /** Gọi callable theo đúng giao thức onCall: POST {data}, trả {status, json}. */
  async function callSetUserRole(data: unknown, idToken?: string) {
    const res = await fetch(`http://127.0.0.1:${functionsPort}/${projectId}/us-central1/setUserRole`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
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
    app = initializeApp({ projectId }, 'set-user-role-test');
    db = getFirestore(app);
    auth = getAuth(app);
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection('roleAudit'));
    await deleteApp(app);
  });

  it('admin cấp role cho user chưa có role nào → set claim thật + ghi roleAudit (oldRole=null)', async () => {
    await auth.createUser({ uid: 'sur-target-1', email: 'sur-target-1@test.local' }).catch(() => undefined);

    const { status, json } = await callSetUserRole(
      { targetUid: 'sur-target-1', role: 'pricing' },
      await idTokenFor('sur-admin', 'admin'),
    );
    expect(status).toBe(200);
    expect(json.result).toEqual({
      targetUid: 'sur-target-1',
      targetEmail: 'sur-target-1@test.local',
      oldRole: null,
      newRole: 'pricing',
    });

    // Claim THẬT đã set trên Auth Emulator (không chỉ tin response) — đọc lại độc lập.
    const targetUser = await auth.getUser('sur-target-1');
    expect(targetUser.customClaims?.role).toBe('pricing');

    const auditSnap = await db.collection('roleAudit').where('targetUid', '==', 'sur-target-1').get();
    expect(auditSnap.size).toBe(1);
    const audit = auditSnap.docs[0]!.data();
    expect(audit).toMatchObject({
      targetUid: 'sur-target-1',
      targetEmail: 'sur-target-1@test.local',
      oldRole: null,
      newRole: 'pricing',
      changedByUid: 'sur-admin',
    });
    expect(audit.at).toBeDefined();
  }, 20000);

  it('admin đổi role user đã có role → oldRole phản ánh đúng giá trị TRƯỚC đó', async () => {
    await auth.createUser({ uid: 'sur-target-2' }).catch(() => undefined);
    await auth.setCustomUserClaims('sur-target-2', { role: 'sales' });

    const { status, json } = await callSetUserRole(
      { targetUid: 'sur-target-2', role: 'admin' },
      await idTokenFor('sur-admin', 'admin'),
    );
    expect(status).toBe(200);
    expect(json.result.oldRole).toBe('sales');
    expect(json.result.newRole).toBe('admin');

    const targetUser = await auth.getUser('sur-target-2');
    expect(targetUser.customClaims?.role).toBe('admin');
  }, 20000);

  it('vai không phải admin → permission-denied; chưa đăng nhập → unauthenticated', async () => {
    const pricingCall = await callSetUserRole(
      { targetUid: 'sur-target-1', role: 'admin' },
      await idTokenFor('sur-pricing', 'pricing'),
    );
    expect(pricingCall.status).toBe(403);
    expect(pricingCall.json.error.status).toBe('PERMISSION_DENIED');

    const anonCall = await callSetUserRole({ targetUid: 'sur-target-1', role: 'admin' });
    expect(anonCall.status).toBe(401);
    expect(anonCall.json.error.status).toBe('UNAUTHENTICATED');
  }, 20000);

  it('role không hợp lệ → invalid-argument; targetUid không tồn tại → not-found', async () => {
    const badRole = await callSetUserRole(
      { targetUid: 'sur-target-1', role: 'ceo' },
      await idTokenFor('sur-admin', 'admin'),
    );
    expect(badRole.status).toBe(400);
    expect(badRole.json.error.status).toBe('INVALID_ARGUMENT');

    const noSuchUser = await callSetUserRole(
      { targetUid: 'sur-does-not-exist', role: 'admin' },
      await idTokenFor('sur-admin', 'admin'),
    );
    expect(noSuchUser.status).toBe(404);
    expect(noSuchUser.json.error.status).toBe('NOT_FOUND');
  }, 20000);
});
