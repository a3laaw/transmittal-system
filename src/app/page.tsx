'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  computeOverallStatus, computeConsultantStatus, computeMohStatus,
  DEFAULT_DISCIPLINES, getDisciplineLabel, getDisciplineColor,
  CATEGORIES, getCategoryLabel, getCategoryColor, getCategoryIcon,
  APPROVAL_TYPES, getApprovalTypeLetter, getApprovalTypeLabel,
} from '@/lib/status';
import {
  FileText, Search, Plus, Download, Upload, AlertCircle,
  CheckCircle2, Clock, XCircle, Bell, LayoutDashboard, FileSpreadsheet,
  ArrowLeft, RefreshCw, FilePlus, History, Send, Settings, Building2,
  Trash2, Pencil, Hospital, Building, Copy, MoreVertical, Eye, FileDown,
  FolderPlus, Folder, BarChart3, Calendar, Printer,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Discipline = { code: string; label: string; color: string; prefix: string; categoryCode?: string; category?: string; transmittalsCount?: number };
type Category = { id?: string; code: string; label: string; icon: string; color: string; disciplinesCount?: number; transmittalsCount?: number };

type Transmittal = {
  id: string;
  reference: string;
  discipline: string;
  category?: string;
  type: string | null;
  description: string | null;
  createdAt: string;
  revisionsCount: number;
  lastSubmitDate: string | null;
  lastReplyDate: string | null;
  computedStatus: { status: string; label: string; color: string; emoji: string };
  consultantStatus: { status: string; label: string; color: string; emoji: string };
  mohStatus: { status: string; label: string; color: string; emoji: string };
  mohSubmitDate: string | null;
  mohSubmitRev: number | null;
  mohReviewDate: string | null;
};

type TransmittalDetail = Transmittal & {
  revisions: {
    id: string;
    revNumber: number;
    submitDate: string | null;
    replyDate: string | null;
    action: string | null;
    approvalType?: string | null;
    notes: string | null;
  }[];
  reviews: {
    id: string;
    party: string;
    status: string | null;
    submitDate: string | null;
    submitRev: number | null;
    reviewDate: string | null;
    notes: string | null;
  }[];
};

type Dashboard = {
  kpis: { total: number; approved: number; pending: number; overdue: number; cancelled: number; resubmit: number };
  mohKpis: { sent: number; approved: number; overdue: number; underReview: number };
  perCategory: Array<{
    code: string; label: string; icon: string; color: string;
    total: number; approved: number; pending: number; overdue: number;
    cancelled: number; resubmit: number;
    mohSent: number; mohApproved: number; mohOverdue: number;
    disciplinesCount: number; lastReference: string | null;
  }>;
  perDiscipline: Array<{
    code: string; label: string; color: string; category: string;
    total: number; approved: number; pending: number; overdue: number;
    cancelled: number; resubmit: number;
    mohSent: number; mohApproved: number; mohOverdue: number;
    lastReference: string | null;
  }>;
  disciplines: Discipline[];
  recent: Array<{ id: string; reference: string; discipline: string; description: string | null; status: any; mohStatus: any }>;
  consultantOverdueList: Array<{ id: string; reference: string; discipline: string; description: string | null; status: any; party: string }>;
  mohOverdueList: Array<{ id: string; reference: string; discipline: string; description: string | null; status: any; party: string }>;
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  try {
    // Use 'en-GB' to get DD/MM/YYYY with English numerals (instead of Arabic-Indic ٠١٢٣)
    return new Date(s).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return s; }
};

export default function Home() {
  const [view, setView] = useState<'dashboard' | 'list' | 'detail' | 'new' | 'import' | 'settings' | 'reports'>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [transmittals, setTransmittals] = useState<Transmittal[]>([]);
  const [detail, setDetail] = useState<TransmittalDetail | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>(DEFAULT_DISCIPLINES as any);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES as any);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [types, setTypes] = useState<string[]>([]);
  const [docTypes, setDocTypes] = useState<{ id: string; code: string; label: string; transmittalsCount?: number }[]>([]);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    try {
      const r = await fetch('/api/categories');
      if (r.ok) {
        const data = await r.json();
        if (data.items && data.items.length > 0) setCategories(data.items);
      }
    } catch {}
  }, []);

  const fetchDisciplines = useCallback(async () => {
    try {
      const r = await fetch('/api/disciplines');
      if (r.ok) {
        const data = await r.json();
        if (data.items && data.items.length > 0) setDisciplines(data.items);
      }
    } catch {}
  }, []);

  const fetchTypes = useCallback(async () => {
    try {
      const r = await fetch('/api/types');
      if (r.ok) {
        const data = await r.json();
        setTypes(data.items || []);
      }
    } catch {}
  }, []);

  const fetchDocTypes = useCallback(async () => {
    try {
      const r = await fetch('/api/doc-types');
      if (r.ok) {
        const data = await r.json();
        setDocTypes(data.items || []);
      }
    } catch {}
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard');
      if (!r.ok) throw new Error('فشل تحميل البيانات');
      const d = await r.json();
      setDashboard(d);
      if (d.disciplines && d.disciplines.length > 0) setDisciplines(d.disciplines);
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterDiscipline !== 'all') params.set('discipline', filterDiscipline);
      if (search) params.set('q', search);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterType !== 'all') params.set('type', filterType);
      const r = await fetch(`/api/transmittals?${params}`);
      if (!r.ok) throw new Error('فشل تحميل القائمة');
      const data = await r.json();
      setTransmittals(data.items);
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterDiscipline, search, filterStatus, filterType, toast]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/transmittals/${id}`);
      if (!r.ok) throw new Error('فشل تحميل التفاصيل');
      const d = await r.json();
      // Compute statuses for detail view
      const consultant = d.reviews.find((r: any) => r.party === 'CONSULTANT');
      const moh = d.reviews.find((r: any) => r.party === 'MOH');
      const overall = computeOverallStatus(
        d.revisions.map((r: any) => ({ submitDate: r.submitDate, replyDate: r.replyDate, action: r.action, approvalType: r.approvalType })),
        consultant, moh,
      );
      const consultantStatus = computeConsultantStatus(
        d.revisions.map((r: any) => ({ submitDate: r.submitDate, replyDate: r.replyDate, action: r.action, approvalType: r.approvalType })),
        consultant,
      );
      const mohStatus = computeMohStatus(moh);
      setDetail({ ...d, computedStatus: overall, consultantStatus, mohStatus } as TransmittalDetail);
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDisciplines();
    fetchTypes();
    fetchCategories();
    fetchDocTypes();
  }, [fetchDisciplines, fetchTypes, fetchCategories, fetchDocTypes]);

  useEffect(() => {
    if (view === 'dashboard') fetchDashboard();
    else if (view === 'list') fetchList();
    else if (view === 'detail' && selectedId) fetchDetail(selectedId);
  }, [view, selectedId, fetchDashboard, fetchList, fetchDetail]);

  const [sendToMohTarget, setSendToMohTarget] = useState<{ id: string; reference: string; latestRev: number } | null>(null);
  const [registerRevTarget, setRegisterRevTarget] = useState<{ id: string; reference: string; nextRev: number } | null>(null);
  const [consultantReplyTarget, setConsultantReplyTarget] = useState<{ id: string; reference: string } | null>(null);
  const [mohReplyTarget, setMohReplyTarget] = useState<{ id: string; reference: string } | null>(null);
  const [copyTarget, setCopyTarget] = useState<{ id: string; reference: string; description: string } | null>(null);

  const handleSendToMoh = (id: string, reference?: string, latestRev?: number) => {
    setSendToMohTarget({ id, reference: reference || '', latestRev: latestRev ?? 0 });
  };

  const confirmSendToMoh = async (submitDate: string, submitRev: number, notes: string) => {
    if (!sendToMohTarget) return;
    const { id } = sendToMohTarget;
    try {
      // Note: submitRev is now ignored by API - latest rev is used automatically
      const r = await fetch(`/api/transmittals/${id}/send-to-moh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitDate, notes: notes || null }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'فشل الإرسال');
      }
      const data = await r.json();
      toast({ title: 'تم الإرسال للوزارة', description: `REV.${data.sentRev} · بتاريخ ${fmtDate(data.sentDate)}` });
      setSendToMohTarget(null);
      if (view === 'detail' && selectedId === id) fetchDetail(id);
      else if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const handleCopyTransmittal = (id: string, reference: string, description?: string) => {
    setCopyTarget({ id, reference, description: description || '' });
  };

  const confirmCopyTransmittal = async (editedDescription: string) => {
    if (!copyTarget) return;
    const { id, reference } = copyTarget;
    try {
      const r = await fetch(`/api/transmittals/${id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editedDescription }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'فشل النسخ');
      }
      const data = await r.json();
      toast({
        title: 'تم نسخ البيانات',
        description: `${data.sourceReference} → ${data.newReference}`,
      });
      setCopyTarget(null);
      // Open the new transmittal's detail
      setSelectedId(data.newTransmittal.id);
      setView('detail');
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const handleRegisterRevision = (id: string, reference: string, nextRev: number) => {
    setRegisterRevTarget({ id, reference, nextRev });
  };

  const confirmRegisterRevision = async (submitDate: string, replyDate: string, action: string, approvalType: string, notes: string) => {
    if (!registerRevTarget) return;
    const { id, nextRev } = registerRevTarget;
    try {
      const r = await fetch(`/api/transmittals/${id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revNumber: nextRev,
          submitDate: submitDate || null,
          replyDate: replyDate || null,
          action: action || null,
          approvalType: action === 'approved' ? (approvalType || null) : null,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'فشل تسجيل الريفجن');
      }
      const actionLabel = action === 'approved' && approvalType
        ? `${getApprovalTypeLetter(approvalType)} - ${getApprovalTypeLabel(approvalType)}`
        : action || '';
      toast({ title: 'تم تسجيل الريفجن', description: `REV.${nextRev} · ${actionLabel}` });
      setRegisterRevTarget(null);
      if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const handleRegisterConsultantReply = (id: string, reference: string) => {
    setConsultantReplyTarget({ id, reference });
  };

  const confirmRegisterConsultantReply = async (replyDate: string, action: string, approvalType: string, notes: string) => {
    if (!consultantReplyTarget) return;
    const { id } = consultantReplyTarget;
    try {
      // First fetch the transmittal to get the latest rev number
      const detailR = await fetch(`/api/transmittals/${id}`);
      if (!detailR.ok) throw new Error('فشل تحميل الترانسميتال');
      const detail = await detailR.json();
      const latestRev = detail.revisions && detail.revisions.length > 0
        ? detail.revisions[detail.revisions.length - 1].revNumber
        : 0;
      // Update the latest revision with the reply date, action, and approval type
      const r = await fetch(`/api/transmittals/${id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revNumber: latestRev,
          replyDate: replyDate || null,
          action: action || null,
          approvalType: action === 'approved' ? (approvalType || null) : null,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'فشل تسجيل رد الاستشاري');
      }
      // Also update the consultant review status
      // Map approval types to consultant statuses: NOT_APPROVED(D) → Submit Next Rev, FOR_INFORMATION(E) → Under Review
      const actionToStatus: Record<string, string> = {
        approved: (approvalType === 'NOT_APPROVED' ? 'Submit Next Rev' :
                   approvalType === 'FOR_INFORMATION' ? 'Under Review' :
                   approvalType === 'APPROVED_AS_NOTED_RESUBMIT' ? 'Submit Next Rev' : 'Approved'),
        rejected: 'Submit Next Rev',
        withdrawn: 'Cancelled',
      };
      const status = actionToStatus[action] || 'Under Review';
      await fetch(`/api/transmittals/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party: 'CONSULTANT', status, reviewDate: replyDate || null, notes: notes || null }),
      });
      const actionLabel = action === 'approved' && approvalType
        ? `${getApprovalTypeLetter(approvalType)} - ${getApprovalTypeLabel(approvalType)}`
        : action || '';
      toast({ title: 'تم تسجيل رد الاستشاري', description: `REV.${latestRev} · ${actionLabel}` });
      setConsultantReplyTarget(null);
      if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const handleRegisterMohReply = (id: string, reference: string) => {
    setMohReplyTarget({ id, reference });
  };

  const confirmRegisterMohReply = async (reviewDate: string, status: string, notes: string) => {
    if (!mohReplyTarget) return;
    const { id } = mohReplyTarget;
    try {
      const r = await fetch(`/api/transmittals/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party: 'MOH',
          status: status || null,
          reviewDate: reviewDate || null,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'فشل تسجيل رد الوزارة');
      }
      toast({ title: 'تم تسجيل رد الوزارة', description: `${status} · ${fmtDate(reviewDate)}` });
      setMohReplyTarget(null);
      if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const handleDownloadExcel = async (reference: string, description: string) => {
    const today = new Date().toISOString().slice(0, 10);
    toast({ title: 'جاري توليد ملف Excel', description: `سيتم تنزيل ${reference}.xlsx` });
    // Use fetch + blob instead of window.location.href so:
    //  1) it works inside the PWA (installed desktop app) where navigation downloads can be blocked
    //  2) repeated downloads for the same reference (e.g. after publishing a new revision) always re-trigger
    const url = `/api/excel-template?reference=${encodeURIComponent(reference)}&description=${encodeURIComponent(description)}&date=${today}&_=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `فشل التوليد (${res.status})`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `Transmittal-${reference}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    } catch (e: any) {
      toast({ title: 'خطأ في التنزيل', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between h-16 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">نظام إدارة الترانسميتالات</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Sabah Al Salem South Health Center</p>
              </div>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />} label="الرئيسية" />
              <NavButton active={view === 'list'} onClick={() => setView('list')} icon={<FileSpreadsheet className="w-4 h-4" />} label="القائمة" />
              <NavButton active={view === 'new'} onClick={() => setView('new')} icon={<FilePlus className="w-4 h-4" />} label="جديد" />
              <NavButton active={view === 'reports'} onClick={() => setView('reports')} icon={<BarChart3 className="w-4 h-4" />} label="تقارير" />
              <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings className="w-4 h-4" />} label="الإعدادات" />
              <NavButton active={view === 'import'} onClick={() => setView('import')} icon={<Upload className="w-4 h-4" />} label="استيراد" />
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'dashboard' && <DashboardView data={dashboard} loading={loading} disciplines={disciplines} categories={categories} onOpenDetail={(id) => { setSelectedId(id); setView('detail'); }} onRefresh={fetchDashboard} onSendToMoh={handleSendToMoh} onCopy={handleCopyTransmittal} onDownloadExcel={handleDownloadExcel} />}
        {view === 'list' && (
          <ListView
            items={transmittals}
            loading={loading}
            search={search}
            onSearch={setSearch}
            filterCategory={filterCategory}
            onFilterCategory={setFilterCategory}
            filterDiscipline={filterDiscipline}
            onFilterDiscipline={setFilterDiscipline}
            filterStatus={filterStatus}
            onFilterStatus={setFilterStatus}
            filterType={filterType}
            onFilterType={setFilterType}
            types={types}
            disciplines={disciplines}
            categories={categories}
            onOpenDetail={(id) => { setSelectedId(id); setView('detail'); }}
            onRefresh={fetchList}
            onSendToMoh={handleSendToMoh}
            onCopy={handleCopyTransmittal}
            onDownloadExcel={handleDownloadExcel}
            onRegisterRevision={handleRegisterRevision}
            onRegisterConsultantReply={handleRegisterConsultantReply}
            onRegisterMohReply={handleRegisterMohReply}
          />
        )}
        {view === 'detail' && detail && (
          <DetailView
            detail={detail}
            loading={loading}
            disciplines={disciplines}
            onBack={() => setView('list')}
            onRefresh={() => selectedId && fetchDetail(selectedId)}
            onDownloadExcel={async () => {
              const ref = detail.reference;
              const desc = detail.description || '';
              const today = new Date().toISOString().slice(0, 10);
              toast({ title: 'جاري توليد الملف...', description: `Transmittal ${ref}` });
              const url = `/api/excel-template?reference=${encodeURIComponent(ref)}&description=${encodeURIComponent(desc)}&date=${today}&_=${Date.now()}`;
              try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || `فشل التوليد (${res.status})`);
                }
                const blob = await res.blob();
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `Transmittal-${ref}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
              } catch (e: any) {
                toast({ title: 'خطأ في التنزيل', description: e.message, variant: 'destructive' });
              }
            }}
            onSendToMoh={() => handleSendToMoh(detail.id, detail.reference, detail.revisions.length > 0 ? detail.revisions[detail.revisions.length - 1].revNumber : 0)}
            onCopy={() => handleCopyTransmittal(detail.id, detail.reference, detail.description || '')}
          />
        )}
        {view === 'detail' && !detail && !loading && <div className="text-center py-20 text-slate-500">لا توجد بيانات</div>}
        {view === 'new' && (
          <NewTransmittalView
            disciplines={disciplines}
            categories={categories}
            onCreated={(t) => { toast({ title: 'تم إنشاء الترانسميتال', description: t.reference }); setSelectedId(t.id); setView('detail'); }}
            onDownloadTemplate={async (ref, discipline, desc) => {
              const today = new Date().toISOString().slice(0, 10);
              toast({ title: 'جاري توليد ملف Excel', description: `سيتم تنزيل ${ref}.xlsx` });
              const url = `/api/excel-template?reference=${encodeURIComponent(ref)}&discipline=${encodeURIComponent(discipline)}&description=${encodeURIComponent(desc)}&date=${today}&_=${Date.now()}`;
              try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || `فشل التوليد (${res.status})`);
                }
                const blob = await res.blob();
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `Transmittal-${ref}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
              } catch (e: any) {
                toast({ title: 'خطأ في التنزيل', description: e.message, variant: 'destructive' });
              }
            }}
          />
        )}
        {view === 'import' && <ImportView onDone={() => { setView('dashboard'); fetchDashboard(); }} />}
        {view === 'reports' && <ReportsView disciplines={disciplines} categories={categories} onOpenDetail={(id) => { setSelectedId(id); setView('detail'); }} />}
        {view === 'settings' && <SettingsView disciplines={disciplines} categories={categories} docTypes={docTypes} onRefreshDisciplines={fetchDisciplines} onRefreshCategories={fetchCategories} onRefreshDocTypes={fetchDocTypes} />}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-center text-xs text-slate-500">
          نظام إدارة الترانسميتالات · Sabah Al Salem South Health Center · {new Date().getFullYear()}
        </div>
      </footer>

      {sendToMohTarget && (
        <SendToMohDialog
          target={sendToMohTarget}
          onClose={() => setSendToMohTarget(null)}
          onConfirm={confirmSendToMoh}
        />
      )}
      {registerRevTarget && (
        <RegisterRevisionDialog
          target={registerRevTarget}
          onClose={() => setRegisterRevTarget(null)}
          onConfirm={confirmRegisterRevision}
        />
      )}
      {consultantReplyTarget && (
        <ConsultantReplyDialog
          target={consultantReplyTarget}
          onClose={() => setConsultantReplyTarget(null)}
          onConfirm={confirmRegisterConsultantReply}
        />
      )}
      {mohReplyTarget && (
        <MohReplyDialog
          target={mohReplyTarget}
          onClose={() => setMohReplyTarget(null)}
          onConfirm={confirmRegisterMohReply}
        />
      )}
      {copyTarget && (
        <CopyTransmittalDialog
          target={copyTarget}
          onClose={() => setCopyTarget(null)}
          onConfirm={confirmCopyTransmittal}
        />
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button onClick={onClick} variant={active ? 'default' : 'ghost'} size="sm"
      className={`gap-1.5 ${active ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

/* ============ DASHBOARD VIEW ============ */
function DashboardView({ data, loading, disciplines, categories, onOpenDetail, onRefresh, onSendToMoh, onCopy, onDownloadExcel }: {
  data: Dashboard | null; loading: boolean; disciplines: Discipline[]; categories: Category[];
  onOpenDetail: (id: string) => void; onRefresh: () => void; onSendToMoh: (id: string, reference?: string, latestRev?: number) => void;
  onCopy: (id: string, reference: string, description?: string) => void;
  onDownloadExcel: (reference: string, description: string) => void;
}) {
  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!data) return <div className="text-center py-20 text-slate-500">لا توجد بيانات. قم باستيراد ملف Excel أولاً.</div>;

  const kpis = [
    { label: 'إجمالي', value: data.kpis.total, color: 'bg-slate-700', icon: <FileText className="w-5 h-5" /> },
    { label: 'معتمد', value: data.kpis.approved, color: 'bg-emerald-600', icon: <CheckCircle2 className="w-5 h-5" /> },
    { label: 'بانتظار', value: data.kpis.pending, color: 'bg-yellow-500', icon: <Clock className="w-5 h-5" /> },
    { label: 'متأخر استشاري', value: data.kpis.overdue, color: 'bg-red-600', icon: <AlertCircle className="w-5 h-5" /> },
    { label: 'إعادة إرسال', value: data.kpis.resubmit, color: 'bg-orange-500', icon: <RefreshCw className="w-5 h-5" /> },
    { label: 'ملغى', value: data.kpis.cancelled, color: 'bg-gray-500', icon: <XCircle className="w-5 h-5" /> },
  ];
  const mohKpis = [
    { label: 'مُرسل للوزارة', value: data.mohKpis.sent, color: 'bg-blue-600', icon: <Send className="w-5 h-5" /> },
    { label: 'معتمد بالوزارة', value: data.mohKpis.approved, color: 'bg-emerald-600', icon: <CheckCircle2 className="w-5 h-5" /> },
    { label: 'قيد المراجعة', value: data.mohKpis.underReview, color: 'bg-yellow-500', icon: <Clock className="w-5 h-5" /> },
    { label: 'متأخر بالوزارة', value: data.mohKpis.overdue, color: 'bg-red-600', icon: <AlertCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">لوحة المعلومات</h2>
          <p className="text-sm text-slate-500 mt-1">نظرة عامة على حالة كل الترانسميتالات</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-sm"><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-slate-500 mb-1">{k.label}</p><p className="text-2xl font-bold text-slate-900">{k.value}</p></div>
              <div className={`w-10 h-10 rounded-lg ${k.color} text-white flex items-center justify-center`}>{k.icon}</div>
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* MOH KPIs */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hospital className="w-5 h-5 text-blue-700" /> حالة الإرسال لوزارة الصحة</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {mohKpis.map((k) => (
              <div key={k.label} className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-slate-500 mb-1">{k.label}</p><p className="text-xl font-bold text-slate-900">{k.value}</p></div>
                  <div className={`w-8 h-8 rounded ${k.color} text-white flex items-center justify-center`}>{k.icon}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-Category Cards */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Folder className="w-5 h-5" /> تفصيل حسب القسم الرئيسي</CardTitle>
          <CardDescription>توزيع الترانسميتالات على الأقسام الرئيسية (ترانسميتال/MIR/RFI/كتب)</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(data.perCategory || []).map((cat) => {
              const pct = cat.total > 0 ? Math.round((cat.approved / cat.total) * 100) : 0;
              return (
                <div key={cat.code} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <span className="text-xl">{cat.icon}</span>
                      <Badge className={`${cat.color} border-0`}>{cat.label}</Badge>
                    </h3>
                    <span className="text-2xl font-bold text-slate-900">{cat.total}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-emerald-700">معتمد: <strong>{cat.approved}</strong></div>
                    <div className="text-yellow-700">بانتظار: <strong>{cat.pending}</strong></div>
                    <div className="text-red-700">متأخر: <strong>{cat.overdue}</strong></div>
                    <div className="text-blue-700">للوزارة: <strong>{cat.mohSent}</strong></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold">{pct}%</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{cat.disciplinesCount} تخصص فرعي · آخر: {cat.lastReference || '—'}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-lg">تفصيل حسب التخصص الفرعي</CardTitle>
          <CardDescription>توزيع الترانسميتالات على التخصصات داخل كل قسم رئيسي</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التخصص</TableHead>
              <TableHead className="text-right">القسم الرئيسي</TableHead>
              <TableHead className="text-center">الإجمالي</TableHead>
              <TableHead className="text-center">معتمد</TableHead>
              <TableHead className="text-center">بانتظار</TableHead>
              <TableHead className="text-center">متأخر</TableHead>
              <TableHead className="text-center">للوزارة</TableHead>
              <TableHead className="text-center">معتمد وزارة</TableHead>
              <TableHead className="text-center">% الإنجاز</TableHead>
              <TableHead className="text-center">آخر مرجع</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.perDiscipline.map((d) => {
                const pct = d.total > 0 ? Math.round((d.approved / d.total) * 100) : 0;
                const cat = categories.find(c => c.code === d.category);
                return (
                  <TableRow key={d.code} className="hover:bg-slate-50">
                    <TableCell><Badge className={`${d.color} border-0`} variant="secondary">{d.label} · {d.code}</Badge></TableCell>
                    <TableCell>
                      {cat && <Badge variant="outline" className={`${cat.color} border-0 text-xs`}>{cat.icon} {cat.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{d.total}</TableCell>
                    <TableCell className="text-center text-emerald-700 font-semibold">{d.approved}</TableCell>
                    <TableCell className="text-center text-yellow-700">{d.pending}</TableCell>
                    <TableCell className="text-center text-red-700 font-semibold">{d.overdue}</TableCell>
                    <TableCell className="text-center text-blue-700">{d.mohSent}</TableCell>
                    <TableCell className="text-center text-emerald-700">{d.mohApproved}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs font-semibold">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-600">{d.lastReference || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.consultantOverdueList.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-red-800"><AlertCircle className="w-5 h-5" /> تنبيهات تأخر الاستشاري ({data.consultantOverdueList.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">المرجع</TableHead><TableHead className="text-right">التخصص</TableHead>
                <TableHead className="text-right">الوصف</TableHead><TableHead className="text-center">الحالة</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.consultantOverdueList.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-red-50" onClick={() => onOpenDetail(t.id)}>
                    <TableCell className="font-mono font-semibold">{t.reference}</TableCell>
                    <TableCell><Badge variant="secondary" className={getDisciplineColor(t.discipline, disciplines)}>{getDisciplineLabel(t.discipline, disciplines)}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-md truncate">{t.description || '—'}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={t.status.color}>{t.status.emoji} {t.status.label}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.mohOverdueList.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-purple-800"><Hospital className="w-5 h-5" /> تنبيهات تأخر الوزارة ({data.mohOverdueList.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">المرجع</TableHead><TableHead className="text-right">التخصص</TableHead>
                <TableHead className="text-right">الوصف</TableHead><TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center">إجراء</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.mohOverdueList.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-purple-50" onClick={() => onOpenDetail(t.id)}>
                    <TableCell className="font-mono font-semibold">{t.reference}</TableCell>
                    <TableCell><Badge variant="secondary" className={getDisciplineColor(t.discipline, disciplines)}>{getDisciplineLabel(t.discipline, disciplines)}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-md truncate">{t.description || '—'}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={t.status.color}>{t.status.emoji} {t.status.label}</Badge></TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" disabled><Send className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============ LIST VIEW ============ */
function ListView({ items, loading, search, onSearch, filterCategory, onFilterCategory, filterDiscipline, onFilterDiscipline, filterStatus, onFilterStatus, filterType, onFilterType, types, disciplines, categories, onOpenDetail, onRefresh, onSendToMoh, onCopy, onDownloadExcel, onRegisterRevision, onRegisterConsultantReply, onRegisterMohReply }: {
  items: Transmittal[]; loading: boolean; search: string; onSearch: (s: string) => void;
  filterCategory: string; onFilterCategory: (s: string) => void;
  filterDiscipline: string; onFilterDiscipline: (s: string) => void;
  filterStatus: string; onFilterStatus: (s: string) => void;
  filterType: string; onFilterType: (s: string) => void;
  types: string[]; disciplines: Discipline[]; categories: Category[];
  onOpenDetail: (id: string) => void; onRefresh: () => void; onSendToMoh: (id: string, reference?: string, latestRev?: number) => void;
  onCopy: (id: string, reference: string, description?: string) => void;
  onDownloadExcel: (reference: string, description: string) => void;
  onRegisterRevision: (id: string, reference: string, nextRev: number) => void;
  onRegisterConsultantReply: (id: string, reference: string) => void;
  onRegisterMohReply: (id: string, reference: string) => void;
}) {
  // Filter disciplines based on selected category (cascading)
  const availableDisciplines = filterCategory !== 'all'
    ? disciplines.filter(d => (d.categoryCode || d.category || 'TRANSMITTAL') === filterCategory)
    : disciplines;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-2xl font-bold text-slate-900">قائمة الترانسميتالات</h2>
          <p className="text-sm text-slate-500 mt-1">{items.length} نتيجة</p></div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </Button>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">بحث</Label>
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="ابحث بالمرجع أو الوصف..." className="pr-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">القسم الرئيسي</Label>
            <Select value={filterCategory} onValueChange={(v) => { onFilterCategory(v); onFilterDiscipline('all'); }}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {categories.map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">التخصص الفرعي</Label>
            <Select value={filterDiscipline} onValueChange={onFilterDiscipline}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التخصصات</SelectItem>
                {availableDisciplines.map(d => <SelectItem key={d.code} value={d.code}>{d.label} ({d.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">النوع</Label>
            <Select value={filterType} onValueChange={onFilterType}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الحالة</Label>
            <Select value={filterStatus} onValueChange={onFilterStatus}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="approved">✅ معتمد</SelectItem>
                <SelectItem value="pending">⏳ بانتظار الرد</SelectItem>
                <SelectItem value="overdue">🔴 متأخر</SelectItem>
                <SelectItem value="resubmit">🔔 إعادة إرسال</SelectItem>
                <SelectItem value="cancelled">🚫 ملغى</SelectItem>
                <SelectItem value="draft">📝 مسودة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        {loading && items.length === 0 ? (
          <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد نتائج مطابقة</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10"><TableRow>
                <TableHead className="text-right">المرجع</TableHead>
                <TableHead className="text-right">القسم</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">الوصف</TableHead>
                <TableHead className="text-center">المراجعات</TableHead>
                <TableHead className="text-center">الاستشاري</TableHead>
                <TableHead className="text-center">الوزارة</TableHead>
                <TableHead className="text-center">إجراءات</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpenDetail(t.id)}>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">{t.reference}</TableCell>
                    <TableCell><Badge variant="secondary" className={getDisciplineColor(t.discipline, disciplines)}>{getDisciplineLabel(t.discipline, disciplines)}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{t.type || '—'}</TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-xs truncate">{t.description || '—'}</TableCell>
                    <TableCell className="text-center font-semibold">{t.revisionsCount}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={t.consultantStatus.color}>{t.consultantStatus.emoji}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={t.mohStatus.color}>{t.mohStatus.emoji}</Badge></TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onOpenDetail(t.id)}>
                            <Eye className="w-4 h-4 ml-2" /> عرض التفاصيل
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRegisterRevision(t.id, t.reference, t.revisionsCount)}
                            disabled={t.computedStatus.status === 'cancelled' || t.revisionsCount === 0 || t.lastReplyDate === null}
                          >
                            <History className="w-4 h-4 ml-2" /> تسجيل ريفجن (REV.{t.revisionsCount})
                            {t.computedStatus.status === 'cancelled' ? <span className="text-[10px] text-slate-400 mr-1">(مسحوب)</span> :
                             (t.revisionsCount === 0 || t.lastReplyDate === null) && <span className="text-[10px] text-slate-400 mr-1">(بانتظار الرد)</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRegisterConsultantReply(t.id, t.reference)}
                            disabled={t.computedStatus.status === 'cancelled' || t.revisionsCount === 0 || t.lastReplyDate !== null}
                          >
                            <Building2 className="w-4 h-4 ml-2" /> تسجيل رد الاستشاري
                            {t.computedStatus.status === 'cancelled' ? <span className="text-[10px] text-slate-400 mr-1">(مسحوب)</span> :
                             (t.revisionsCount === 0 || t.lastReplyDate !== null) && <span className="text-[10px] text-slate-400 mr-1">{t.revisionsCount === 0 ? '(لا ريفجن)' : '(تم الرد)'}</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRegisterMohReply(t.id, t.reference)}
                            disabled={t.computedStatus.status === 'cancelled' || t.mohStatus.status === 'not_sent'}
                          >
                            <Hospital className="w-4 h-4 ml-2" /> تسجيل رد الوزارة
                            {t.computedStatus.status === 'cancelled' ? <span className="text-[10px] text-slate-400 mr-1">(مسحوب)</span> :
                             t.mohStatus.status === 'not_sent' && <span className="text-[10px] text-slate-400 mr-1">(لم يُرسل)</span>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onSendToMoh(t.id, t.reference)}
                            disabled={t.computedStatus.status === 'cancelled' || t.consultantStatus.status !== 'approved' || (t.mohStatus.status !== 'not_sent' && t.mohStatus.status !== 'reviewed')}
                          >
                            <Send className="w-4 h-4 ml-2" /> إرسال REV.{t.revisionsCount > 0 ? (t.revisionsCount - 1) : 0} للوزارة
                            {t.consultantStatus.status !== 'approved' && <span className="text-[10px] text-slate-400 mr-1">(غير معتمد)</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCopy(t.id, t.reference, t.description || '')}>
                            <Copy className="w-4 h-4 ml-2" /> نسخ برقم جديد
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownloadExcel(t.reference, t.description || '')}>
                            <FileDown className="w-4 h-4 ml-2" /> تنزيل Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

/* ============ DETAIL VIEW ============ */
function DetailView({ detail, loading, disciplines, onBack, onRefresh, onDownloadExcel, onSendToMoh, onCopy }: {
  detail: TransmittalDetail; loading: boolean; disciplines: Discipline[];
  onBack: () => void; onRefresh: () => void; onDownloadExcel: () => void; onSendToMoh: () => void;
  onCopy: () => void;
}) {
  const [showRevDialog, setShowRevDialog] = useState(false);
  const { toast } = useToast();

  const latestRevNumber = detail.revisions.length > 0 ? detail.revisions[detail.revisions.length - 1].revNumber : 0;
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [showFileChoice, setShowFileChoice] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkSource, setLinkSource] = useState('link');

  const fetchAttachments = useCallback(async () => {
    try {
      const r = await fetch(`/api/transmittals/${detail.id}/attachments`);
      if (r.ok) {
        const data = await r.json();
        setAttachments(data.items || []);
      }
    } catch {}
  }, [detail.id]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.pdf', '.doc', '.docx'];
  const ALLOWED_TYPES = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  const isAllowedFile = (file: File): boolean => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) return true;
    if (file.type && ALLOWED_TYPES.some(t => file.type.startsWith(t))) return true;
    return false;
  };

  const handleUpload = async (file: File) => {
    if (!isAllowedFile(file)) {
      toast({
        title: 'نوع الملف غير مدعوم',
        description: 'يُسمح فقط بالصور (PNG, JPG, GIF, WebP) و PDF و Word',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/transmittals/${detail.id}/upload`, {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) throw new Error('فشل الرفع');
      toast({ title: 'تم رفع الملف', description: file.name });
      fetchAttachments();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !linkName.trim()) return;
    setUploading(true);
    try {
      const r = await fetch(`/api/transmittals/${detail.id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim(), fileName: linkName.trim(), urlSource: linkSource }),
      });
      if (!r.ok) throw new Error('فشل إضافة الرابط');
      toast({ title: 'تم إضافة الرابط', description: linkName });
      setShowLinkDialog(false);
      setLinkUrl('');
      setLinkName('');
      fetchAttachments();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;
    try {
      const r = await fetch(`/api/transmittals/${detail.id}/attachments?attId=${attId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('فشل الحذف');
      toast({ title: 'تم حذف المرفق' });
      fetchAttachments();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  // Download file using base64 data URL (most reliable method)
  // Fetches file as base64 from server, then downloads directly from data URL
  // This bypasses ALL proxy/server issues with direct file serving
  const handleDownloadFile = async (att: any) => {
    if (!att.id) {
      toast({ title: 'خطأ', description: 'معرف الملف غير موجود', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'جاري التنزيل...', description: att.fileName });
      
      // Fetch file as base64 data URL
      const res = await fetch(`/api/file-data/${att.id}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`فشل التحضير (${res.status})`);
      }
      const data = await res.json();
      if (!data.ok || !data.dataUrl) {
        throw new Error('فشل قراءة الملف');
      }

      // Create download link from data URL
      const a = document.createElement('a');
      a.href = data.dataUrl;
      a.download = att.fileName || 'download';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ title: 'تم التنزيل', description: att.fileName });
    } catch (e: any) {
      console.error('Download error:', e);
      toast({ title: 'خطأ في التنزيل', description: e.message || 'فشل التنزيل', variant: 'destructive' });
    }
  };

  const sourceConfig: Record<string, { label: string; icon: string; color: string }> = {
    link: { label: 'رابط', icon: '🔗', color: 'bg-blue-600 text-white' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /> رجوع للقائمة</Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
            <Copy className="w-4 h-4" /> نسخ برقم جديد
          </Button>
          <Button variant="outline" size="sm" onClick={onSendToMoh}
            disabled={detail.mohStatus.status !== 'not_sent' && detail.mohStatus.status !== 'reviewed'}
            className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
            <Send className="w-4 h-4" /> إرسال REV.{latestRevNumber} للوزارة
          </Button>
          <Button size="sm" onClick={onDownloadExcel} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Download className="w-4 h-4" /> تنزيل ملف Excel
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-6">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{detail.reference}</h2>
            <Badge variant="secondary" className={getDisciplineColor(detail.discipline, disciplines)}>{getDisciplineLabel(detail.discipline, disciplines)} · {detail.discipline}</Badge>
            <Badge variant="outline" className={detail.computedStatus.color}>{detail.computedStatus.emoji} {detail.computedStatus.label}</Badge>
          </div>
          {detail.type && <p className="text-sm text-slate-600">النوع: {detail.type}</p>}
          {detail.description && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{detail.description}</p>
            </div>
          )}
        </div>
      </CardContent></Card>

      {/* Reviews Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5" /> الاستشاري</h3>
            <Badge variant="outline" className={detail.consultantStatus.color}>{detail.consultantStatus.emoji} {detail.consultantStatus.label}</Badge>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">آخر إرسال:</dt><dd>{fmtDate(detail.lastSubmitDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">آخر رد:</dt><dd>{fmtDate(detail.lastReplyDate)}</dd></div>
          </dl>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Hospital className="w-5 h-5 text-blue-700" /> وزارة الصحة</h3>
            <Badge variant="outline" className={detail.mohStatus.color}>{detail.mohStatus.emoji} {detail.mohStatus.label}</Badge>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">إرسال للوزارة:</dt><dd>{fmtDate(detail.mohSubmitDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">الريفجن المُرسل:</dt><dd>{detail.mohSubmitRev !== null ? `REV.${detail.mohSubmitRev}` : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">رد الوزارة:</dt><dd>{fmtDate(detail.mohReviewDate)}</dd></div>
          </dl>
        </CardContent></Card>
      </div>

      {/* Revisions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5" /> سجل المراجعات ({detail.revisions.length})</CardTitle>
            <CardDescription>سيتم اقتراح REV.{detail.revisions.length} تلقائياً عند الإضافة</CardDescription></div>
          <Button size="sm" onClick={() => setShowRevDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> إضافة مراجعة (REV.{detail.revisions.length})
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {detail.revisions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">لا توجد مراجعات بعد</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-center">المراجعة</TableHead>
                <TableHead className="text-center">تاريخ الإرسال</TableHead>
                <TableHead className="text-center">تاريخ الرد</TableHead>
                <TableHead className="text-center">الإجراء</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {detail.revisions.map((r) => {
                  let actionLabel: string;
                  let actionColor: string;
                  const act = (r.action || '').toLowerCase().trim();
                  if (act === 'approved') {
                    if (r.approvalType === 'NOT_APPROVED') { actionLabel = '(D) NOT APPROVED — غير معتمد'; actionColor = 'text-red-700'; }
                    else if (r.approvalType === 'FOR_INFORMATION') { actionLabel = '(E) FOR INFORMATION — للمعلومات'; actionColor = 'text-orange-700'; }
                    else if (r.approvalType === 'APPROVED_AS_NOTED_RESUBMIT') { actionLabel = '(C) APPROVED AS NOTED & RESUBMIT — معتمد بملاحظات وإعادة'; actionColor = 'text-orange-700'; }
                    else if (r.approvalType === 'APPROVED_AS_NOTED') { actionLabel = '(B) APPROVED AS NOTED — معتمد بملاحظات'; actionColor = 'text-emerald-700'; }
                    else if (r.approvalType === 'APPROVED') { actionLabel = '(A) APPROVED — معتمد'; actionColor = 'text-emerald-700'; }
                    else { actionLabel = '✅ معتمد'; actionColor = 'text-emerald-700'; } // old data without approvalType
                  } else if (act === 'rejected') {
                    actionLabel = '❌ مرفوض'; actionColor = 'text-red-700';
                  } else if (act === 'withdrawn') {
                    actionLabel = '🚫 مسحوب'; actionColor = 'text-gray-600';
                  } else if (act === 'pending') {
                    actionLabel = '⏳ بانتظار الرد'; actionColor = 'text-yellow-700'; // backward compat with old data
                  } else {
                    actionLabel = r.action || '—'; actionColor = 'text-yellow-700';
                  }
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-center font-bold">REV.{r.revNumber}</TableCell>
                      <TableCell className="text-center text-sm">{fmtDate(r.submitDate)}</TableCell>
                      <TableCell className="text-center text-sm">{fmtDate(r.replyDate)}</TableCell>
                      <TableCell className={`text-center font-semibold ${actionColor}`}>{actionLabel}</TableCell>
                      <TableCell className="text-sm text-slate-600">{r.notes || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddRevisionDialog
        open={showRevDialog} onOpenChange={setShowRevDialog}
        transmittalId={detail.id} nextRevNumber={detail.revisions.length}
        onSaved={() => { setShowRevDialog(false); onRefresh(); toast({ title: 'تم حفظ المراجعة' }); }}
      />

      {/* Attachments Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileDown className="w-5 h-5" /> المرفقات والصور ({attachments.length})
            </CardTitle>
            <CardDescription>ارفع صور (PNG, JPG, GIF, WebP) أو PDF أو Word فقط</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              id="pick-file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                e.target.value = '';
                handleUpload(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              className="gap-1.5"
              onClick={() => document.getElementById('pick-file')?.click()}
            >
              <Upload className="w-4 h-4" /> {uploading ? 'جاري...' : 'رفع ملف'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowLinkDialog(true)}
            >
              <FileDown className="w-4 h-4" /> إضافة رابط خارجي
            </Button>
          </div>

          {/* Attachments list */}
          {attachments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">لا توجد مرفقات بعد</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {attachments.map((att) => {
                const isUploaded = att.filePath && att.filePath.length > 0;
                const isLink = att.url && att.url.length > 0;
                // Detect image by MIME type OR by file extension (fallback)
                const imgExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
                const pdfExts = ['.pdf'];
                const docExts = ['.doc', '.docx'];
                const fileExt = (att.fileName || '').toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
                const isImage = isUploaded && (
                  (att.fileType && att.fileType.startsWith('image/')) ||
                  imgExts.includes(fileExt)
                );
                const isPdf = isUploaded && (
                  (att.fileType && att.fileType === 'application/pdf') ||
                  pdfExts.includes(fileExt)
                );
                const isDoc = isUploaded && (
                  (att.fileType && (att.fileType === 'application/msword' || att.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) ||
                  docExts.includes(fileExt)
                );
                const src = att.urlSource || 'link';
                const sc = sourceConfig[src] || sourceConfig.link;
                const openUrl = isLink ? att.url : att.filePath;
                // Cache-busting query for image src to force reload after re-upload
                const imgSrc = isImage ? `${att.filePath}${att.filePath.includes('?') ? '&' : '?'}t=${att.createdAt ? new Date(att.createdAt).getTime() : ''}` : att.filePath;

                // File type badge info
                const typeBadge = isPdf ? { label: 'PDF', color: 'bg-red-100 text-red-700', icon: '📄' }
                  : isDoc ? { label: 'Word', color: 'bg-blue-100 text-blue-700', icon: '📝' }
                  : isImage ? { label: 'صورة', color: 'bg-emerald-100 text-emerald-700', icon: '🖼️' }
                  : null;

                return (
                  <div key={att.id} className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                    {/* Preview */}
                    {isImage ? (
                      <img
                        src={imgSrc}
                        alt={att.fileName}
                        className="w-full h-32 object-cover rounded border border-slate-200 bg-slate-50"
                        onError={(e) => {
                          // If image fails to load, replace with file icon
                          const t = e.currentTarget;
                          t.style.display = 'none';
                          const parent = t.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="w-full h-32 flex items-center justify-center bg-slate-50 rounded border border-slate-200"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-slate-50 rounded border border-slate-200 relative">
                        {isLink && <span className="text-3xl">{sc.icon}</span>}
                        {isPdf && <span className="text-4xl">📄</span>}
                        {isDoc && <span className="text-4xl">📝</span>}
                        {isUploaded && !isImage && !isPdf && !isDoc && <FileDown className="w-8 h-8 text-slate-400" />}
                        {/* Type badge */}
                        {typeBadge && (
                          <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold ${typeBadge.color}`}>
                            {typeBadge.icon} {typeBadge.label}
                          </span>
                        )}
                        {/* Source badge for links */}
                        {isLink && (
                          <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold ${sc.color}`}>
                            {sc.label}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      {isUploaded ? (
                        <button
                          onClick={() => handleDownloadFile(att)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block text-right cursor-pointer"
                          title={att.fileName}
                        >
                          {att.fileName}
                        </button>
                      ) : (
                        <button
                          onClick={() => window.open(openUrl, '_blank')}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block text-right"
                          title={att.fileName}
                        >
                          {sc.icon} {att.fileName}
                        </button>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isUploaded ? `${(att.fileSize / 1024).toFixed(1)} KB` : sc.label}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {isUploaded && (
                        <Button size="sm" variant="ghost" title="تنزيل" onClick={() => handleDownloadFile(att)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {isLink && (
                        <a href={openUrl} target="_blank" rel="noopener noreferrer" title="فتح">
                          <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                        </a>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAttachment(att.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add External Link Dialog */}
      {showLinkDialog && (
        <Dialog open={true} onOpenChange={(v) => !v && setShowLinkDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileDown className="w-5 h-5 text-blue-700" />
                إضافة رابط خارجي
              </DialogTitle>
              <DialogDescription>أضف أي رابط مباشر لملف أو صورة خارجية</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">النوع</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white w-fit">
                  <span className="text-lg">🔗</span>
                  <span className="font-semibold text-sm">رابط خارجي</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">اسم الملف / الوصف</Label>
                <Input
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="مثال: Excavation Plan PDF"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">الرابط (URL)</Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>إلغاء</Button>
              <Button
                onClick={handleAddLink}
                disabled={!linkUrl.trim() || !linkName.trim() || uploading}
                className="bg-blue-700 hover:bg-blue-800 gap-1.5"
              >
                <FileDown className="w-4 h-4" /> {uploading ? 'جاري...' : 'إضافة الرابط'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AddRevisionDialog({ open, onOpenChange, transmittalId, nextRevNumber, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  transmittalId: string; nextRevNumber: number; onSaved: () => void;
}) {
  const [submitDate, setSubmitDate] = useState('');
  const [replyDate, setReplyDate] = useState('');
  const [action, setAction] = useState('');
  const [approvalType, setApprovalType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-set submit date to today when dialog opens
  useEffect(() => {
    if (open) {
      setSubmitDate(new Date().toISOString().slice(0, 10));
      setReplyDate(''); setAction(''); setApprovalType(''); setNotes('');
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/transmittals/${transmittalId}/revisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revNumber: nextRevNumber,
          submitDate: submitDate || null,
          replyDate: replyDate || null,
          action: action || null,
          approvalType: action === 'approved' ? (approvalType || null) : null,
          notes: notes || null,
        }),
      });
      if (!r.ok) throw new Error('فشل الحفظ');
      onSaved();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleActionChange = (v: string) => {
    setAction(v);
    if (v !== 'approved') setApprovalType('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة مراجعة جديدة - REV.{nextRevNumber}</DialogTitle>
          <DialogDescription>رقم المراجعة مقترح تلقائياً (آخر رقم + 1). سجّل تاريخ الإرسال والرد والإجراء.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-sm">
            <strong>رقم المراجعة:</strong> REV.{nextRevNumber} (تلقائي)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ الإرسال</Label>
              <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ الرد</Label>
              <Input type="date" value={replyDate} onChange={(e) => setReplyDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">الإجراء</Label>
            <Select value={action} onValueChange={handleActionChange}>
              <SelectTrigger><SelectValue placeholder="اختر الإجراء" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">✅ مقبول</SelectItem>
                <SelectItem value="rejected">❌ مرفوض</SelectItem>
                <SelectItem value="withdrawn">🚫 مسحوب</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === 'approved' && (
            <div className="space-y-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-emerald-800">نوع القبول *</Label>
              <Select value={approvalType} onValueChange={setApprovalType}>
                <SelectTrigger className="!w-full !h-auto !min-h-[36px] !whitespace-normal !break-words text-left [&_[data-slot=select-value]]:!line-clamp-none [&_[data-slot=select-value]]:!whitespace-normal [&_[data-slot=select-value]]:!break-words"><SelectValue placeholder="اختر نوع القبول" className="whitespace-normal break-words leading-snug" /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map(at => (
                    <SelectItem key={at.code} value={at.code} className="whitespace-normal break-words leading-snug py-2">
                      <span className="font-bold">({at.letter})</span> {at.label}
                      <br />
                      <span className="text-xs text-slate-500">{at.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || (action === 'approved' && !approvalType)} className="bg-emerald-700 hover:bg-emerald-800">{saving ? 'جاري الحفظ...' : 'حفظ REV.' + nextRevNumber}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ NEW TRANSMITTAL VIEW ============ */
function NewTransmittalView({ disciplines, categories, onCreated, onDownloadTemplate }: {
  disciplines: Discipline[];
  categories: Category[];
  onCreated: (t: any) => void;
  onDownloadTemplate: (ref: string, discipline: string, desc: string) => void;
}) {
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [refInfo, setRefInfo] = useState<{ lastGlobalMax: number; totalAllDisciplines: number; recentAllDisciplines: string[] } | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const { toast } = useToast();

  const fetchNextReference = async (d: string) => {
    if (!d) return;
    setLoadingRef(true);
    try {
      const r = await fetch(`/api/transmittals/next-ref?discipline=${encodeURIComponent(d)}`);
      if (!r.ok) throw new Error('فشل جلب الرقم التالي');
      const data = await r.json();
      setReference(data.nextReference);
      setRefInfo({
        lastGlobalMax: data.lastGlobalMax,
        totalAllDisciplines: data.totalAllDisciplines,
        recentAllDisciplines: data.recentAllDisciplines || [],
      });
    } catch {
      setReference(''); setRefInfo(null);
    } finally { setLoadingRef(false); }
  };

  const handleCreate = async () => {
    if (!reference || !discipline) {
      toast({ title: 'خطأ', description: 'المرجع والتخصص مطلوبان', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/transmittals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, discipline, type: type || undefined, description: description || undefined }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الإنشاء'); }
      const created = await r.json();
      if (submitDate) {
        await fetch(`/api/transmittals/${created.id}/revisions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revNumber: 0, submitDate }),
        });
      }
      onCreated(created);
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">إنشاء ترانسميتال جديد</h2>
        <p className="text-sm text-slate-500 mt-1">
          سيتم اقتراح المرجع تلقائياً (الرقم التسلسلي الموحد + كود القسم). مثال: {`{CIV-171, EL-172, PL-173, ...}`}
        </p>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
        {/* Step 1: Main Category */}
        <div className="space-y-1.5">
          <Label>القسم الرئيسي * <span className="text-xs text-slate-500">(ترانسميتال / MIR / RFI / كتب / ...)</span></Label>
          <Select value={category} onValueChange={(v) => { setCategory(v); setDiscipline(''); setReference(''); setRefInfo(null); }}>
            <SelectTrigger><SelectValue placeholder="اختر القسم الرئيسي أولاً" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Discipline (filtered by category) */}
        {category && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>التخصص الفرعي *</Label>
              <Select value={discipline} onValueChange={(v) => { setDiscipline(v); fetchNextReference(v); }}>
                <SelectTrigger><SelectValue placeholder="اختر التخصص" /></SelectTrigger>
                <SelectContent>
                  {disciplines.filter(d => (d.categoryCode || d.category || 'TRANSMITTAL') === category).map(d => <SelectItem key={d.code} value={d.code}>{d.label} ({d.code})</SelectItem>)}
                </SelectContent>
              </Select>
              {disciplines.filter(d => (d.categoryCode || d.category || 'TRANSMITTAL') === category).length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  لا توجد تخصصات تحت هذا القسم بعد. أضف تخصصاً من صفحة الإعدادات.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>المرجع * {loadingRef && <span className="text-xs text-slate-500">(جاري الحساب...)</span>}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="سيتم اقتراحه تلقائياً" className="font-mono" />
              {refInfo && (
                <p className="text-xs text-slate-500">
                  التالي تلقائياً: آخر رقم في القسم = {refInfo.lastGlobalMax} · إجمالي {refInfo.totalAllDisciplines} في هذا القسم
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Other fields (only show after discipline is selected) */}
        {discipline && (
          <>
            <div className="space-y-1.5">
              <Label>النوع</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SHOP DRAWINGS">رسم تنفيذي (Shop Drawings)</SelectItem>
              <SelectItem value="SAMPLE">عينة (Sample)</SelectItem>
              <SelectItem value="SOURCE APPROVAL">اعتماد مصدر (Source Approval)</SelectItem>
              <SelectItem value="COMPANY PROFILE">ملف شركة (Company Profile)</SelectItem>
              <SelectItem value="TEST REPORT">تقرير اختبار (Test Report)</SelectItem>
              <SelectItem value="SUBMITTAL">طلب اعتماد (Submittal)</SelectItem>
              <SelectItem value="MATERIAL APPROVAL">اعتماد مادة (Material Approval)</SelectItem>
              <SelectItem value="METHOD STATEMENT">طريقة تنفيذ (Method Statement)</SelectItem>
              <SelectItem value="CALCULATION">حسابات (Calculation)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>الوصف</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="مثال: Excavation Plan & Excavation Section" />
        </div>

        <div className="space-y-1.5">
          <Label>تاريخ إرسال REV.0</Label>
          <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} />
        </div>
          </>
        )}
      </CardContent></Card>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => onDownloadTemplate(reference, discipline, description)} disabled={!reference}>
          <Download className="w-4 h-4" /> تنزيل ملف Excel جاهز
        </Button>
        <Button onClick={handleCreate} disabled={saving || !reference || !discipline} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
          <Plus className="w-4 h-4" /> {saving ? 'جاري الإنشاء...' : 'إنشاء الترانسميتال'}
        </Button>
      </div>

      {refInfo && refInfo.recentAllDisciplines.length > 0 && (
        <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">آخر 5 مراجع مُنشأة:</p>
          <div className="flex flex-wrap gap-2">
            {refInfo.recentAllDisciplines.map((r, i) => (
              <Badge key={i} variant="outline" className="font-mono">{r}</Badge>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

/* ============ IMPORT VIEW ============ */
function ImportView({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!file) return;
    setImporting(true); setResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/import', { method: 'POST', body: fd });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الاستيراد'); }
      const data = await r.json();
      setResult(data);
      toast({ title: 'تم الاستيراد بنجاح', description: `تم استيراد ${data.imported} سجل، تخطّي ${data.skipped}` });
    } catch (e: any) { toast({ title: 'فشل الاستيراد', description: e.message, variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">استيراد البيانات من Excel</h2>
        <p className="text-sm text-slate-500 mt-1">ارفع ملف LOG_Final.xlsm لاستيراد كل الترانسميتالات. سيتم تخطّي الصفوف بدون وصف.</p>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>الملف (LOG_Final.xlsm)</Label>
          <Input type="file" accept=".xlsm,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-900"><strong>⚠️ تنبيه:</strong> سيتم حذف كل البيانات الحالية في قاعدة البيانات واستبدالها بالبيانات الجديدة.</p>
        </div>
        <Button onClick={handleImport} disabled={!file || importing} className="w-full bg-emerald-700 hover:bg-emerald-800 gap-1.5">
          {importing ? (<><RefreshCw className="w-4 h-4 animate-spin" /> جاري الاستيراد... قد يستغرق دقيقة</>) : (<><Upload className="w-4 h-4" /> بدء الاستيراد</>)}
        </Button>
      </CardContent></Card>

      {result && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader><CardTitle className="text-lg text-emerald-800">نتيجة الاستيراد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-3xl font-bold text-emerald-700">{result.imported}</p><p className="text-xs text-slate-600">مستورد</p></div>
              <div><p className="text-3xl font-bold text-slate-600">{result.skipped}</p><p className="text-xs text-slate-600">متخطّى (فارغ)</p></div>
              <div><p className="text-3xl font-bold text-slate-600">{result.totalExtracted}</p><p className="text-xs text-slate-600">إجمالي مستخرج</p></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 max-h-32 overflow-y-auto">
                <p className="font-semibold mb-1">أخطاء:</p>
                <ul className="list-disc list-inside space-y-0.5">{result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <Button onClick={onDone} className="w-full bg-emerald-700 hover:bg-emerald-800">عرض لوحة المعلومات</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============ REPORTS VIEW (Horizontal Timeline) ============ */
type TimelineItem = {
  id: string;
  reference: string;
  discipline: string;
  category: string;
  type: string | null;
  description: string | null;
  consultantStatus: string | null;
  mohStatus: string | null;
  mohSubmitDate: string | null;
  mohSubmitRev: number | null;
  mohReviewDate: string | null;
  revisions: Record<number, {
    submitDate: string | null;
    replyDate: string | null;
    action: string | null;
    approvalType?: string | null;
    daysOpen: number | null;
  }>;
  revisionsCount: number;
  lastSubmitDate: string | null;
  lastReplyDate: string | null;
  totalDays: number;
};

function ReportsView({ disciplines, categories, onOpenDetail }: {
  disciplines: Discipline[];
  categories: Category[];
  onOpenDetail: (id: string) => void;
}) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDiscipline, setFilterDiscipline] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/types').then(r => r.json()).then(d => setTypes(d.items || [])).catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterDiscipline !== 'all') params.set('discipline', filterDiscipline);
      if (search) params.set('q', search);
      if (filterType !== 'all') params.set('type', filterType);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const r = await fetch(`/api/reports/timeline?${params}`);
      if (!r.ok) throw new Error('فشل تحميل التقرير');
      const data = await r.json();
      setItems(data.items);
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterDiscipline, search, filterType, dateFrom, dateTo, toast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportExcel = async () => {
    const params = new URLSearchParams();
    if (filterCategory !== 'all') params.set('category', filterCategory);
    if (filterDiscipline !== 'all') params.set('discipline', filterDiscipline);
    if (search) params.set('q', search);
    if (filterType !== 'all') params.set('type', filterType);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    params.set('_', String(Date.now())); // cache-buster
    toast({ title: 'جاري توليد التقرير', description: 'سيتم تنزيل ملف Excel خلال لحظات' });
    try {
      const res = await fetch(`/api/reports/export?${params}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `فشل التوليد (${res.status})`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `Transmittals-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    } catch (e: any) {
      toast({ title: 'خطأ في التنزيل', description: e.message, variant: 'destructive' });
    }
  };

  const availableDisciplines = filterCategory !== 'all'
    ? disciplines.filter(d => (d.categoryCode || d.category || 'TRANSMITTAL') === filterCategory)
    : disciplines;

  // Compute the maximum rev number across all visible items.
  // The table will only show columns REV.0..REV.{maxRev} (dynamic — grows when more revs are added).
  // Default to REV.0 (so the table shows at least one column even when no revs exist yet).
  const maxRevNumber = items.reduce((max, item) => {
    const revKeys = Object.keys(item.revisions || {}).map(k => parseInt(k, 10)).filter(k => !isNaN(k));
    const itemMax = revKeys.length > 0 ? Math.max(...revKeys) : 0;
    return Math.max(max, itemMax);
  }, 0);
  const revColumns = Array.from({ length: maxRevNumber + 1 }, (_, i) => i); // [0, 1, 2, ..., maxRevNumber]

  const actionLabel = (a: string | null, approvalType?: string | null) => {
    if (!a) return '—';
    const s = a.toLowerCase().trim();
    if (s === 'approved') {
      if (approvalType) {
        const letter = getApprovalTypeLetter(approvalType);
        return letter || '✅';
      }
      return '✅'; // old data without approvalType — just show checkmark
    }
    if (s === 'rejected') return '❌';
    if (s === 'withdrawn') return '🚫';
    if (s === 'pending') return '⏳'; // backward compat with old imported data
    return a;
  };

  const actionColor = (a: string | null, approvalType?: string | null) => {
    if (!a) return 'text-slate-400';
    const s = a.toLowerCase().trim();
    if (s === 'approved') {
      if (approvalType === 'NOT_APPROVED') return 'text-red-700 bg-red-50';
      if (approvalType === 'FOR_INFORMATION') return 'text-orange-700 bg-orange-50';
      if (approvalType === 'APPROVED_AS_NOTED_RESUBMIT') return 'text-orange-700 bg-orange-50';
      return 'text-emerald-700 bg-emerald-50';
    }
    if (s === 'rejected') return 'text-red-700 bg-red-50';
    if (s === 'withdrawn') return 'text-gray-700 bg-gray-100';
    if (s === 'pending') return 'text-yellow-700 bg-yellow-50'; // backward compat
    return 'text-slate-700';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">تقارير الجدول الزمني</h2>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} ترانسميتال · {revColumns.length} مراجعة (REV.0 - REV.{maxRevNumber}) · كل ريفجن في جدول منفصل بفواصل رأسية
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" /> طباعة
          </Button>
          <Button size="sm" onClick={handleExportExcel} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <FileDown className="w-4 h-4" /> تنزيل Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">بحث</Label>
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="مرجع أو وصف..." className="pr-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">القسم الرئيسي</Label>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setFilterDiscipline('all'); }}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {categories.map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">التخصص</Label>
            <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {availableDisciplines.map(d => <SelectItem key={d.code} value={d.code}>{d.label} ({d.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">النوع</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </CardContent></Card>

      {/* Horizontal Timeline Table — each REV group is visually separated by thick vertical borders
          so each REV looks like its own standalone table within the same row */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading && items.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد بيانات مطابقة للفلاتر</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="border-collapse">
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="text-right sticky right-0 bg-white z-20 min-w-[120px] border-l-2 border-slate-300">المرجع</TableHead>
                    <TableHead className="text-right min-w-[180px] border-l-2 border-slate-300">الوصف</TableHead>
                    {revColumns.map((rev, revIdx) => (
                      <TableHead
                        key={rev}
                        className={`text-center min-w-[260px] p-0 border-l-4 ${revIdx === 0 ? 'border-l-2 border-slate-400' : 'border-l-4 border-blue-500'}`}
                      >
                        {/* REV group header — colored band on top */}
                        <div className="bg-blue-700 text-white py-1.5 px-2 font-bold text-sm">REV.{rev}</div>
                        <div className="flex text-xs font-normal mt-0 bg-blue-50">
                          <div className="flex-1 py-1 border-l border-blue-200">تقديم</div>
                          <div className="flex-1 py-1 border-l border-blue-200">رد</div>
                          <div className="flex-1 py-1 border-l border-blue-200">إجراء</div>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[100px] border-l-4 border-emerald-500 bg-emerald-50">الاستشاري</TableHead>
                    <TableHead className="text-center min-w-[100px] border-l-2 border-purple-500 bg-purple-50">الوزارة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell className="font-mono font-semibold whitespace-nowrap sticky right-0 bg-white z-10 border-l-2 border-slate-300">
                        {item.reference || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 max-w-[200px] truncate border-l-2 border-slate-300">
                        {item.description || '—'}
                      </TableCell>
                      {revColumns.map((rev, revIdx) => {
                        const r = item.revisions[rev];
                        if (!r || (!r.submitDate && !r.action)) {
                          return (
                            <TableCell key={rev} className={`p-0 border-l-4 ${revIdx === 0 ? 'border-l-2 border-slate-400' : 'border-l-4 border-blue-500'}`}>
                              <div className="flex text-xs min-h-[44px] items-center">
                                <div className="flex-1 p-2 border-l border-slate-200 text-center text-slate-300">—</div>
                                <div className="flex-1 p-2 border-l border-slate-200 text-center text-slate-300">—</div>
                                <div className="flex-1 p-2 border-l border-slate-200 text-center text-slate-300">—</div>
                              </div>
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={rev} className={`p-0 border-l-4 ${revIdx === 0 ? 'border-l-2 border-slate-400' : 'border-l-4 border-blue-500'}`}>
                            <div className="flex text-xs min-h-[44px]">
                              <div className="flex-1 p-2 border-l border-slate-200 text-center">
                                {r.submitDate ? (
                                  <div>
                                    <div className="font-medium text-slate-700">{fmtDate(r.submitDate)}</div>
                                    {r.daysOpen !== null && (
                                      <div className={`text-[10px] mt-0.5 font-semibold ${r.daysOpen > 30 ? 'text-red-700' : r.daysOpen > 14 ? 'text-yellow-700' : 'text-emerald-700'}`}>
                                        {r.daysOpen}ي
                                      </div>
                                    )}
                                  </div>
                                ) : <span className="text-slate-300">—</span>}
                              </div>
                              <div className="flex-1 p-2 border-l border-slate-200 text-center">
                                {r.replyDate ? (
                                  <div className="font-medium text-slate-700">{fmtDate(r.replyDate)}</div>
                                ) : <span className="text-slate-300">—</span>}
                              </div>
                              <div className={`flex-1 p-2 border-l border-slate-200 text-center font-bold ${actionColor(r.action, r.approvalType)}`}>
                                {actionLabel(r.action, r.approvalType)}
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-xs border-l-4 border-emerald-500 bg-emerald-50/30">
                        {item.consultantStatus ? (
                          <Badge variant="outline" className="text-[10px]">
                            {item.consultantStatus === 'Approved' ? '✅' :
                             item.consultantStatus === 'Overdue' ? '🔴' :
                             item.consultantStatus === 'Under Review' ? '⏳' :
                             item.consultantStatus === 'Cancelled' ? '🚫' : item.consultantStatus}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center text-xs border-l-2 border-purple-500 bg-purple-50/30">
                        {item.mohStatus ? (
                          <div>
                            <Badge variant="outline" className="text-[10px]">
                              {item.mohStatus === 'Approved' ? '✅' :
                               item.mohStatus === 'Under Review' ? '⏳' :
                               item.mohStatus === 'Overdue' ? '🔴' :
                               item.mohStatus === 'Rejected' ? '❌' : item.mohStatus}
                            </Badge>
                            {item.mohSubmitDate && (
                              <div className="text-[10px] text-slate-500 mt-1">{fmtDate(item.mohSubmitDate)}</div>
                            )}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold">دليل الألوان والإجراءات:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-50 border border-emerald-300 inline-block"></span> A: APPROVED</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-50 border border-emerald-300 inline-block"></span> B: APPROVED AS NOTED</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-50 border border-orange-300 inline-block"></span> C: APPROVED AS NOTED & RESUBMIT</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-300 inline-block"></span> D: NOT APPROVED</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-50 border border-orange-300 inline-block"></span> E: FOR INFORMATION</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-300 inline-block"></span> ❌ مرفوض</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 border border-gray-300 inline-block"></span> 🚫 مسحوب</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">Xي = عدد الأيام من التقديم حتى الرد</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">إجمالي الأيام: مجموع كل الفترات (أخضر &lt;14ي · أصفر 14-30ي · أحمر &gt;30ي)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ SETTINGS VIEW ============ */
function SettingsView({ disciplines, categories, docTypes, onRefreshDisciplines, onRefreshCategories, onRefreshDocTypes }: {
  disciplines: Discipline[];
  categories: Category[];
  docTypes: { id: string; code: string; label: string; transmittalsCount?: number }[];
  onRefreshDisciplines: () => void;
  onRefreshCategories: () => void;
  onRefreshDocTypes: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editing, setEditing] = useState<Discipline | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  // Always fetch fresh data when SettingsView mounts
  useEffect(() => {
    onRefreshDisciplines();
    onRefreshCategories();
  }, []);

  const handleDelete = async (code: string) => {
    if (!confirm(`هل أنت متأكد من حذف القسم ${code}؟`)) return;
    try {
      const r = await fetch(`/api/disciplines/${code}`, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الحذف'); }
      toast({ title: 'تم حذف القسم', description: code });
      onRefreshDisciplines();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteCategory = async (code: string) => {
    if (!confirm(`هل أنت متأكد من حذف القسم الرئيسي ${code}؟`)) return;
    try {
      const r = await fetch(`/api/categories/${code}`, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الحذف'); }
      toast({ title: 'تم حذف القسم الرئيسي', description: code });
      onRefreshCategories();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteDocType = async (id: string, code: string) => {
    if (!confirm(`هل أنت متأكد من حذف النوع ${code}؟`)) return;
    try {
      const r = await fetch(`/api/doc-types/${id}`, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الحذف'); }
      toast({ title: 'تم حذف النوع', description: code });
      onRefreshDocTypes();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">إعدادات الأقسام</h2>
          <p className="text-sm text-slate-500 mt-1">الأقسام الرئيسية والتخصصات الفرعية تحتها</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddCategory(true)} variant="outline" className="gap-1.5">
            <FolderPlus className="w-4 h-4" /> إضافة قسم رئيسي
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Plus className="w-4 h-4" /> إضافة تخصص
          </Button>
        </div>
      </div>

      {/* Categories Management Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Folder className="w-5 h-5" /> الأقسام الرئيسية ({categories.length})
          </CardTitle>
          <CardDescription>الأقسام الرئيسية القابلة للإضافة (ترانسميتال، MIR، RFI، كتب، وأي قسم آخر)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">الأيقونة</TableHead>
              <TableHead className="text-right">الكود</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-center">عدد التخصصات</TableHead>
              <TableHead className="text-center">عدد الترانسميتالات</TableHead>
              <TableHead className="text-center">اللون</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="text-2xl">{c.icon}</TableCell>
                  <TableCell className="font-mono font-bold">{c.code}</TableCell>
                  <TableCell>{c.label}</TableCell>
                  <TableCell className="text-center font-semibold">{c.disciplinesCount || 0}</TableCell>
                  <TableCell className="text-center font-semibold">{c.transmittalsCount || 0}</TableCell>
                  <TableCell className="text-center"><div className={`inline-block px-2 py-1 rounded text-xs ${c.color}`}>عينة</div></TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingCategory(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(c.code)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Types Management Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5" /> أنواع المستندات ({docTypes.length})
          </CardTitle>
          <CardDescription>الأنواع المستخدمة في تصنيف الترانسميتالات (Shop Drawings, Sample, ...)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">الكود</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-center">عدد الترانسميتالات</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docTypes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-bold">{t.code}</TableCell>
                  <TableCell>{t.label}</TableCell>
                  <TableCell className="text-center font-semibold">{t.transmittalsCount || 0}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDocType(t.id, t.code)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold text-slate-700 pt-2">التخصصات الفرعية حسب القسم الرئيسي</h3>

      {/* Render disciplines grouped by category */}
      {categories.map((cat) => {
        const catDisciplines = disciplines.filter(d => (d.categoryCode || d.category || 'TRANSMITTAL') === cat.code);
        if (catDisciplines.length === 0) return null;
        return (
          <Card key={cat.code} className="border-0 shadow-sm">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">{cat.icon}</span>
                <Badge className={`${cat.color} border-0`}>{cat.label}</Badge>
                <span className="text-xs text-slate-500">({catDisciplines.length} تخصص)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">البادئة</TableHead>
                  <TableHead className="text-center">اللون</TableHead>
                  <TableHead className="text-center">عدد الترانسميتالات</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {catDisciplines.map((d) => (
                    <TableRow key={d.code}>
                      <TableCell className="font-mono font-bold">{d.code}</TableCell>
                      <TableCell>{d.label}</TableCell>
                      <TableCell className="font-mono text-sm">{d.prefix}</TableCell>
                      <TableCell className="text-center"><div className={`inline-block px-2 py-1 rounded text-xs ${d.color}`}>عينة</div></TableCell>
                      <TableCell className="text-center font-semibold">{d.transmittalsCount || 0}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(d)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(d.code)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Empty categories hint */}
      {(() => {
        const emptyCats = categories.filter(cat => disciplines.filter(d => (d.categoryCode || d.category || 'TRANSMITTAL') === cat.code).length === 0);
        if (emptyCats.length === 0) return null;
        return (
          <Card className="bg-slate-50 border-slate-200"><CardContent className="p-4">
            <p className="text-sm text-slate-700 mb-2"><strong>أقسام رئيسية بدون تخصصات بعد:</strong></p>
            <div className="flex flex-wrap gap-2">
              {emptyCats.map(c => (
                <Badge key={c.code} variant="outline" className="text-sm">{c.icon} {c.label}</Badge>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">أضف تخصصاً جديداً واختر القسم المناسب له.</p>
          </CardContent></Card>
        );
      })()}

      <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4">
        <p className="text-sm text-blue-900">
          <strong>💡 ملاحظات:</strong><br />
          • الأقسام الرئيسية: ترانسميتال، MIR، RFI، كتب — قابلة للإضافة والحذف<br />
          • كل قسم رئيسي له تسلسل ترقيم مستقل خاص به<br />
          • البادئة تُستخدم في تكوين رقم المرجع (مثال: <code className="bg-white px-1 rounded">CIV-</code> + <code className="bg-white px-1 rounded">171</code> = <code className="bg-white px-1 rounded">CIV-171</code>)<br />
          • لا يمكن حذف قسم مرتبط بترانسميتالات (احذف الترانسميتالات أولاً)
        </p>
      </CardContent></Card>

      <AddDisciplineDialog open={showAdd} onOpenChange={setShowAdd} onSaved={() => { setShowAdd(false); onRefreshDisciplines(); }} categories={categories} />
      <AddCategoryDialog open={showAddCategory} onOpenChange={setShowAddCategory} onSaved={() => { setShowAddCategory(false); onRefreshCategories(); }} />
      {editingCategory && <EditCategoryDialog category={editingCategory} onOpenChange={(v) => !v && setEditingCategory(null)} onSaved={() => { setEditingCategory(null); onRefreshCategories(); }} />}
      {editing && <EditDisciplineDialog discipline={editing} onOpenChange={(v) => !v && setEditing(null)} onSaved={() => { setEditing(null); onRefreshDisciplines(); }} categories={categories} />}
    </div>
  );
}

function AddDisciplineDialog({ open, onOpenChange, onSaved, categories }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; categories?: Category[] }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [prefix, setPrefix] = useState('');
  const [color, setColor] = useState('bg-gray-100 text-gray-700');
  const [category, setCategory] = useState('TRANSMITTAL');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setCode(''); setLabel(''); setPrefix(''); setColor('bg-gray-100 text-gray-700'); setCategory('TRANSMITTAL'); }
  }, [open]);

  const colorOptions = [
    { value: 'bg-gray-100 text-gray-700', label: 'رمادي' },
    { value: 'bg-amber-100 text-amber-700', label: 'كهرماني' },
    { value: 'bg-purple-100 text-purple-700', label: 'بنفسجي' },
    { value: 'bg-cyan-100 text-cyan-700', label: 'سماوي' },
    { value: 'bg-rose-100 text-rose-700', label: 'وردي' },
    { value: 'bg-red-100 text-red-700', label: 'أحمر' },
    { value: 'bg-emerald-100 text-emerald-700', label: 'أخضر' },
    { value: 'bg-blue-100 text-blue-700', label: 'أزرق' },
    { value: 'bg-indigo-100 text-indigo-700', label: 'نيلي' },
    { value: 'bg-orange-100 text-orange-700', label: 'برتقالي' },
  ];

  const handleSave = async () => {
    if (!code || !label || !prefix) {
      toast({ title: 'خطأ', description: 'كل الحقول مطلوبة', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/disciplines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), label, prefix, color, category }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الحفظ'); }
      toast({ title: 'تم إضافة القسم', description: `${code.toUpperCase()} - ${label} (${getCategoryLabel(category)})` });
      onSaved();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  // Auto-suggest prefix based on code
  useEffect(() => {
    if (code && !prefix) {
      setPrefix(`${code.toUpperCase()}-`);
    }
  }, [code, prefix]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة قسم جديد</DialogTitle>
          <DialogDescription>أضف تخصصاً جديداً تحت أحد الأقسام الرئيسية</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">القسم الرئيسي *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categories || CATEGORIES).map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">الكود *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="مثال: ELV" className="font-mono" maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">الاسم (عربي) *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: المصاعد" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">البادئة * (تُستخدم في رقم المرجع)</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="مثال: ELV-" className="font-mono" />
            <p className="text-xs text-slate-500">مثال: <code className="bg-slate-100 px-1 rounded">{prefix || 'CIV-'}171</code></p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">اللون</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className={`inline-block px-3 py-1.5 rounded text-sm mt-1 ${color}`}>معاينة اللون</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDisciplineDialog({ discipline, onOpenChange, onSaved, categories }: { discipline: Discipline; onOpenChange: (v: boolean) => void; onSaved: () => void; categories?: Category[] }) {
  const [label, setLabel] = useState(discipline.label);
  const [prefix, setPrefix] = useState(discipline.prefix);
  const [color, setColor] = useState(discipline.color);
  const [category, setCategory] = useState(discipline.category || 'TRANSMITTAL');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const colorOptions = [
    { value: 'bg-gray-100 text-gray-700', label: 'رمادي' },
    { value: 'bg-amber-100 text-amber-700', label: 'كهرماني' },
    { value: 'bg-purple-100 text-purple-700', label: 'بنفسجي' },
    { value: 'bg-cyan-100 text-cyan-700', label: 'سماوي' },
    { value: 'bg-rose-100 text-rose-700', label: 'وردي' },
    { value: 'bg-red-100 text-red-700', label: 'أحمر' },
    { value: 'bg-emerald-100 text-emerald-700', label: 'أخضر' },
    { value: 'bg-blue-100 text-blue-700', label: 'أزرق' },
    { value: 'bg-indigo-100 text-indigo-700', label: 'نيلي' },
    { value: 'bg-orange-100 text-orange-700', label: 'برتقالي' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/disciplines/${discipline.code}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, prefix, color, category }),
      });
      if (!r.ok) throw new Error('فشل الحفظ');
      toast({ title: 'تم تحديث القسم', description: `${discipline.code} (${getCategoryLabel(category)})` });
      onSaved();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل القسم: {discipline.code}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">القسم الرئيسي</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categories || CATEGORIES).map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">الاسم (عربي)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">البادئة</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">اللون</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ============ SEND TO MOH DIALOG ============ */
function SendToMohDialog({ target, onClose, onConfirm }: {
  target: { id: string; reference: string; latestRev: number };
  onClose: () => void;
  onConfirm: (submitDate: string, submitRev: number, notes: string) => void;
}) {
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitRev, setSubmitRev] = useState<number>(target.latestRev);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!submitDate) return;
    setSaving(true);
    await onConfirm(submitDate, submitRev, notes);
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-700" />
            إرسال للوزارة - {target.reference}
          </DialogTitle>
          <DialogDescription>
            أدخل تاريخ الإرسال لوزارة الصحة. سيتم إرسال آخر مراجعة (REV.{target.latestRev}) تلقائياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            <p className="text-sm text-blue-900">
              <strong>المرجع:</strong> <span className="font-mono">{target.reference}</span>
            </p>
            <p className="text-sm text-blue-900">
              <strong>المراجعة المُرسلة (تلقائي - آخر ريفجن):</strong> REV.{target.latestRev}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">تاريخ الإرسال للوزارة *</Label>
            <Input
              type="date"
              value={submitDate}
              onChange={(e) => setSubmitDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="ملاحظات حول الإرسال..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !submitDate}
            className="bg-blue-700 hover:bg-blue-800 gap-1.5"
          >
            <Send className="w-4 h-4" />
            {saving ? 'جاري الإرسال...' : `إرسال REV.${target.latestRev} للوزارة`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ ADD CATEGORY DIALOG ============ */
function AddCategoryDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('📄');
  const [color, setColor] = useState('bg-blue-100 text-blue-700');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setCode(''); setLabel(''); setIcon('📄'); setColor('bg-blue-100 text-blue-700'); }
  }, [open]);

  const iconOptions = ['📄', '🔍', '❓', '📚', '📋', '📝', '🏗️', '⚡', '🔥', '💧', '❄️', '📡', '🚪', '🛡️', '🔧', '📦'];
  const colorOptions = [
    { value: 'bg-blue-100 text-blue-700', label: 'أزرق' },
    { value: 'bg-orange-100 text-orange-700', label: 'برتقالي' },
    { value: 'bg-purple-100 text-purple-700', label: 'بنفسجي' },
    { value: 'bg-emerald-100 text-emerald-700', label: 'أخضر' },
    { value: 'bg-red-100 text-red-700', label: 'أحمر' },
    { value: 'bg-amber-100 text-amber-700', label: 'كهرماني' },
    { value: 'bg-cyan-100 text-cyan-700', label: 'سماوي' },
    { value: 'bg-rose-100 text-rose-700', label: 'وردي' },
    { value: 'bg-indigo-100 text-indigo-700', label: 'نيلي' },
    { value: 'bg-gray-100 text-gray-700', label: 'رمادي' },
  ];

  const handleSave = async () => {
    if (!code || !label) {
      toast({ title: 'خطأ', description: 'الكود والاسم مطلوبان', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), label, icon, color }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'فشل الحفظ'); }
      toast({ title: 'تم إضافة القسم الرئيسي', description: `${code.toUpperCase()} - ${label}` });
      onSaved();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة قسم رئيسي جديد</DialogTitle>
          <DialogDescription>أضف قسماً رئيسياً جديداً (مثل: Method Statements، Calculations، إلخ)</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">الكود *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="مثال: MS" className="font-mono" maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">الاسم *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: Method Statements" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">الأيقونة</Label>
            <div className="flex flex-wrap gap-1">
              {iconOptions.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 ${icon === i ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">اللون</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className={`inline-block px-3 py-1.5 rounded text-sm mt-1 ${color}`}>{icon} معاينة</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ EDIT CATEGORY DIALOG ============ */
function EditCategoryDialog({ category, onOpenChange, onSaved }: { category: Category; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [label, setLabel] = useState(category.label);
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const iconOptions = ['📄', '🔍', '❓', '📚', '📋', '📝', '🏗️', '⚡', '🔥', '💧', '❄️', '📡', '🚪', '🛡️', '🔧', '📦'];
  const colorOptions = [
    { value: 'bg-blue-100 text-blue-700', label: 'أزرق' },
    { value: 'bg-orange-100 text-orange-700', label: 'برتقالي' },
    { value: 'bg-purple-100 text-purple-700', label: 'بنفسجي' },
    { value: 'bg-emerald-100 text-emerald-700', label: 'أخضر' },
    { value: 'bg-red-100 text-red-700', label: 'أحمر' },
    { value: 'bg-amber-100 text-amber-700', label: 'كهرماني' },
    { value: 'bg-cyan-100 text-cyan-700', label: 'سماوي' },
    { value: 'bg-rose-100 text-rose-700', label: 'وردي' },
    { value: 'bg-indigo-100 text-indigo-700', label: 'نيلي' },
    { value: 'bg-gray-100 text-gray-700', label: 'رمادي' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/categories/${category.code}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, icon, color }),
      });
      if (!r.ok) throw new Error('فشل الحفظ');
      toast({ title: 'تم تحديث القسم الرئيسي', description: category.code });
      onSaved();
    } catch (e: any) { toast({ title: 'خطأ', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل القسم الرئيسي: {category.code}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">الاسم</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">الأيقونة</Label>
            <div className="flex flex-wrap gap-1">
              {iconOptions.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 ${icon === i ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">اللون</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ REGISTER REVISION DIALOG ============ */
function RegisterRevisionDialog({ target, onClose, onConfirm }: {
  target: { id: string; reference: string; nextRev: number };
  onClose: () => void;
  onConfirm: (submitDate: string, replyDate: string, action: string, approvalType: string, notes: string) => void;
}) {
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));
  const [replyDate, setReplyDate] = useState('');
  const [action, setAction] = useState('');
  const [approvalType, setApprovalType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(submitDate, replyDate, action, approvalType, notes);
    setSaving(false);
  };

  // When action changes, reset approvalType if not "approved"
  const handleActionChange = (v: string) => {
    setAction(v);
    if (v !== 'approved') setApprovalType('');
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-700" />
            تسجيل ريفجن جديد - {target.reference}
          </DialogTitle>
          <DialogDescription>
            سيتم إنشاء مراجعة جديدة REV.{target.nextRev} (آخر رقم + 1). أدخل تاريخ الإرسال والرد والإجراء.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>المرجع:</strong> <span className="font-mono">{target.reference}</span> ·
              <strong> المراجعة الجديدة:</strong> REV.{target.nextRev}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ الإرسال *</Label>
              <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ الرد (اختياري)</Label>
              <Input type="date" value={replyDate} onChange={(e) => setReplyDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">الإجراء</Label>
            <Select value={action} onValueChange={handleActionChange}>
              <SelectTrigger><SelectValue placeholder="اختر الإجراء" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">✅ مقبول</SelectItem>
                <SelectItem value="rejected">❌ مرفوض</SelectItem>
                <SelectItem value="withdrawn">🚫 مسحوب</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Approval type sub-dropdown — only visible when action=approved */}
          {action === 'approved' && (
            <div className="space-y-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-emerald-800">نوع القبول *</Label>
              <Select value={approvalType} onValueChange={setApprovalType}>
                <SelectTrigger className="!w-full !h-auto !min-h-[36px] !whitespace-normal !break-words text-left [&_[data-slot=select-value]]:!line-clamp-none [&_[data-slot=select-value]]:!whitespace-normal [&_[data-slot=select-value]]:!break-words"><SelectValue placeholder="اختر نوع القبول" className="whitespace-normal break-words leading-snug" /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map(at => (
                    <SelectItem key={at.code} value={at.code} className="whitespace-normal break-words leading-snug py-2">
                      <span className="font-bold">({at.letter})</span> {at.label}
                      <br />
                      <span className="text-xs text-slate-500">{at.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات حول المراجعة..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConfirm} disabled={saving || !submitDate || (action === 'approved' && !approvalType)} className="bg-blue-700 hover:bg-blue-800 gap-1.5">
            <History className="w-4 h-4" />
            {saving ? 'جاري التسجيل...' : `تسجيل REV.${target.nextRev}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ CONSULTANT REPLY DIALOG ============ */
function ConsultantReplyDialog({ target, onClose, onConfirm }: {
  target: { id: string; reference: string };
  onClose: () => void;
  onConfirm: (replyDate: string, action: string, approvalType: string, notes: string) => void;
}) {
  const [replyDate, setReplyDate] = useState(new Date().toISOString().slice(0, 10));
  const [action, setAction] = useState('');
  const [approvalType, setApprovalType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!replyDate || !action) return;
    if (action === 'approved' && !approvalType) return;
    setSaving(true);
    await onConfirm(replyDate, action, approvalType, notes);
    setSaving(false);
  };

  const handleActionChange = (v: string) => {
    setAction(v);
    if (v !== 'approved') setApprovalType('');
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-700" />
            تسجيل رد الاستشاري - {target.reference}
          </DialogTitle>
          <DialogDescription>
            سيتم تحديث آخر ريفجن بتاريخ الرد والإجراء، وتحديث حالة الاستشاري.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm text-emerald-900">
              <strong>المرجع:</strong> <span className="font-mono">{target.reference}</span> ·
              سيتم تحديث آخر ريفجن تلقائياً
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ الرد *</Label>
              <Input type="date" value={replyDate} onChange={(e) => setReplyDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">الإجراء *</Label>
              <Select value={action} onValueChange={handleActionChange}>
                <SelectTrigger><SelectValue placeholder="اختر الإجراء" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✅ مقبول</SelectItem>
                  <SelectItem value="rejected">❌ مرفوض</SelectItem>
                  <SelectItem value="withdrawn">🚫 مسحوب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Approval type sub-dropdown — only visible when action=approved */}
          {action === 'approved' && (
            <div className="space-y-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-emerald-800">نوع القبول *</Label>
              <Select value={approvalType} onValueChange={setApprovalType}>
                <SelectTrigger className="!w-full !h-auto !min-h-[36px] !whitespace-normal !break-words text-left [&_[data-slot=select-value]]:!line-clamp-none [&_[data-slot=select-value]]:!whitespace-normal [&_[data-slot=select-value]]:!break-words"><SelectValue placeholder="اختر نوع القبول" className="whitespace-normal break-words leading-snug" /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map(at => (
                    <SelectItem key={at.code} value={at.code} className="whitespace-normal break-words leading-snug py-2">
                      <span className="font-bold">({at.letter})</span> {at.label}
                      <br />
                      <span className="text-xs text-slate-500">{at.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات الاستشاري..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConfirm} disabled={saving || !replyDate || !action || (action === 'approved' && !approvalType)} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Building2 className="w-4 h-4" />
            {saving ? 'جاري التسجيل...' : 'تسجيل الرد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ MOH REPLY DIALOG ============ */
function MohReplyDialog({ target, onClose, onConfirm }: {
  target: { id: string; reference: string };
  onClose: () => void;
  onConfirm: (reviewDate: string, status: string, notes: string) => void;
}) {
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!reviewDate || !status) return;
    setSaving(true);
    await onConfirm(reviewDate, status, notes);
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-purple-700" />
            تسجيل رد وزارة الصحة - {target.reference}
          </DialogTitle>
          <DialogDescription>
            سيتم تحديث حالة المراجعة عند الوزارة بتاريخ الرد والحالة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-900">
              <strong>المرجع:</strong> <span className="font-mono">{target.reference}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">تاريخ رد الوزارة *</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">حالة الرد *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="اختر الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">✅ معتمد</SelectItem>
                  <SelectItem value="Rejected">❌ مرفوض</SelectItem>
                  <SelectItem value="Under Review">⏳ قيد المراجعة</SelectItem>
                  <SelectItem value="Cancelled">🚫 ملغى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات الوزارة..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConfirm} disabled={saving || !reviewDate || !status} className="bg-purple-700 hover:bg-purple-800 gap-1.5">
            <Hospital className="w-4 h-4" />
            {saving ? 'جاري التسجيل...' : 'تسجيل رد الوزارة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ COPY TRANSMITTAL DIALOG (with editable description) ============ */
function CopyTransmittalDialog({ target, onClose, onConfirm }: {
  target: { id: string; reference: string; description: string };
  onClose: () => void;
  onConfirm: (editedDescription: string) => void;
}) {
  const [description, setDescription] = useState(target.description);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(description);
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-emerald-700" />
            نسخ الترانسميتال - {target.reference}
          </DialogTitle>
          <DialogDescription>
            سيتم إنشاء ترانسميتال جديد بنفس البيانات (التخصص، النوع) ورقم تسلسلي جديد تلقائي. يمكنك تعديل الوصف قبل النسخ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm text-emerald-900">
              <strong>المصدر:</strong> <span className="font-mono">{target.reference}</span> ·
              سيتم إنشاء مرجع جديد تلقائياً
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">الوصف (قابل للتعديل)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="عدّل الوصف كما تريد..."
              autoFocus
            />
            <p className="text-xs text-slate-500">يمكنك تعديل الوصف قبل النسخ. سيتم نسخ باقي البيانات كما هي.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConfirm} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Copy className="w-4 h-4" />
            {saving ? 'جاري النسخ...' : 'نسخ برقم جديد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
