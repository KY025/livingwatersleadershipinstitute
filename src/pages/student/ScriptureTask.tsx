import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Student, ScriptureRecord } from '@/lib/types';
import { SCRIPTURE_MODES, PAGE_SIZE } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { TextInput, SelectInput } from '@/components/FormInputs';
import { LoadingSpinner, EmptyState } from '@/components/LoadingStates';
import { ArrowLeft, BookOpenCheck, Plus, Pencil, Trash2, LogOut } from 'lucide-react';

interface ScriptureTaskProps {
  student: Student;
  onBack: () => void;
  onLogout: () => void;
}

export function ScriptureTask({ student, onBack, onLogout }: ScriptureTaskProps) {
  const { show } = useToast();
  const [records, setRecords] = useState<ScriptureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScriptureRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScriptureRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    scripture_mode: '读经' as string,
    scripture_part: '',
  });

  async function fetchRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('scripture_records')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (error) {
      show('无法加载读经记录', 'error');
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  const sorted = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [records]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm({ scripture_mode: '读经', scripture_part: '' });
    setModalOpen(true);
  }

  function openEdit(r: ScriptureRecord) {
    setEditing(r);
    setForm({
      scripture_mode: r.scripture_mode === 'reading' ? '读经' : r.scripture_mode === 'memorization' ? '背经' : r.scripture_mode,
      scripture_part: r.scripture_part,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.scripture_part.trim()) {
      show('请输入经文内容', 'error');
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('scripture_records')
        .update({
          scripture_mode: form.scripture_mode,
          scripture_part: form.scripture_part,
        })
        .eq('id', editing.id);
      if (error) {
        show('无法更新记录', 'error');
      } else {
        show('记录已更新');
        setModalOpen(false);
        fetchRecords();
      }
    } else {
      const { error } = await supabase.from('scripture_records').insert({
        student_id: student.id,
        scripture_mode: form.scripture_mode,
        scripture_part: form.scripture_part,
      });
      if (error) {
        show('无法添加记录', 'error');
      } else {
        show('记录已添加');
        setModalOpen(false);
        fetchRecords();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('scripture_records')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      show('无法删除记录', 'error');
    } else {
      show('记录已删除');
      fetchRecords();
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
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
              <BookOpenCheck className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">读经或背经功课</h1>
          </div>
          <button onClick={onLogout} className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
            登出
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            添加读经 / 背经记录
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : paged.length === 0 ? (
            <EmptyState message="暂无读经或背经记录" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">经文内容</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">日期</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          'bg-sky-100 text-sky-800'
                        }`}>
                          {r.scripture_mode === 'reading' ? '读经' : r.scripture_mode === 'memorization' ? '背经' : r.scripture_mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.scripture_part}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '更新读经或背经记录' : '添加读经或背经记录'}>
        <div className="space-y-4">
          <SelectInput
            label="记录类型"
            value={form.scripture_mode}
            onChange={(e) => setForm({ ...form, scripture_mode: e.target.value })}
          >
            {SCRIPTURE_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label="经文内容"
            value={form.scripture_part}
            onChange={(e) => setForm({ ...form, scripture_part: e.target.value })}
            placeholder="例如：约翰福音 3:16-20"
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
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition-colors"
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
        title="删除读经或背经记录"
        message={`确定要删除此读经或背经记录吗？`}
        confirmLabel="删除"
        danger
      />
    </div>
  );
}
