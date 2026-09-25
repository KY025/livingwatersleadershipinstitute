import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

interface AdminPasswordLoginProps {
  role: 'teacher' | 'principal';
  onLogin: () => void;
}

const loginEmails = {
  teacher: import.meta.env.VITE_TEACHER_LOGIN_EMAIL || 'teacher@email.com',
  principal: import.meta.env.VITE_PRINCIPAL_LOGIN_EMAIL || 'principal@email.com',
};

export function AdminPasswordLogin({ role, onLogin }: AdminPasswordLoginProps) {
  const { show } = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const roleLabel = role === 'teacher' ? '学房生导师' : '师母';
  const theme = role === 'teacher'
    ? {
        page: 'from-sky-50 via-white to-blue-50',
        iconBg: 'bg-sky-50',
        icon: 'text-sky-600',
        focus: 'focus:ring-sky-500/30 focus:border-sky-500',
        button: 'bg-sky-600 hover:bg-sky-700',
      }
    : {
        page: 'from-amber-50 via-white to-orange-50',
        iconBg: 'bg-amber-50',
        icon: 'text-amber-600',
        focus: 'focus:ring-amber-500/30 focus:border-amber-500',
        button: 'bg-amber-600 hover:bg-amber-700',
      };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      show('请输入密码登入', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmails[role],
      password,
    });
    setLoading(false);

    if (error) {
      show('登入密码错误', 'error');
      return;
    }
    setPassword('');
    onLogin();
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.page} flex items-center justify-center p-6`}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${theme.iconBg} mb-4`}>
            <LockKeyhole className={`w-7 h-7 ${theme.icon}`} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">{roleLabel}登入页面</h1>
          <p className="text-sm text-slate-500 mt-1">请输入密码登入</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={`mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-800 focus:outline-none ${theme.focus}`}
              placeholder="请输入密码"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white ${theme.button} disabled:opacity-50 transition-colors`}
          >
            <LogIn className="w-4 h-4" />
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
