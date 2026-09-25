import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PAGE_SIZE, SERIES_SEMS } from '@/lib/constants';
import type { Student, Series, SeriesTaskRecord } from '@/lib/types';
import { deleteHomework, uploadHomework } from '@/lib/drive';
import { useToast } from '@/components/Toast';
import { LoadingSpinner, EmptyState } from '@/components/LoadingStates';
import { Pagination } from '@/components/Pagination';
import { ArrowLeft, ListTodo, CheckCircle2, Circle, Undo2, Clock, CheckCheck, LogOut, Eye, Upload, X } from 'lucide-react';

interface SeriesTaskProps {
  student: Student;
  onBack: () => void;
  onLogout: () => void;
}

export function SeriesTask({ student, onBack, onLogout }: SeriesTaskProps) {
  const { show } = useToast();
  const [series, setSeries] = useState<Series[]>([]);
  const [records, setRecords] = useState<Record<string, SeriesTaskRecord>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('current_sem')
      .eq('id', 'default')
      .single();

    const semester = settingsData?.current_sem || SERIES_SEMS[0];

    // Fetch series matching the student's series_types
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .select('*')
      .in('series_type', student.series_types || [])
      .eq('series_sem', semester)
      .order('series_type', { ascending: true })
      .order('series_sem', { ascending: true })
      .order('series_name', { ascending: true });

    if (seriesError) {
      show('无法加载学房系列', 'error');
      setLoading(false);
      return;
    }

    // Fetch existing records for this student
    const { data: recordData, error: recordError } = await supabase
      .from('series_task_records')
      .select('*')
      .eq('student_id', student.id);

    if (recordError) {
      show('无法加载学房系列功课记录', 'error');
    } else {
      const map: Record<string, SeriesTaskRecord> = {};
      (recordData || []).forEach((r) => {
        map[r.series_id] = r as SeriesTaskRecord;
      });
      setRecords(map);
    }

    const sortedSeries = [...(seriesData || [])].sort((first, second) => {
      const typeComparison = first.series_type.localeCompare(second.series_type);
      if (typeComparison !== 0) return typeComparison;
      const semesterComparison = first.series_sem - second.series_sem;
      if (semesterComparison !== 0) return semesterComparison;
      return first.series_name.localeCompare(second.series_name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
    setSeries(sortedSeries);
    setPage(1);
    setLoading(false);
  }

  async function handleFilesSelected(s: Series, files: File[]) {
    setBusy(s.id);
    const existing = records[s.id];

    if (existing?.teacher_confirmed) {
      setBusy(null);
      return;
    }

    try {
      if (!student.email) throw new Error('学房生账号没有绑定，无法保存到网盘');

      await uploadHomework(
      files,
      student.id,
      student.student_name,
      student.email,
      s.id
    );

      show('学房系列功课已提交');
      await fetchData();
    } catch (error) {
      show(error instanceof Error ? error.message : '文件提交失败', 'error');
    }
    setBusy(null);
  }

  function handleSubmit(s: Series) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length) void handleFilesSelected(s, files);
    };
    input.multiple = true;
    input.click();
  }

  async function handleRemoveFile(s: Series, fileId: string) {
    setBusy(s.id);
    const existing = records[s.id];
    if (!existing) {
      setBusy(null);
      return;
    }
    if (existing.teacher_confirmed) {
      show('导师已确认，文件不能删除', 'info');
      setBusy(null);
      return;
    }
    try {
      // 传入 studentId 和 seriesId，让后端统一删除 Drive 文件并更新 Supabase 记录
      await deleteHomework(fileId, student.id, s.id);

      show('文件已删除');
      await fetchData();
    } catch (error) {
      show(error instanceof Error ? error.message : '无法删除此文件', 'error');
    }
    setBusy(null);
  }

  function getStatus(record?: SeriesTaskRecord): { label: string; color: string; icon: typeof Clock } {
    if (!record) return { label: '尚未开始', color: 'text-slate-400', icon: Circle };
    if (record.teacher_confirmed) return { label: '已确认', color: 'text-emerald-600', icon: CheckCheck };
    if (record.student_done) return { label: '待确认', color: 'text-amber-600', icon: Clock };
    if (record.remarks) return { label: '需要重新提交', color: 'text-red-600', icon: Undo2 };
    return { label: '尚未开始', color: 'text-slate-400', icon: Circle };
  }

  const totalPages = Math.ceil(series.length / PAGE_SIZE);
  const pagedSeries = series.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
              <ListTodo className="w-5 h-5 text-teal-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">学房系列功课</h1>
          </div>
          <button onClick={onLogout} className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
            登出
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : series.length === 0 ? (
            <EmptyState message="暂无符合你所属学房系列" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">系列名称</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">课程内容</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 tracking-wider">完成</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">状态</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedSeries.map((s) => {
                    const record = records[s.id];
                    const status = getStatus(record);
                    const StatusIcon = status.icon;
                    const isConfirmed = record?.teacher_confirmed;
                    const isDone = record?.student_done;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-slate-800">{s.series_name}</span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-600">
                                {s.series_type}
                              </span>
                              学期 {s.series_sem}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">{s.series_task}</td>
                        <td className="px-6 py-4 text-center">
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 inline" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 inline" />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${status.color}`}>
                              <StatusIcon className="w-4 h-4" />
                              {status.label}
                            </span>
                            {record?.remarks && (
                              <span className="max-w-xs text-xs text-red-600" title={record.remarks}>
                                导师备注：{record.remarks}
                              </span>
                            )}
                            {(record?.drive_files || []).map((file) => (
                              <span key={file.fileId} className="inline-flex max-w-xs items-center gap-1 text-xs">
                                <a href={file.webViewLink} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-teal-600 hover:text-teal-700">
                                  <Eye className="h-3.5 w-3.5 shrink-0" />{file.fileName}
                                </a>
                                {!isConfirmed && <button type="button" onClick={() => void handleRemoveFile(s, file.fileId)} disabled={busy === s.id} title="删除文件" className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {isConfirmed ? (
                              <span className="text-xs text-slate-400 italic">已锁定</span>
                            ) : null}
                            {!isConfirmed && (
                              <button
                                onClick={() => handleSubmit(s)}
                                disabled={busy === s.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                上传文件
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

        {series.length > 0 && (
          <p className="text-xs text-slate-400 mt-4 text-center">
            学房系列功课经导师确认后将会锁定，无法再修改。
          </p>
        )}
      </main>
    </div>
  );
}
