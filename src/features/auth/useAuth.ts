// M12.5 / ADR-023 — hook auth theo vai (custom claim `role`, firestore.rules).
// `signIn` = đăng nhập production thật (email/mật khẩu); `resetPassword` = gửi
// email đặt lại mật khẩu khi quên. Lối tắt đăng nhập demo theo vai đã gỡ bỏ —
// production lẫn emulator đều đăng nhập bằng email/mật khẩu.
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, roleOf, sendPasswordReset, signInWithEmail, signOutCurrentUser, type AppRole } from '../../lib/firebase.js';

export interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  role: AppRole | null;
  /** ADR-023 — đăng nhập thật bằng email/mật khẩu. Lỗi → trả message tiếng Việt. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Đăng xuất. */
  signOut: () => Promise<void>;
  /** Gửi email đặt lại mật khẩu. Lỗi → trả message tiếng Việt, thành công → null. */
  resetPassword: (email: string) => Promise<string | null>;
}

function messageForAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (code === 'auth/too-many-requests') return 'Đăng nhập sai quá nhiều lần — thử lại sau ít phút.';
  if (code === 'auth/user-disabled') return 'Tài khoản đã bị vô hiệu hoá.';
  if (code === 'auth/invalid-email') return 'Email không hợp lệ.';
  return `Không đăng nhập được: ${err instanceof Error ? err.message : String(err)}`;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<Pick<AuthState, 'status' | 'user' | 'role'>>({
    status: 'loading',
    user: null,
    role: null,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ status: 'signed-out', user: null, role: null });
        return;
      }
      void roleOf(user).then((role) => setState({ status: 'signed-in', user, role }));
    });
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmail(email.trim(), password);
      return null;
    } catch (err) {
      return messageForAuthError(err);
    }
  };

  const signOut = async (): Promise<void> => {
    await signOutCurrentUser();
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    try {
      await sendPasswordReset(email.trim());
      return null;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/invalid-email') return 'Email không hợp lệ.';
      if (code === 'auth/user-not-found') return 'Không tìm thấy tài khoản với email này.';
      if (code === 'auth/too-many-requests') return 'Gửi yêu cầu quá nhiều lần — thử lại sau ít phút.';
      return `Không gửi được email đặt lại mật khẩu: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  return { ...state, signIn, signOut, resetPassword };
}
