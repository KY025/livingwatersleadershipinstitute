import { LayoutGrid, ListTodo, BookOpenCheck, LogOut } from 'lucide-react';
import type { Student } from '@/lib/types';

type StudentPage = 'series' | 'scripture';

interface StudentHomeProps {
  student: Student;
  onNavigate: (page: StudentPage) => void;
  onLogout: () => void;
}

export function StudentHome({ student, onNavigate, onLogout }: StudentHomeProps) {
  const cards = [
    {
      id: 'series' as StudentPage,
      title: '学房系列功课',
      description: '查看并提交学房系列功课',
      icon: ListTodo,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      id: 'scripture' as StudentPage,
      title: '读经或背经功课',
      description: '提交读经或背经记录',
      icon: BookOpenCheck,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-6">
      <button onClick={onLogout} className="absolute top-6 right-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
        <LogOut className="w-4 h-4" />
        登出
      </button>
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20 mb-4">
          <LayoutGrid className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">你好, {student.student_name} !</h1>
        <p className="text-slate-500 mt-1.5">请选择要完成的学房功课</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="group bg-white rounded-2xl border-2 border-slate-100 hover:border-sky-300 p-8 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${card.bg} mb-4 transition-transform group-hover:scale-110`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">{card.title}</h2>
              {/* <p className="text-sm text-slate-500 leading-relaxed">{card.description}</p> */}
            </button>
          );
        })}
      </div>

    </div>
  );
}
