import { useState } from 'react';
import { FileText, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { downloadCsv } from '../../utils/csvExport';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useRanges } from '../../hooks/useRanges';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import type { DailyReport } from '../../types';

function ReportCard({ report }: { report: DailyReport }) {
  const [expanded, setExpanded] = useState(false);
  const completion = report.totalTasks > 0 ? Math.round((report.completedCount / report.totalTasks) * 100) : 0;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-ptr-cream/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-ptr-green/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-ptr-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ptr-brown">
            Daily Report — {formatDate(report.reportDate)}
          </div>
          <div className="text-xs text-ptr-brown-light mt-0.5">
            {report.totalTasks} tasks · {completion}% completion · {report.overdueCount} overdue
          </div>
        </div>
        <span className="text-xs text-ptr-brown-light flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-ptr-cream-dark p-4 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: report.totalTasks, color: 'bg-ptr-brown/5 text-ptr-brown' },
              { label: 'Completed', value: report.completedCount, color: 'bg-ptr-green/10 text-ptr-green' },
              { label: 'In Progress', value: report.inProgressCount, color: 'bg-ptr-brown/5 text-ptr-brown' },
              { label: 'Overdue', value: report.overdueCount, color: 'bg-red-50 text-red-600' },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl p-3 ${m.color}`}>
                <div className="text-xl font-bold">{m.value}</div>
                <div className="text-xs font-medium opacity-80">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Range breakdown */}
          <div>
            <h3 className="text-xs font-semibold text-ptr-brown mb-2">Range Breakdown</h3>
            <div className="space-y-2">
              {report.rangeBreakdown.map((rb) => {
                const pct = rb.total > 0 ? Math.round((rb.completed / rb.total) * 100) : 0;
                return (
                  <div key={rb.rangeId} className="flex items-center gap-3">
                    <span className="text-xs text-ptr-brown w-28 flex-shrink-0 truncate">{rb.rangeName}</span>
                    <div className="flex-1 h-2 bg-ptr-brown/10 rounded-full overflow-hidden">
                      <div className="h-full bg-ptr-green rounded-full min-w-[3px]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-ptr-brown-light w-24 text-right flex-shrink-0">
                      {rb.completed}/{rb.total} · {rb.overdue} overdue
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DirectorReports() {
  const currentUser = useStore((s) => s.currentUser);
  const queryClient = useQueryClient();
  const { tasks } = useTasks();
  const { ranges } = useRanges();
  const [generated, setGenerated] = useState<DailyReport | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: async (): Promise<DailyReport[]> => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .order('report_date', { ascending: false });
      if (error) throw error;
      return data.map((r) => ({
        id: r.id,
        reportDate: r.report_date,
        generatedBy: r.generated_by,
        totalTasks: r.total_tasks,
        completedCount: r.completed_count,
        inProgressCount: r.in_progress_count,
        notStartedCount: r.not_started_count,
        overdueCount: r.overdue_count,
        rangeBreakdown: r.range_breakdown as DailyReport['rangeBreakdown'],
        createdAt: r.created_at,
      }));
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      const rangeBreakdown = ranges.map((range) => {
        const rt = tasks.filter((t) => t.rangeId === range.id);
        return {
          rangeId: range.id,
          rangeName: range.name,
          total: rt.length,
          completed: rt.filter((t) => t.status === 'Completed' || t.status === 'Archived').length,
          overdue: rt.filter(isOverdue).length,
        };
      });
      const report = {
        report_date: today,
        generated_by: currentUser.id,
        total_tasks: tasks.length,
        completed_count: tasks.filter((t) => t.status === 'Completed' || t.status === 'Archived').length,
        in_progress_count: tasks.filter((t) => t.status === 'InProgress').length,
        not_started_count: tasks.filter((t) => t.status === 'NotStarted').length,
        overdue_count: tasks.filter(isOverdue).length,
        range_breakdown: rangeBreakdown,
      };
      const { data, error } = await supabase.from('daily_reports').upsert(report, { onConflict: 'report_date' }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setGenerated({
        id: data.id,
        reportDate: data.report_date,
        generatedBy: data.generated_by,
        totalTasks: data.total_tasks,
        completedCount: data.completed_count,
        inProgressCount: data.in_progress_count,
        notStartedCount: data.not_started_count,
        overdueCount: data.overdue_count,
        rangeBreakdown: data.range_breakdown as DailyReport['rangeBreakdown'],
        createdAt: data.created_at,
      });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const handleExport = (report: DailyReport) => {
    const lines: string[] = [
      `PALAMU TIGER RESERVE — DAILY TASK REPORT`,
      `Date: ${formatDate(report.reportDate)}`,
      `Generated by: ${currentUser?.name ?? '—'}`,
      `Generated at: ${new Date(report.createdAt).toLocaleString()}`,
      '',
      'SUMMARY',
      `Total Tasks:    ${report.totalTasks}`,
      `Completed:      ${report.completedCount}`,
      `In Progress:    ${report.inProgressCount}`,
      `Not Started:    ${report.notStartedCount}`,
      `Overdue:        ${report.overdueCount}`,
      '',
      'RANGE BREAKDOWN',
      ...report.rangeBreakdown.map(
        (rb) => `  ${rb.rangeName}: ${rb.completed}/${rb.total} completed, ${rb.overdue} overdue`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PTR_Report_${report.reportDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = (report: DailyReport) => {
    downloadCsv(`PTR_Report_${report.reportDate}.csv`, [
      ['Palamu Tiger Reserve — Daily Task Report'],
      ['Date', formatDate(report.reportDate)],
      ['Generated by', currentUser?.name ?? '—'],
      ['Generated at', new Date(report.createdAt).toLocaleString()],
      [],
      ['Summary'],
      ['Total Tasks', report.totalTasks],
      ['Completed', report.completedCount],
      ['In Progress', report.inProgressCount],
      ['Not Started', report.notStartedCount],
      ['Overdue', report.overdueCount],
      [],
      ['Range', 'Total', 'Completed', 'Overdue', 'Completion %'],
      ...report.rangeBreakdown.map((rb) => [
        rb.rangeName,
        rb.total,
        rb.completed,
        rb.overdue,
        rb.total > 0 ? Math.round((rb.completed / rb.total) * 100) : 0,
      ]),
    ]);
  };

  const sorted = [...reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const generating = generateMutation.isPending;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">Daily Reports</h1>
          <p className="text-sm text-ptr-brown-light">Generate and review daily task reports</p>
        </div>
        <button onClick={() => generateMutation.mutate()} disabled={generating} className="btn-primary">
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{generating ? 'Generating…' : 'Generate Report'}</span>
        </button>
      </div>

      {generated && (
        <div className="card p-4 border-l-4 border-ptr-green">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ptr-brown">Report generated successfully</p>
              <p className="text-xs text-ptr-brown-light mt-0.5">
                {generated.totalTasks} tasks · {generated.completedCount} completed · {generated.overdueCount} overdue
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleExportCsv(generated)} className="btn-secondary gap-1.5">
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </button>
              <button onClick={() => handleExport(generated)} className="btn-secondary gap-1.5">
                <Download className="w-4 h-4" />
                Text
              </button>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText className="w-12 h-12 text-ptr-brown-light/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-ptr-brown">No reports yet</p>
          <p className="text-xs text-ptr-brown-light mt-1">Click "Generate Report" to create today's summary.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((report) => (
            <div key={report.id} className="relative">
              <ReportCard report={report} />
              <div className="absolute top-3 right-8 flex items-center gap-1">
                <button
                  onClick={() => handleExportCsv(report)}
                  className="p-1.5 rounded-lg hover:bg-ptr-cream text-ptr-brown-light hover:text-ptr-brown transition-colors"
                  title="Export CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleExport(report)}
                  className="p-1.5 rounded-lg hover:bg-ptr-cream text-ptr-brown-light hover:text-ptr-brown transition-colors"
                  title="Export text"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
