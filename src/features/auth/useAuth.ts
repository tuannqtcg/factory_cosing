// M12.5 — hook auth theo vai (custom claim `role`, firestore.rules M12.3).
// Nút vai trên sidebar = đăng nhập user demo tương ứng (chế độ emulator, xem
// src/lib/firebase.ts).
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, roleOf, signInAsRole, type AppRole } from '../../lib/firebase.js';

export interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  role: AppRole | null;
  /** Đăng nhập bằng user demo của vai (emulator). Lỗi (chưa seed) → trả message. */
  switchRole: (role: AppRole) => Promise<string | null>;
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

  const switchRole = async (role: AppRole): Promise<string | null> => {
    try {
      await signInAsRole(role);
      return null;
    } catch {
      return 'Không đăng nhập được user demo — đã chạy `npm run seed:emulator` (và emulator đang chạy) chưa?';
    }
  };

  return { ...state, switchRole };
}
