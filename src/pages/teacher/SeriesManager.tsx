import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Series } from '@/lib/types';
import { SERIES_TYPES, SERIES_SEMS, PAGE_SIZE } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { SearchFilter } from '@/components/SearchFilter';
import { TextInput, SelectInput, TextArea } from '@/components/FormInputs';
import { LoadingSpinner, EmptyState } from '@/components/LoadingStates';
import { ArrowLeft, Plus, Pencil, Trash2, LogOut, BookOpenText } from 'lucide-react';

function compareSeriesNames(firstName: string, secondName: string) {
  return firstName.localeCompare(secondName, undefined, { numeric: true, sensitivity: 'base' });
}

interface SeriesManagerProps {
  onBack: () => void;
  onLogout: () => void;
}

export function SeriesManager({ onBack, onLogout }: SeriesManagerProps) {
  const { show } = useToast();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Series | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState<{
    series_type: string;
    series_year: number;
    series_sem: number;
    series_name: string;
    series_task: string;
  }>({
    series_type: SERIES_TYPES[0],
    series_year: currentYear, 
    series_sem: SERIES_SEMS[0],
    series_name: '',
    series_task: '',
  });

  async function fetchSeries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('series')
      .select('*')
      .order('series_type', { ascending: true })
      .order('series_year', { ascending: true })
      .order('series_sem', { ascending: true })
      .order('series_name', { ascending: true });

    if (error) {
      show('无法加载学房系列', 'error');
    } else {
      setSeries(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchSeries();
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...series].sort((a, b) => {
      const typeCmp = a.series_type.localeCompare(b.series_type);
      if (typeCmp !== 0) return typeCmp;
      const yearCmp = (a.series_year || 0) - (b.series_year || 0);
      if (yearCmp !== 0) return yearCmp;
      const semCmp = a.series_sem - b.series_sem;
      if (semCmp !== 0) return semCmp;
      return compareSeriesNames(a.series_name, b.series_name);
    });
    if (!filter.trim()) return sorted;
    return sorted.filter((s) =>
      s.series_type.toLowerCase().includes(filter.trim().toLowerCase()) ||
      s.series_year?.toString().includes(filter.trim())
    );
  }, [series, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm({
      series_type: SERIES_TYPES[0],
      series_year: new Date().getFullYear(), 
      series_sem: SERIES_SEMS[0],
      series_name: '',
      series_task: '',
    });
    setModalOpen(true);
  }

  function openEdit(s: Series) {
    setEditing(s);
    setForm({
      series_type: s.series_type,
      series_year: s.series_year || new Date().getFullYear(),
      series_sem: s.series_sem,
      series_name: s.series_name,
      series_task: s.series_task,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.series_name.trim() || !form.series_task.trim() || !form.series_year) {
      show('请填写所有资料', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      series_type: form.series_type,
      series_year: Number(form.series_year),
      series_sem: form.series_sem,
      series_name: form.series_name,
      series_task: form.series_task.trim(),
    };

    if (editing) {
      const { error } = await supabase
        .from('series')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        show('无法更新学房系列', 'error');
      } else {
        show('学房系列已更新');
        setModalOpen(false);
        fetchSeries();
      }
    } else {
      const { error } = await supabase.from('series').insert(payload);
      if (error) {
        show('无法添加学房系列', 'error');
      } else {
        show('学房系列已添加');
        setModalOpen(false);
        fetchSeries();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('series').delete().eq('id', deleteTarget.id);
    if (error) {
      show('无法删除学房系列', 'error');
    } else {
      show('学房系列已删除');
      fetchSeries();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <BookOpenText className="w-5 h-5 text-teal-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">学房课程内容管理</h1>
          </div>
          <button onClick={onLogout} className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
            登出
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            添加学房系列
          </button>
          <SearchFilter value={filter} onChange={(v) => { setFilter(v); setPage(1); }} placeholder="搜索学房系列" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : paged.length === 0 ? (
            <EmptyState message={filter ? "无匹配的学房系列" : "暂无学房系列"} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">学房系列</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">年份</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">学期</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">系列课程</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">课程内容</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                          {s.series_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.series_year || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">第 {s.series_sem} 学期</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{s.series_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{s.series_task}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '更新学房系列' : '添加学房系列'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <SelectInput
              label="学房系列"
              value={form.series_type}
              onChange={(e) => setForm({ ...form, series_type: e.target.value })}
            >
              {SERIES_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </SelectInput>

            <TextInput
              label="年份"
              type="number"
              value={form.series_year}
              onChange={(e) => setForm({ ...form, series_year: Number(e.target.value) })}
            />

            <SelectInput
              label="学期"
              value={form.series_sem}
              onChange={(e) => setForm({ ...form, series_sem: Number(e.target.value) })}
            >
              {SERIES_SEMS.map((s) => (
                <option key={s} value={s}>第 {s} 学期</option>
              ))}
            </SelectInput>
          </div>

          <TextInput
            label="系列课程"
            value={form.series_name}
            onChange={(e) => setForm({ ...form, series_name: e.target.value })}
            placeholder="例如：真理 1"
          />

          <TextArea
            label="课程内容"
            value={form.series_task}
            onChange={(e) => setForm({ ...form, series_task: e.target.value })}
            placeholder="例如：系统神学（一）1：救恩论"
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : editing ? '更新' : '添加'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除学房系列课程"
        message={
          <>
            确定删除学房系列课程 "{deleteTarget?.series_name}" 吗?
            <br />
            <strong>此操作将同时删除所有学房生 "{deleteTarget?.series_name}" 系列课程记录!</strong>
          </>
        }
        confirmLabel="删除"
        danger
      />
    </div>
  );
}
