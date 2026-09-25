import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ToastProvider } from '@/components/Toast';
import { TeacherHome } from '@/pages/teacher/TeacherHome';
import { SeriesManager } from '@/pages/teacher/SeriesManager';
import { StudentManager } from '@/pages/teacher/StudentManager';
import { RecordsManager } from '@/pages/teacher/RecordsManager';
import { StudentLogin } from '@/pages/student/StudentLogin';
import { StudentHome } from '@/pages/student/StudentHome';
import { SeriesTask } from '@/pages/student/SeriesTask';
import { ScriptureTask } from '@/pages/student/ScriptureTask';
import { AdminPasswordLogin } from '@/pages/admin/AdminPasswordLogin';
import { supabase } from '@/lib/supabase';

const adminLoginEmails = {
  teacher: (import.meta.env.VITE_TEACHER_LOGIN_EMAIL || 'teacher@email.com').toLowerCase(),
  principal: (import.meta.env.VITE_PRINCIPAL_LOGIN_EMAIL || 'principal@email.com').toLowerCase(),
};

function TeacherRoute() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === '/admin/teacher/student-management') {
    return <StudentManager onBack={() => navigate('/admin/teacher/home')} onLogout={() => { void supabase.auth.signOut(); navigate('/teacher/login'); }} />;
  }  
  if (pathname === '/admin/teacher/series-management') {
    return <SeriesManager onBack={() => navigate('/admin/teacher/home')} onLogout={() => { void supabase.auth.signOut(); navigate('/teacher/login'); }} />;
  }
  if (pathname === '/admin/teacher/records-management') {
    return <RecordsManager onBack={() => navigate('/admin/teacher/home')} onLogout={() => { void supabase.auth.signOut(); navigate('/teacher/login'); }} />;
  }
  if (pathname === '/admin/teacher/home') {
    return (
      <TeacherHome
        onNavigate={(nextPage) => {
          const paths = {
            students: '/admin/teacher/student-management',
            series: '/admin/teacher/series-management',
            records: '/admin/teacher/records-management',
          } as const;
          navigate(paths[nextPage]);
        }}
        onLogout={() => { void supabase.auth.signOut(); navigate('/teacher/login'); }}
        onBack={() => {
          void supabase.auth.signOut();
          navigate('/teacher/login');
        }}
      />
    );
  }

  return <Navigate to="/admin/teacher/home" replace />;
}

function StudentRoute() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [student, setStudent] = useState<import('@/lib/types').Student | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true);
        setStudent(null);
        setCheckingSession(false);
      } else if (!session) {
        setStudent(null);
        setCheckingSession(false);
      }
    });

    async function loadSession() {
      if (
        window.location.search.includes('recovery=true') ||
        window.location.hash.includes('type=recovery')
      ) {
        setRecoveringPassword(true);
        setCheckingSession(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setCheckingSession(false);
        return;
      }
      const { data: profile } = await supabase.from('students').select('*').eq('auth_user_id', data.session.user.id).eq('status', 'active').maybeSingle();
      if (!profile) {
        const email = data.session.user.email?.toLowerCase();
        if (email === adminLoginEmails.teacher) {
          navigate('/admin/teacher/home', { replace: true });
          return;
        }
        if (email === adminLoginEmails.principal) {
          navigate('/admin/principal/records', { replace: true });
          return;
        }
      }
      if (active) {
        setStudent((profile as import('@/lib/types').Student | null) || null);
        setCheckingSession(false);
      }
    }
    void loadSession();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) return null;

  if (!student) {
    return (
      <StudentLogin
        recovery={recoveringPassword}
        onLogin={(loggedInStudent) => {
          setStudent(loggedInStudent);
          navigate('/student/home', { replace: true });
        }}
      />
    );
  }

  if (pathname === '/student/series') {
    return <SeriesTask student={student} onBack={() => navigate('/student/home')} onLogout={() => { void supabase.auth.signOut(); setStudent(null); navigate('/'); }} />;
  }
  if (pathname === '/student/scripture') {
    return <ScriptureTask student={student} onBack={() => navigate('/student/home')} onLogout={() => { void supabase.auth.signOut(); setStudent(null); navigate('/'); }} />;
  }
  if (pathname === '/student/home' || pathname === '/') {
    return (
      <StudentHome
        student={student}
        onNavigate={(nextPage) => navigate(`/student/${nextPage}`)}
        onLogout={() => {
          void supabase.auth.signOut();
          setStudent(null);
          navigate('/');
        }}
      />
    );
  }

  return <Navigate to="/student/home" replace />;
}

function SessionTimeout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = 30 * 60 * 1000;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.auth.signOut();
        navigate(pathname.startsWith('/admin/teacher') ? '/teacher/login' : pathname.startsWith('/admin/principal') ? '/principal/login' : '/', { replace: true });
      }, timeout);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [navigate, pathname]);

  return null;
}

function AdminGuard({ role, children }: { role: 'teacher' | 'principal'; children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email?.toLowerCase();
      if (active) {
        setAuthorized(email === adminLoginEmails[role]);
      }
    }

    void checkAccess();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email?.toLowerCase();
      if (active) {
        setAuthorized(email === adminLoginEmails[role]);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [role]);

  if (authorized === null) {
    return null;
  }
  if (!authorized) {
    return <Navigate to={role === 'teacher' ? '/teacher/login' : '/principal/login'} replace />;
  }
  return <>{children}</>;
}

function AdminTeacherRoute() {
  return (
    <AdminGuard role="teacher">
      <TeacherRoute />
    </AdminGuard>
  );
}

function TeacherLoginRoute() {
  const navigate = useNavigate();
  return (
    <AdminPasswordLogin
      role="teacher"
      onLogin={() => navigate('/admin/teacher/home', { replace: true })}
    />
  );
}

function PrincipalRoute() {
  const navigate = useNavigate();

  return (
    <RecordsManager
      onBack={() => navigate('/admin/principal/records')}
      onLogout={() => { void supabase.auth.signOut(); navigate('/principal/login'); }}
      readOnly
      principalMode
    />
  );
}

function AdminPrincipalRoute() {
  return (
    <AdminGuard role="principal">
      <PrincipalRoute />
    </AdminGuard>
  );
}

function PrincipalLoginRoute() {
  const navigate = useNavigate();
  return (
    <AdminPasswordLogin
      role="principal"
      onLogin={() => navigate('/admin/principal/records', { replace: true })}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <SessionTimeout />
        <Routes>
          <Route path="/" element={<StudentRoute />} />
          <Route path="/reset-password" element={<StudentRoute />} />
          <Route path="/student/*" element={<StudentRoute />} />

          <Route path="/teacher/login" element={<TeacherLoginRoute />} />
          <Route path="/admin/teacher/*" element={<AdminTeacherRoute />} />

          <Route path="/principal/login" element={<PrincipalLoginRoute />} />
          <Route path="/admin/principal/records" element={<AdminPrincipalRoute />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}