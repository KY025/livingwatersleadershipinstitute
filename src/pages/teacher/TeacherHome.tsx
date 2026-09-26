import { useEffect, useState } from 'react';
import { Layers, BookOpenText, ClipboardList, Users, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SERIES_SEMS } from '@/lib/constants';
import { useToast } from '@/components/Toast';

type TeacherPage = 'series' | 'students' | 'records';

interface TeacherHomeProps {
  onNavigate: (page: TeacherPage) => void;
  onBack: () => void;
  onLogout: () => void;
}

const cards = [
  {
    id: 'students' as TeacherPage,
    title: '学房生管理',
    description: '查看学房生资料并分配所属学房系列',
    icon: Users,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'hover:border-sky-300',
  },
  {
    id: 'series' as TeacherPage,
    title: '学房课程内容管理',
    description: '管理学房课程内容',
    icon: BookOpenText,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'hover:border-teal-300',
  },
  {
    id: 'records' as TeacherPage,
    title: '学房生功课记录管理',
    description: '查看学房生学房功课记录',
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'hover:border-amber-300',
  },
];

export function TeacherHome({ onNavigate, onLogout }: TeacherHomeProps) {
  const { show } = useToast();
  const [currentSem, setCurrentSem] = useState<number>(SERIES_SEMS[0]);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from('app_settings')
        .select('current_sem, current_year')
        .eq('id', 'default')
        .single();

      if (data) {
        if (data.current_sem) setCurrentSem(data.current_sem);
        if (data.current_year) setCurrentYear(data.current_year);
      }
    }
    void fetchSettings();
  }, []);

  async function handleSemChange(value: number) {
    const previousSem = currentSem;
    setCurrentSem(value);
    const { error } = await supabase
      .from('app_settings')
      .update({ current_sem: value, updated_at: new Date().toISOString() })
      .eq('id', 'default');

    if (error) {
      setCurrentSem(previousSem);
      show('无法更新当前学期', 'error');
    } else {
      show(`当前学期已切换为第 ${value} 学期`);
    }
  }

  async function handleYearChange(value: number) {
    if (!value) return;
    const previousYear = currentYear;
    setCurrentYear(value);
    const { error } = await supabase
      .from('app_settings')
      .update({ current_year: value, updated_at: new Date().toISOString() })
      .eq('id', 'default');

    if (error) {
      setCurrentYear(previousYear);
      show('无法更新当前年份', 'error');
    } else {
      show(`当前年份已切换为 ${value} 年`);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <button onClick={onLogout} className="absolute top-6 right-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
        <LogOut className="w-4 h-4" />
        登出
      </button>
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 mb-4">
          <Layers className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-wide">学房生导师管理页面</h1>
        <p className="text-slate-500 mt-1.5">请选择一项管理内容</p>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-center gap-6 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* 当前年份：改用带有上下箭头的 number 数字输入框 */}
        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <span>当前年份</span>
          <input
            type="number"
            value={currentYear}
            onChange={(e) => { void handleYearChange(Number(e.target.value)); }}
            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none"
          />
        </label>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <span>当前学期</span>
          <select
            value={currentSem}
            onChange={(e) => { void handleSemChange(Number(e.target.value)); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none"
          >
            {SERIES_SEMS.map((sem) => (
              <option key={sem} value={sem}>第 {sem} 学期</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className={`group bg-white rounded-2xl border-2 border-slate-100 ${card.border} p-8 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${card.bg} mb-4 transition-transform group-hover:scale-110`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">{card.title}</h2>
            </button>
          );
        })}
      </div>
    </div>
  );
}
