import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { SERIES_TYPES, PAGE_SIZE } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { SearchFilter } from '@/components/SearchFilter';
import { LoadingSpinner, EmptyState } from '@/components/LoadingStates';
import {
  ArrowLeft,
  Check,
  History,
  LogOut,
  RotateCcw,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface StudentManagerProps {
  onBack: () => void;
  onLogout: () => void;
}

export function StudentManager({ onBack, onLogout }: StudentManagerProps) {
  const { show } = useToast();

  // Active students
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Student History
  const [showHistory, setShowHistory] = useState(false);
  const [historyStudents, setHistoryStudents] = useState<Student[]>([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Confirmation dialogs
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Student | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Student | null>(null);

  // Fetch active students
  async function fetchStudents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('status', 'active')
      .order('student_name');

    if (error) {
      show('无法加载学房生资料', 'error');
    } else {
      setStudents((data || []) as Student[]);
    }
    setLoading(false);
  }

  // Fetch inactive students
  async function fetchHistoryStudents() {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('status', 'inactive')
      .order('student_name');

    if (error) {
      show('无法加载历史学房生', 'error');
    } else {
      setHistoryStudents((data || []) as Student[]);
    }
    setHistoryLoading(false);
  }

  useEffect(() => {
    void fetchStudents();
  }, []);

  // Active student filtering
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return students.filter(
      (student) => !query || student.student_name.toLowerCase().includes(query)
    );
  }, [students, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // History filtering
  const filteredHistory = useMemo(() => {
    const query = historyFilter.trim().toLowerCase();
    return historyStudents.filter(
      (student) => !query || student.student_name.toLowerCase().includes(query)
    );
  }, [historyStudents, historyFilter]);

  const historyTotalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);
  const pagedHistory = filteredHistory.slice(
    (historyPage - 1) * PAGE_SIZE,
    historyPage * PAGE_SIZE
  );

  // Open Student History
  function openHistory() {
    setShowHistory(true);
    setHistoryFilter('');
    setHistoryPage(1);
    void fetchHistoryStudents();
  }

  // Toggle series
  async function toggleSeries(student: Student, seriesType: string) {
    const seriesTypes = student.series_types || [];
    const next = seriesTypes.includes(seriesType)
      ? seriesTypes.filter((type) => type !== seriesType)
      : [...seriesTypes, seriesType];

    setSavingId(student.id);

    const { error } = await supabase
      .from('students')
      .update({ series_types: next })
      .eq('id', student.id);

    if (error) {
      show('无法更新所属学房系列', 'error');
    } else {
      setStudents((current) =>
        current.map((item) =>
          item.id === student.id ? { ...item, series_types: next } : item
        )
      );
    }
    setSavingId(null);
  }

  // Normal Delete / Deactivate
  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ status: 'inactive' })
        .eq('id', deleteTarget.id);

      if (error) throw new Error(error.message);

      show('学房生已移至 ‘历史学房生’');
      await fetchStudents();
      await fetchHistoryStudents();
    } catch (error) {
      show(
        error instanceof Error ? error.message : '无法停用学房生',
        'error'
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  // Restore
  async function handleRestore() {
    if (!restoreTarget) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ status: 'active' })
        .eq('id', restoreTarget.id);

      if (error) throw new Error(error.message);

      show('学房生已恢复');
      await fetchStudents();
      await fetchHistoryStudents();
    } catch (error) {
      show(
        error instanceof Error ? error.message : '无法恢复学房生',
        'error'
      );
    } finally {
      setRestoreTarget(null);
    }
  }

  // Permanent Delete
  async function handlePermanentDelete() {
    if (!permanentDeleteTarget) return;

    try {
      const response = await fetch('/api/student-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: permanentDeleteTarget.id,
          authUserId: permanentDeleteTarget.auth_user_id,
          permanent: true,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((result as { error?: string }).error || '无法永久删除学房生');
      }

      show('学房生账号及相关记录已永久删除');
      await fetchStudents();
      await fetchHistoryStudents();
    } catch (error) {
      show(
        error instanceof Error ? error.message : '无法永久删除学房生',
        'error'
      );
    } finally {
      setPermanentDeleteTarget(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <button onClick={onBack} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
              <Users className="h-5 w-5 text-sky-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">学房生管理</h1>
          </div>

          <button
            onClick={onLogout}
            className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Top controls */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <button
            onClick={openHistory}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
            历史学房生
          </button>

          <SearchFilter
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
            placeholder="搜索学房生"
          />
        </div>

        {/* Active students table */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : paged.length === 0 ? (
            <EmptyState message="暂无学房生" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">学房生姓名</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">邮箱地址</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">所属学房系列</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {student.student_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {student.email || '未绑定'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-lg flex-wrap gap-2">
                          {SERIES_TYPES.map((type) => {
                            const selected = (student.series_types || []).includes(type);
                            return (
                              <button
                                key={type}
                                disabled={savingId === student.id}
                                onClick={() => void toggleSeries(student, type)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${
                                  selected
                                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                                    : 'border-slate-200 text-slate-500 hover:border-sky-300'
                                }`}
                              >
                                {selected && <Check className="h-3 w-3" />}
                                {type}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDeleteTarget(student)}
                          title="停用学房生"
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </main>

      {/* Student History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">历史学房生</h2>
                <p className="mt-1 text-xs text-slate-500">已停用的学房生资料</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex justify-end">
                <SearchFilter
                  value={historyFilter}
                  onChange={(value) => {
                    setHistoryFilter(value);
                    setHistoryPage(1);
                  }}
                  placeholder="搜索历史学房生"
                />
              </div>
            </div>

            {/* History table */}
            <div className="flex-1 overflow-auto">
              {historyLoading ? (
                <LoadingSpinner />
              ) : pagedHistory.length === 0 ? (
                <EmptyState message="暂无历史学房生" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">学房生姓名</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">邮箱地址</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">所属学房系列</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedHistory.map((student) => (
                        <tr key={student.id}>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">
                            {student.student_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {student.email || '未绑定'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex max-w-lg flex-wrap gap-2">
                              {(student.series_types || []).map((type) => (
                                <span
                                  key={type}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                                >
                                  {type}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setRestoreTarget(student)}
                                title="恢复学房生"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                恢复
                              </button>

                              <button
                                onClick={() => setPermanentDeleteTarget(student)}
                                title="永久删除"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                永久删除
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

            {/* History pagination */}
            <div className="border-t border-slate-100 px-6 py-3">
              <Pagination
                page={historyPage}
                totalPages={historyTotalPages}
                onPageChange={setHistoryPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* Normal Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="停用学房生"
        message={`确定要停用“${deleteTarget?.student_name}”吗？`}
        confirmLabel="停用"
        danger
      />

      {/* Restore Confirmation */}
      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => void handleRestore()}
        title="恢复学房生"
        message={`确定要恢复“${restoreTarget?.student_name}”吗？`}
        confirmLabel="恢复"
      />

      {/* Permanent Delete Confirmation */}
      <ConfirmDialog
        open={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={() => void handlePermanentDelete()}
        title="永久删除学房生"
        message={`确定要永久删除“${permanentDeleteTarget?.student_name}”吗？此操作会删除该学房生的资料及登录账号，无法恢复。`}
        confirmLabel="永久删除"
        danger
      />
    </div>
  );
}