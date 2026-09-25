import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import type { SeriesTaskRecordWithJoins, ScriptureRecordWithJoins } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { Pagination } from '@/components/Pagination';
import { SearchFilter } from '@/components/SearchFilter';
import { Modal } from '@/components/Modal';
import { TextArea } from '@/components/FormInputs';
import { LoadingSpinner, EmptyState } from '@/components/LoadingStates';
import { ArrowLeft, ClipboardList, BookOpenCheck, FileDown, CheckCircle2, Circle, LogOut, Eye } from 'lucide-react';

interface RecordsManagerProps {
  onBack: () => void;
  onLogout?: () => void;
  readOnly?: boolean;
  principalMode?: boolean;
}

type Tab = 'series' | 'scripture';

function scriptureModeLabel(mode: string) {
  return mode === 'reading' ? '读经' : mode === 'memorization' ? '背经' : mode;
}

export function RecordsManager({ onBack, onLogout, readOnly = false, principalMode = false }: RecordsManagerProps) {
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>('series');
  const [studentQuery, setStudentQuery] = useState('');
  const [seriesRecords, setSeriesRecords] = useState<SeriesTaskRecordWithJoins[]>([]);
  const [scriptureRecords, setScriptureRecords] = useState<ScriptureRecordWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmingRecord, setConfirmingRecord] = useState<SeriesTaskRecordWithJoins | null>(null);
  const [remarks, setRemarks] = useState('');
  const [savingConfirm, setSavingConfirm] = useState(false);

  useEffect(() => {
    if (tab === 'series') {
      fetchSeriesRecords();
    } else {
      fetchScriptureRecords();
    }
  }, [tab]);

  async function fetchSeriesRecords() {
    setLoading(true);
    const query = supabase
      .from('series_task_records')
      .select('*, students!inner(student_name, status), series(series_type, series_name, series_task)')
      .eq('students.status', 'active')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      show('无法加载学房系列记录', 'error');
    } else {
      setSeriesRecords((data as SeriesTaskRecordWithJoins[]) || []);
    }
    setLoading(false);
  }

  async function fetchScriptureRecords() {
    setLoading(true);
    const query = supabase
      .from('scripture_records')
      .select('*, students!inner(student_name, status)')
      .eq('students.status', 'active')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      show('无法加载学房生读经或背经记录', 'error');
    } else {
      setScriptureRecords((data as ScriptureRecordWithJoins[]) || []);
    }
    setLoading(false);
  }

  const normalizedStudentQuery = studentQuery.trim().toLowerCase();
  const filteredSeriesRecords = seriesRecords.filter((record) =>
    !normalizedStudentQuery ||
    record.students?.student_name.toLowerCase().includes(normalizedStudentQuery)
  );
  const filteredScriptureRecords = scriptureRecords.filter((record) =>
    !normalizedStudentQuery ||
    record.students?.student_name.toLowerCase().includes(normalizedStudentQuery)
  );
  const totalPages = Math.ceil(
    (tab === 'series' ? filteredSeriesRecords.length : filteredScriptureRecords.length) / PAGE_SIZE
  );
  const pageStart = (page - 1) * PAGE_SIZE;
  const pagedSeries = filteredSeriesRecords.slice(pageStart, pageStart + PAGE_SIZE);
  const pagedScripture = filteredScriptureRecords.slice(pageStart, pageStart + PAGE_SIZE);
  const paged = tab === 'series' ? pagedSeries : pagedScripture;

  async function handleConfirm() {
    if (!confirmingRecord) return;
    setSavingConfirm(true);
    const { error } = await supabase
      .from('series_task_records')
      .update({
        teacher_confirmed: true,
        remarks: remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', confirmingRecord.id);

    if (error) {
      show('无法更新学房生功课记录', 'error');
    } else {
      show('记录已确认并锁定');
      setConfirmingRecord(null);
      setRemarks('');
      fetchSeriesRecords();
    }
    setSavingConfirm(false);
  }

  async function handleReject() {
    if (!confirmingRecord || !remarks.trim()) {
      show('请填写需要重新提交的原因', 'error');
      return;
    }
    setSavingConfirm(true);
    const { error } = await supabase
      .from('series_task_records')
      .update({
        student_done: false,
        teacher_confirmed: false,
        remarks: remarks.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', confirmingRecord.id);

    if (error) {
      show('无法拒绝学房生功课记录', 'error');
    } else {
      show('功课记录已拒绝，学房生需要重新提交');
      setConfirmingRecord(null);
      setRemarks('');
      fetchSeriesRecords();
    }
    setSavingConfirm(false);
  }

  async function handlePDF() {
      const studentName = studentQuery.trim() || '所有学房生';
      
      const columnWidths = tab === 'series'
        ? ['12%', '14%', '20%', '24%', '8%', '10%', '12%']
        : ['14%', '12%', '60%', '14%'];

      const headers = tab === 'series'
        ? ['学房生姓名', '学房系列', '系列名称', '功课', '完成', '确认状态', '备注']
            .map((h, i) => `<th style="width:${columnWidths[i]}">${h}</th>`).join('')
        : ['学房生姓名', '类型', '经文内容', '日期']
            .map((h, i) => `<th style="width:${columnWidths[i]}">${h}</th>`).join('');

      const wrapCell = (text: string | null | undefined) => `<div style="display:flex; align-items:center; justify-content:center; min-height:40px; width:100%; word-break:break-word;">${text || ''}</div>`;

      const rows = tab === 'series'
        ? filteredSeriesRecords.map((r) => `
            <tr>
              <td>${wrapCell(r.students?.student_name)}</td>
              <td>${wrapCell(r.series?.series_type)}</td>
              <td>${wrapCell(r.series?.series_name)}</td>
              <td>${wrapCell(r.series?.series_task)}</td>
              <td>${wrapCell(r.student_done ? '是' : '否')}</td>
              <td>${wrapCell(r.teacher_confirmed ? '已确认' : '待确认')}</td>
              <td>${wrapCell(r.remarks)}</td>
            </tr>`)
        : filteredScriptureRecords.map((r) => `
            <tr>
              <td>${wrapCell(r.students?.student_name)}</td>
              <td>${wrapCell(scriptureModeLabel(r.scripture_mode))}</td>
              <td>${wrapCell(r.scripture_part)}</td>
              <td>${wrapCell(new Date(r.created_at).toLocaleDateString())}</td>
            </tr>`);

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-10000px;top:0;width:1100px;padding:34px;background:#fff;color:#1e293b;font-family:Arial,sans-serif;font-size:20px;line-height:1;'; // 将整体行高设为1，消除默认字体的底部空白
      container.innerHTML = `<h1 style="font-size:30px;margin:0 0 14px;font-weight:700;text-align:center">${tab === 'series' ? '学房生学房系列功课记录表' : '学房生读经或背经记录表'}</h1>
        <p style="font-size:20px;margin:0 0 24px;font-weight:700;text-align:center">姓名：${studentName}</p>
        <table style="width:100%;border-collapse:collapse;font-size:20px;table-layout:fixed">
        <thead><tr style="background:#fef3c7">${headers}</tr></thead><tbody>${rows.join('')}</tbody>
        </table>`;
        
      container.querySelectorAll('th,td').forEach((cell) => {
        (cell as HTMLElement).style.cssText += 'padding:8px 8px;border:1px solid #e2e8f0;text-align:center;vertical-align:middle;';
      
        if (cell.tagName === 'TH') {
          cell.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; min-height:40px; width:100%; font-weight:700;">${cell.innerHTML}</div>`;
        }
      });
      
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(container);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 8;
      const contentWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const contentHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const imageHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = margin;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, imageHeight);
      heightLeft -= contentHeight;
      while (heightLeft > 0) {
        position = margin + heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, imageHeight);
        heightLeft -= contentHeight;
      }
      pdf.save(`${studentName}_${tab === 'series' ? '学房系列功课记录' : '读经或背经记录'}.pdf`);
  }


  function openConfirm(record: SeriesTaskRecordWithJoins) {
    setConfirmingRecord(record);
    setRemarks(record.remarks || '');
  }

  function handleStudentFilter(value: string) {
    setStudentQuery(value);
    setPage(1);
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
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">
              {principalMode ? '学房生功课记录' : '学房生功课记录管理'}
            </h1>
          </div>
          {onLogout && (
            <button onClick={onLogout} className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
              <LogOut className="w-4 h-4" />
              登出
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setTab('series'); setPage(1); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'series'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            学房功课记录
          </button>
          <button
            onClick={() => { setTab('scripture'); setPage(1); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'scripture'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BookOpenCheck className="w-4 h-4" />
            读经或背经记录
          </button>
        </div>

        {/* Table controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-end gap-3 mb-4">
          <SearchFilter value={studentQuery} onChange={handleStudentFilter} placeholder="搜索学房生" />
          <div className="flex items-center gap-2">
            <button
              onClick={handlePDF}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              下载 PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : paged.length === 0 ? (
            <EmptyState message="暂无学房生功课记录" />
          ) : tab === 'series' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">学房生姓名</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">学房系列</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">系列名称</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">课程内容</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 tracking-wider">完成</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 tracking-wider">文件</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 tracking-wider">确认状态</th>
                    {!readOnly && <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedSeries.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.students?.student_name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          {r.series?.series_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{r.series?.series_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{r.series?.series_task}</td>
                      <td className="px-6 py-4 text-center">
                        {r.student_done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 inline" /> : <Circle className="w-5 h-5 text-slate-300 inline" />}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.drive_files?.length ? (
                          <div className="flex flex-col items-center gap-1">
                            {r.drive_files.map((file) => <a key={file.fileId} href={file.webViewLink} target="_blank" rel="noreferrer" title={file.fileName} className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"><Eye className="h-4 w-4" />查看</a>)}
                          </div>
                        ) : r.drive_file_url ? <a href={r.drive_file_url} target="_blank" rel="noreferrer" title={r.drive_file_name || '查看提交文件'} className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"><Eye className="h-4 w-4" />查看</a> : <span className="text-xs text-slate-400">无文件</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.teacher_confirmed ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">已确认</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">待确认</span>
                        )}
                      </td>
                      {!readOnly && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openConfirm(r)}
                            disabled={!r.student_done || r.teacher_confirmed}
                            title={!r.student_done ? '等待学房生重新提交' : undefined}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              'text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            确认
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">学房生姓名</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">经文内容</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedScripture.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.students?.student_name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {scriptureModeLabel(r.scripture_mode)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{r.scripture_part}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      {/* Confirm modal */}
      <Modal
        open={!!confirmingRecord}
        onClose={() => { setConfirmingRecord(null); setRemarks(''); }}
        title="确认记录"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <p><span className="font-medium text-slate-700">学房生：</span>{confirmingRecord?.students?.student_name}</p>
            <p><span className="font-medium text-slate-700">学房系列：</span>{confirmingRecord?.series?.series_type}</p>
            <p><span className="font-medium text-slate-700">系列名称：</span>{confirmingRecord?.series?.series_name}</p>
            <p><span className="font-medium text-slate-700">课程内容：</span>{confirmingRecord?.series?.series_task}</p>
          </div>
          <TextArea
            label="备注"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="请输入备注"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setConfirmingRecord(null); setRemarks(''); }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={savingConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {savingConfirm ? '保存中...' : '确认并锁定'}
            </button>
            {!confirmingRecord?.teacher_confirmed && confirmingRecord?.student_done && (
              <button
                onClick={handleReject}
                disabled={savingConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {savingConfirm ? '保存中...' : '拒绝并要求重新提交'}
              </button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}
