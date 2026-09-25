import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { TextInput } from '@/components/FormInputs';
import { LockKeyhole, LogIn, UserPlus, KeyRound, ArrowLeft } from 'lucide-react';


function getChineseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Invalid login credentials')) return '邮箱地址或密码输入错误';
  if (message.includes('Email not confirmed')) return '请先到邮箱完成验证';
  if (message.includes('User already registered')) return '此邮箱已注册';
  if (message.includes('Password should be at least')) return '密码至少需要 6 个字符';
  if (message.includes('Email rate limit exceeded')) return '操作过于频繁，请稍后再试';
  if (message.includes('User not found')) return '找不到账号';
  if (message.includes('Database error')) return '数据库保存失败';
  if (message.includes('duplicate key')) return '资料已存在';
  if (message.includes('permission denied')) return '权限不足';
  if (message.includes('network')) return '网络连接失败';
  if (message.includes('For security purposes, you can only request this after')) {
    const secondsMatch = message.match(/\d+/);
    if (secondsMatch) {
      return `出于安全考虑，请等待 ${secondsMatch[0]} 秒后再试`;
    }
    return '出于安全考虑，操作过于频繁，请稍后再试';
  }

  return message;
}

interface StudentLoginProps {
  onLogin: (student: Student) => void;
  recovery?: boolean;
}

type AuthMode = 'login' | 'register' | 'reset';

export function StudentLogin({ onLogin, recovery = false }: StudentLoginProps) {
  const { show } = useToast();

  const [mode, setMode] = useState<AuthMode>(recovery ? 'reset' : 'login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  async function loadProfile(authUserId: string) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) {
      throw new Error('学房生账号不存在或已被停用');
    }

    onLogin(data as Student);
  }

  async function handleResetPassword() {
    if (!formData.newPassword || formData.newPassword.length < 6) {
      show('新密码至少需要 6 个字符', 'error');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      show('两次输入的新密码不一致', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
      if (error) throw error;

      await supabase.auth.signOut();
      setFormData((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }));
      setMode('login');
      show('密码已成功更新，请使用新密码登入');
    } catch (error) {
      show(getChineseError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (mode === 'reset') {
      await handleResetPassword();
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedName = formData.name.trim();

    if (!normalizedEmail || !formData.password || (mode === 'register' && !normalizedName)) {
      show(mode === 'register' ? '请输入学房生姓名、邮箱地址和密码' : '请输入邮箱地址和密码', 'error');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: formData.password,
          options: { data: { student_name: normalizedName } },
        });

        if (error || !data.user) throw error || new Error('注册失败');

        if (!data.session) {
          show('注册成功，请先到邮箱确认账号，再回来登入');
          setMode('login');
        } else {
          show('注册成功');
          await loadProfile(data.user.id);
        }
        return;
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, status')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (studentError) throw new Error('无法检查账号资料，请稍后再试');

      if (!student) {
        show('请先进行注册', 'error');
        setMode('register');
        return;
      }

      if (student.status === 'inactive') {
        show('此账号已被停用，无法登入，请联系管理员', 'error');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: formData.password,
      });

      if (error || !data.user) throw error;

      await loadProfile(data.user.id);
      show('登入成功');
    } catch (error) {
      show(getChineseError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!normalizedEmail) {
      show('请先输入注册用的邮箱地址', 'error');
      return;
    }

    try {
      const { data: student, error: lookupError } = await supabase
        .from('students')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (lookupError || !student) {
        show(lookupError ? '无法检查邮箱地址，请稍后再试' : '此邮箱地址尚未注册', 'error');
        return;
      }

      const redirectUrl = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;
      show('密码重置链接已发送到你的邮箱');
    } catch (error) {
      show(getChineseError(error), 'error');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
            <LockKeyhole className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">活水611学房功课管理系统</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? '学房生登入' : mode === 'register' ? '注册学房生账号' : '设置新密码'}
          </p>
        </div>

        {/* Login / Register tabs */}
        {mode !== 'reset' && (
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            {(['login', 'register'] as const).map((tabMode) => (
              <button
                key={tabMode}
                type="button"
                onClick={() => setMode(tabMode)}
                className={`rounded-md py-2 text-sm font-medium transition-all ${
                  mode === tabMode ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {tabMode === 'login' ? '登入' : '注册'}
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'reset' ? (
            <>
              <TextInput
                label="新密码"
                type="password"
                value={formData.newPassword}
                onChange={handleChange('newPassword')}
                placeholder="至少 6 个字符"
              />
              <TextInput
                label="确认新密码"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="请再次输入新密码"
              />
            </>
          ) : (
            <>
              {mode === 'register' && (
                <TextInput
                  label="学房生姓名"
                  value={formData.name}
                  onChange={handleChange('name')}
                  placeholder="请输入姓名"
                />
              )}

              <TextInput
                label="邮箱地址"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="name@gmail.com"
              />

              <TextInput
                label="密码"
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="请输入密码"
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {mode === 'login' && <LogIn className="h-4 w-4" />}
            {mode === 'register' && <UserPlus className="h-4 w-4" />}
            {mode === 'reset' && <KeyRound className="h-4 w-4" />}

            {loading ? '处理中...' : mode === 'reset' ? '更新密码' : mode === 'login' ? '登入' : '注册'}
          </button>
        </form>

        {/* Forgot password or Return to Login */}
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => void handleForgotPassword()}
            className="mt-4 w-full text-center text-sm text-teal-600 hover:text-teal-700"
          >
            忘记密码？点击重置密码
          </button>
        )}

        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => setMode('login')}
            className="mt-4 inline-flex items-center justify-center gap-1 w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回登入页面
          </button>
        )}
      </div>
    </div>
  );
}