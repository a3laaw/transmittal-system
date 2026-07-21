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
  getRevisionColor,
} from '@/lib/status';
import { useI18n, useFmtDate } from '@/lib/i18n/useI18n';
import {
  FileText, Search, Plus, Download, Upload, AlertCircle,
  CheckCircle2, Clock, XCircle, Bell, LayoutDashboard, FileSpreadsheet,
  ArrowLeft, RefreshCw, FilePlus, History, Send, Settings, Building2,
  Trash2, Pencil, Hospital, Building, Copy, MoreVertical, Eye, FileDown,
  FolderPlus, Folder, FolderOpen, BarChart3, Calendar, Printer, Link, ArrowUpDown,
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
  alternativeTitle?: string | null;
  createdAt: string;
  revisionsCount: number;
  lastSubmitDate: string | null;
  lastReplyDate: string | null;
  computedStatus: { status: string; statusKey?: string; label: string; color: string; emoji: string; daysOpen?: number };
  consultantStatus: { status: string; statusKey?: string; label: string; color: string; emoji: string; daysOpen?: number };
  mohStatus: { status: string; statusKey?: string; label: string; color: string; emoji: string; daysOpen?: number };
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
  const { t, lang, toggleLang } = useI18n();
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
  const [sortBy, setSortBy] = useState<'date' | 'reference' | 'discipline' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
      if (!r.ok) throw new Error(t('msg.loadFailed'));
      const d = await r.json();
      setDashboard(d);
      if (d.disciplines && d.disciplines.length > 0) setDisciplines(d.disciplines);
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      const r = await fetch(`/api/transmittals?${params}`);
      if (!r.ok) throw new Error(t('msg.loadListFailed'));
      const data = await r.json();
      setTransmittals(data.items);
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterDiscipline, search, filterStatus, filterType, sortBy, sortOrder, toast]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/transmittals/${id}`);
      if (!r.ok) throw new Error(t('msg.loadDetailsFailed'));
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
      // Add MOH review fields as top-level for easy access in UI (matching list API shape)
      const enrichedDetail = {
        ...d,
        computedStatus: overall,
        consultantStatus,
        mohStatus,
        mohSubmitDate: moh?.submitDate ?? null,
        mohSubmitRev: moh?.submitRev ?? null,
        mohReviewDate: moh?.reviewDate ?? null,
        mohStatusRaw: moh,            // full MOH review object (for EditMohReviewDialog)
        mohNotes: moh?.notes ?? '',   // MOH notes (for EditMohReviewDialog)
      };
      setDetail(enrichedDetail as TransmittalDetail);
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
        throw new Error(err.error || t('msg.sendFailed'));
      }
      const data = await r.json();
      toast({ title: t('msg.sentToMoh'), description: `REV.${data.sentRev} · بتاريخ ${fmtDate(data.sentDate)}` });
      setSendToMohTarget(null);
      if (view === 'detail' && selectedId === id) fetchDetail(id);
      else if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
        throw new Error(err.error || t('msg.copyFailed'));
      }
      const data = await r.json();
      toast({
        title: t('msg.dataCopied'),
        description: `${data.sourceReference} → ${data.newReference}`,
      });
      setCopyTarget(null);
      // Open the new transmittal's detail
      setSelectedId(data.newTransmittal.id);
      setView('detail');
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
        throw new Error(err.error || t('msg.registerRevFailed'));
      }
      const actionLabel = action === 'approved' && approvalType
        ? `${getApprovalTypeLetter(approvalType)} - ${getApprovalTypeLabel(approvalType)}`
        : action || '';
      toast({ title: t('msg.revRegistered'), description: `REV.${nextRev} · ${actionLabel}` });
      setRegisterRevTarget(null);
      if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
      if (!detailR.ok) throw new Error(t('msg.loadTransmittalFailed'));
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
        throw new Error(err.error || t('msg.consultantReplyFailed'));
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
      toast({ title: t('msg.consultantReplyRegistered'), description: `REV.${latestRev} · ${actionLabel}` });
      setConsultantReplyTarget(null);
      if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
        throw new Error(err.error || t('msg.mohReplyFailed'));
      }
      toast({ title: t('msg.mohReplyRegistered'), description: `${status} · ${fmtDate(reviewDate)}` });
      setMohReplyTarget(null);
      if (view === 'list') fetchList();
      else fetchDashboard();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    }
  };

  const handleDownloadExcel = async (reference: string, description: string, category?: string, revNumber?: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const revLabel = revNumber !== undefined ? `Rev.${String(revNumber).padStart(2, '0')}` : '';
    toast({ title: t('msg.generatingExcel'), description: t('msg.willDownload', {ref: revLabel ? `${reference}-${revLabel}` : reference}) });
    const catParam = category ? `&category=${encodeURIComponent(category)}` : '';
    const revParam = revNumber !== undefined ? `&rev=${revNumber}` : '';
    const url = `/api/excel-template?reference=${encodeURIComponent(reference)}&description=${encodeURIComponent(description)}&date=${today}${catParam}${revParam}&_=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('msg.generateFailed', {status: res.status}));
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = revLabel ? `${reference}-${revLabel}.xlsx` : `Transmittal-${reference}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    } catch (e: any) {
      toast({ title: t('msg.downloadError'), description: e.message, variant: 'destructive' });
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
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{t('app.name')}</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Sabah Al Salem South Health Center</p>
              </div>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />} label={t('nav.dashboard')} />
              <NavButton active={view === 'list'} onClick={() => setView('list')} icon={<FileSpreadsheet className="w-4 h-4" />} label={t('nav.list')} />
              <NavButton active={view === 'new'} onClick={() => setView('new')} icon={<FilePlus className="w-4 h-4" />} label={t('nav.new')} />
              <NavButton active={view === 'reports'} onClick={() => setView('reports')} icon={<BarChart3 className="w-4 h-4" />} label={t('nav.reports')} />
              <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings className="w-4 h-4" />} label={t('nav.settings')} />
              <NavButton active={view === 'import'} onClick={() => setView('import')} icon={<Upload className="w-4 h-4" />} label={t('nav.import')} />
            <Button onClick={toggleLang} variant="outline" size="sm" className="gap-1.5 px-3"><span className="text-base">{lang === "ar" ? "🇬🇧" : "🇸🇦"}</span><span className="hidden sm:inline text-xs font-semibold">{lang === "ar" ? "EN" : "ع"}</span></Button>
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
            sortBy={sortBy}
            onSortBy={setSortBy}
            sortOrder={sortOrder}
            onSortOrder={setSortOrder}
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
            onOpenDetail={(id) => { setSelectedId(id); }}
            onRefresh={() => selectedId && fetchDetail(selectedId)}
            onDownloadExcel={async () => {
              const ref = detail.reference;
              const desc = detail.description || '';
              const today = new Date().toISOString().slice(0, 10);
              toast({ title: t('msg.generatingFile'), description: `Transmittal ${ref}` });
              const url = `/api/excel-template?reference=${encodeURIComponent(ref)}&description=${encodeURIComponent(desc)}&date=${today}&_=${Date.now()}`;
              try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || t('msg.generateFailed', {status: res.status}));
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
                toast({ title: t('msg.downloadError'), description: e.message, variant: 'destructive' });
              }
            }}
            onSendToMoh={() => handleSendToMoh(detail.id, detail.reference, detail.revisions.length > 0 ? detail.revisions[detail.revisions.length - 1].revNumber : 0)}
            onCopy={() => handleCopyTransmittal(detail.id, detail.reference, detail.description || '')}
          />
        )}
        {view === 'detail' && !detail && !loading && <div className="text-center py-20 text-slate-500">{t('list.noData')}</div>}
        {view === 'new' && (
          <NewTransmittalView
            disciplines={disciplines}
            categories={categories}
            onCreated={(t) => { toast({ title: t('msg.transmittalCreated'), description: t.reference }); setSelectedId(t.id); setView('detail'); }}
            onDownloadTemplate={async (ref, discipline, desc) => {
              const today = new Date().toISOString().slice(0, 10);
              toast({ title: t('msg.generatingExcel'), description: t('msg.willDownload', {ref: ref}) });
              const url = `/api/excel-template?reference=${encodeURIComponent(ref)}&discipline=${encodeURIComponent(discipline)}&description=${encodeURIComponent(desc)}&date=${today}&_=${Date.now()}`;
              try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || t('msg.generateFailed', {status: res.status}));
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
                toast({ title: t('msg.downloadError'), description: e.message, variant: 'destructive' });
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
          {t('app.footer', {year: new Date().getFullYear()})}
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
  const { t, lang } = useI18n();
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
  const { t, lang } = useI18n();
  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!data) return <div className="text-center py-20 text-slate-500">{t('dashboard.noData')}</div>;

  const kpis = [
    { label: t('common.total'), value: data.kpis.total, color: 'bg-slate-700', icon: <FileText className="w-5 h-5" /> },
    { label: t('status.approved_short'), value: data.kpis.approved, color: 'bg-emerald-600', icon: <CheckCircle2 className="w-5 h-5" /> },
    { label: t('status.pending_short'), value: data.kpis.pending, color: 'bg-yellow-500', icon: <Clock className="w-5 h-5" /> },
    { label: t('status.consultantOverdue'), value: data.kpis.overdue, color: 'bg-red-600', icon: <AlertCircle className="w-5 h-5" /> },
    { label: t('status.resubmit_short'), value: data.kpis.resubmit, color: 'bg-orange-500', icon: <RefreshCw className="w-5 h-5" /> },
    { label: t('status.cancelled_short'), value: data.kpis.cancelled, color: 'bg-gray-500', icon: <XCircle className="w-5 h-5" /> },
  ];
  const mohKpis = [
    { label: t('status.sentToMoh'), value: data.mohKpis.sent, color: 'bg-blue-600', icon: <Send className="w-5 h-5" /> },
    { label: t('status.mohApproved_short'), value: data.mohKpis.approved, color: 'bg-emerald-600', icon: <CheckCircle2 className="w-5 h-5" /> },
    { label: t('status.underReview'), value: data.mohKpis.underReview, color: 'bg-yellow-500', icon: <Clock className="w-5 h-5" /> },
    { label: t('status.mohOverdue'), value: data.mohKpis.overdue, color: 'bg-red-600', icon: <AlertCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}</Button>
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
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hospital className="w-5 h-5 text-blue-700" /> {t('dashboard.mohStatus')}</CardTitle></CardHeader>
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
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Folder className="w-5 h-5" /> {t('dashboard.byCategoryDetail')}</CardTitle>
          <CardDescription>{t('dashboard.byCategoryDesc')}</CardDescription></CardHeader>
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
                    <div className="text-emerald-700">{t('total.approved')}<strong>{cat.approved}</strong></div>
                    <div className="text-yellow-700">{t('total.pending')}<strong>{cat.pending}</strong></div>
                    <div className="text-red-700">{t('total.overdue')}<strong>{cat.overdue}</strong></div>
                    <div className="text-blue-700">{t('total.toMoh')}<strong>{cat.mohSent}</strong></div>
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
        <CardHeader><CardTitle className="text-lg">{t('dashboard.byDisciplineTitle')}</CardTitle>
          <CardDescription>{t('dashboard.byDisciplineDesc')}</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">{t('common.discipline')}</TableHead>
              <TableHead className="text-right">{t('field.mainCategory')}</TableHead>
              <TableHead className="text-center">{t('total.label')}</TableHead>
              <TableHead className="text-center">{t('status.approved')}</TableHead>
              <TableHead className="text-center">{t('status.pending')}</TableHead>
              <TableHead className="text-center">{t('status.overdue')}</TableHead>
              <TableHead className="text-center">{t('status.toMoh')}</TableHead>
              <TableHead className="text-center">{t('status.mohApproved')}</TableHead>
              <TableHead className="text-center">% الإنجاز</TableHead>
              <TableHead className="text-center">{t('reports.lastRef')}</TableHead>
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
          <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-red-800"><AlertCircle className="w-5 h-5" /> {t('dashboard.consultantOverdue', {count: data.consultantOverdueList.length})}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">{t('common.reference')}</TableHead><TableHead className="text-right">{t('common.discipline')}</TableHead>
                <TableHead className="text-right">{t('common.description')}</TableHead><TableHead className="text-center">{t('common.status')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.consultantOverdueList.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-red-50" onClick={() => onOpenDetail(item.id)}>
                    <TableCell className="font-mono font-semibold">{item.reference}</TableCell>
                    <TableCell><Badge variant="secondary" className={getDisciplineColor(item.discipline, disciplines)}>{getDisciplineLabel(item.discipline, disciplines)}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-md truncate">{item.description || '—'}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={item.status.color}>{item.status.emoji} {t(item.status.statusKey || 'status.' + item.status.status, item.status.daysOpen !== undefined ? {days: item.status.daysOpen} : {})}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.mohOverdueList.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-purple-800"><Hospital className="w-5 h-5" /> {t('dashboard.mohOverdueAlerts', {count: data.mohOverdueList.length})}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">{t('common.reference')}</TableHead><TableHead className="text-right">{t('common.discipline')}</TableHead>
                <TableHead className="text-right">{t('common.description')}</TableHead><TableHead className="text-center">{t('common.status')}</TableHead>
                <TableHead className="text-center">{t('common.action')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.mohOverdueList.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-purple-50" onClick={() => onOpenDetail(item.id)}>
                    <TableCell className="font-mono font-semibold">{item.reference}</TableCell>
                    <TableCell><Badge variant="secondary" className={getDisciplineColor(item.discipline, disciplines)}>{getDisciplineLabel(item.discipline, disciplines)}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-md truncate">{item.description || '—'}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={item.status.color}>{item.status.emoji} {t(item.status.statusKey || 'status.' + item.status.status, item.status.daysOpen !== undefined ? {days: item.status.daysOpen} : {})}</Badge></TableCell>
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
function ListView({ items, loading, search, onSearch, filterCategory, onFilterCategory, filterDiscipline, onFilterDiscipline, filterStatus, onFilterStatus, filterType, onFilterType, sortBy, onSortBy, sortOrder, onSortOrder, types, disciplines, categories, onOpenDetail, onRefresh, onSendToMoh, onCopy, onDownloadExcel, onRegisterRevision, onRegisterConsultantReply, onRegisterMohReply }: {
  items: Transmittal[]; loading: boolean; search: string; onSearch: (s: string) => void;
  filterCategory: string; onFilterCategory: (s: string) => void;
  filterDiscipline: string; onFilterDiscipline: (s: string) => void;
  filterStatus: string; onFilterStatus: (s: string) => void;
  filterType: string; onFilterType: (s: string) => void;
  sortBy: 'date' | 'reference' | 'discipline' | 'status';
  onSortBy: (s: 'date' | 'reference' | 'discipline' | 'status') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrder: (s: 'asc' | 'desc') => void;
  types: string[]; disciplines: Discipline[]; categories: Category[];
  onOpenDetail: (id: string) => void; onRefresh: () => void; onSendToMoh: (id: string, reference?: string, latestRev?: number) => void;
  onCopy: (id: string, reference: string, description?: string) => void;
  onDownloadExcel: (reference: string, description: string) => void;
  onRegisterRevision: (id: string, reference: string, nextRev: number) => void;
  onRegisterConsultantReply: (id: string, reference: string) => void;
  onRegisterMohReply: (id: string, reference: string) => void;
}) {
  const { t, lang } = useI18n();
  // Filter disciplines based on selected category (cascading, INCLUDING linked categories)
  const availableDisciplines = filterCategory !== 'all'
    ? disciplines.filter(d => {
        const defaultCat = d.categoryCode || d.category || 'TRANSMITTAL';
        const allCats: string[] = (d as any).allCategories || [defaultCat];
        return allCats.includes(filterCategory);
      })
    : disciplines;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-2xl font-bold text-slate-900">{t('list.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{items.length} {t('common.results')}</p></div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => onSortBy(v as any)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><ArrowUpDown className="w-3 h-3 ml-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">{t('list.sortByDate')}</SelectItem>
              <SelectItem value="reference">{t('list.sortByRef')}</SelectItem>
              <SelectItem value="discipline">{t('list.sortByDiscipline')}</SelectItem>
              <SelectItem value="status">{t('list.sortByStatus')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => onSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? t('list.sortAsc') : t('list.sortDesc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}</Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">{t('common.search')}</Label>
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={t('list.searchPlaceholder')} className="pr-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('field.mainCategory')}</Label>
            <Select value={filterCategory} onValueChange={(v) => { onFilterCategory(v); onFilterDiscipline('all'); }}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('list.allCategories')}</SelectItem>
                {categories.map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('field.subDiscipline')}</Label>
            <Select value={filterDiscipline} onValueChange={onFilterDiscipline}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('list.allDisciplines')}</SelectItem>
                {availableDisciplines.map(d => <SelectItem key={d.code} value={d.code}>{d.label} ({d.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('common.type')}</Label>
            <Select value={filterType} onValueChange={onFilterType}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('list.allTypes')}</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('common.status')}</Label>
            <Select value={filterStatus} onValueChange={onFilterStatus}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('list.allStatuses')}</SelectItem>
                <SelectItem value="approved">{`✅ ${t('status.approved_short')}`}</SelectItem>
                <SelectItem value="pending">{`⏳ ${t('status.pending_reply')}`}</SelectItem>
                <SelectItem value="overdue">{`🔴 ${t('status.overdue')}`}</SelectItem>
                <SelectItem value="resubmit">{`🔔 ${t('status.resubmit_short')}`}</SelectItem>
                <SelectItem value="cancelled">{`🚫 ${t('status.cancelled_short')}`}</SelectItem>
                <SelectItem value="draft">{`📝 ${t('status.draft')}`}</SelectItem>
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
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{t('list.noResults')}</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10"><TableRow>
                <TableHead className="text-right">{t('common.reference')}</TableHead>
                <TableHead className="text-right">{t('common.category')}</TableHead>
                <TableHead className="text-right">{t('common.type')}</TableHead>
                <TableHead className="text-right">{t('common.description')}</TableHead>
                <TableHead className="text-center">{t('common.revisions')}</TableHead>
                <TableHead className="text-center">{t('detail.consultant')}</TableHead>
                <TableHead className="text-center">{t('detail.moh')}</TableHead>
                <TableHead className="text-center">{t('common.actions')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpenDetail(item.id)}>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">{item.reference}</TableCell>
                    <TableCell><Badge variant="secondary" className={getDisciplineColor(item.discipline, disciplines)}>{getDisciplineLabel(item.discipline, disciplines)}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{item.type || '—'}</TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-xs truncate">{item.description || '—'}</TableCell>
                    <TableCell className="text-center font-semibold">{item.revisionsCount}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={item.consultantStatus.color}>{item.consultantStatus.emoji}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={item.mohStatus.color}>{item.mohStatus.emoji}</Badge></TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onOpenDetail(item.id)}>
                            <Eye className="w-4 h-4 ml-2" /> {t('common.viewDetails')}</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRegisterRevision(item.id, item.reference, item.revisionsCount)}
                            disabled={item.computedStatus.status === 'cancelled' || item.revisionsCount === 0 || item.lastReplyDate === null}
                          >
                            <History className="w-4 h-4 ml-2" /> {t('dialog.registerRevision', {count: item.revisionsCount})}
                            {item.computedStatus.status === 'cancelled' ? <span className="text-[10px] text-slate-400 mr-1">({t('status.cancelled_short')})</span> :
                             (item.revisionsCount === 0 || item.lastReplyDate === null) && <span className="text-[10px] text-slate-400 mr-1">(بانتظار الرد)</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRegisterConsultantReply(item.id, item.reference)}
                            disabled={item.computedStatus.status === 'cancelled' || item.revisionsCount === 0 || item.lastReplyDate !== null}
                          >
                            <Building2 className="w-4 h-4 ml-2" /> {t('dialog.consultantReply')}
                            {item.computedStatus.status === 'cancelled' ? <span className="text-[10px] text-slate-400 mr-1">({t('msg.cancelled')})</span> :
                             (item.revisionsCount === 0 || item.lastReplyDate !== null) && <span className="text-[10px] text-slate-400 mr-1">{item.revisionsCount === 0 ? t('msg.noRev') : t('msg.replied')}</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRegisterMohReply(item.id, item.reference)}
                            disabled={item.computedStatus.status === 'cancelled' || item.mohStatus.status === 'not_sent'}
                          >
                            <Hospital className="w-4 h-4 ml-2" /> {t('dialog.mohReply')}
                            {item.computedStatus.status === 'cancelled' ? <span className="text-[10px] text-slate-400 mr-1">({t('msg.cancelled')})</span> :
                             item.mohStatus.status === 'not_sent' && <span className="text-[10px] text-slate-400 mr-1">({t('msg.notSent')})</span>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onSendToMoh(item.id, item.reference)}
                            disabled={item.computedStatus.status === 'cancelled' || item.consultantStatus.status !== 'approved' || (item.mohStatus.status !== 'not_sent' && item.mohStatus.status !== 'reviewed')}
                          >
                            <Send className="w-4 h-4 ml-2" /> {t('dialog.sendRevToMoh', {rev: item.revisionsCount > 0 ? (item.revisionsCount - 1) : 0})}
                            {item.consultantStatus.status !== 'approved' && <span className="text-[10px] text-slate-400 mr-1">(غير معتمد)</span>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCopy(item.id, item.reference, item.description || '')}>
                            <Copy className="w-4 h-4 ml-2" /> {t('detail.copyNew')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownloadExcel(item.reference, item.description || '')}>
                            <FileDown className="w-4 h-4 ml-2" /> {t('reports.exportExcel')}</DropdownMenuItem>
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
function DetailView({ detail, loading, disciplines, onBack, onRefresh, onDownloadExcel, onSendToMoh, onCopy, onOpenDetail }: {
  detail: TransmittalDetail; loading: boolean; disciplines: Discipline[];
  onBack: () => void; onRefresh: () => void; onDownloadExcel: (reference?: string, description?: string, category?: string, revNumber?: number) => void; onSendToMoh: () => void;
  onCopy: () => void; onOpenDetail: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const [showRevDialog, setShowRevDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRev, setEditingRev] = useState<any | null>(null);
  const [editingMohReview, setEditingMohReview] = useState<any | null>(null);
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
        title: t('msg.fileTypeUnsupported'),
        description: t('msg.allowedFileTypes'),
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
      if (!r.ok) throw new Error(t('msg.uploadFailed'));
      toast({ title: t('msg.fileUploaded'), description: file.name });
      fetchAttachments();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
      if (!r.ok) throw new Error(t('msg.addLinkFailed'));
      toast({ title: t('msg.linkAdded'), description: linkName });
      setShowLinkDialog(false);
      setLinkUrl('');
      setLinkName('');
      fetchAttachments();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm(t('confirm.deleteAttachment'))) return;
    try {
      const r = await fetch(`/api/transmittals/${detail.id}/attachments?attId=${attId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(t('msg.deleteFailed'));
      toast({ title: t('msg.attachmentDeleted') });
      fetchAttachments();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    }
  };

  // Download file using base64 data URL (most reliable method)
  // Fetches file as base64 from server, then downloads directly from data URL
  // This bypasses ALL proxy/server issues with direct file serving
  const handleDownloadFile = async (att: any) => {
    if (!att.id) {
      toast({ title: t('msg.error'), description: t('msg.fileIdMissing'), variant: 'destructive' });
      return;
    }
    try {
      toast({ title: t('msg.downloading'), description: att.fileName });
      
      // Fetch file as base64 data URL
      const res = await fetch(`/api/file-data/${att.id}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(t('msg.prepareFailed', {status: res.status}));
      }
      const data = await res.json();
      if (!data.ok || !data.dataUrl) {
        throw new Error(t('msg.readFileFailed'));
      }

      // Create download link from data URL
      const a = document.createElement('a');
      a.href = data.dataUrl;
      a.download = att.fileName || 'download';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ title: t('msg.downloaded'), description: att.fileName });
    } catch (e: any) {
      console.error('Download error:', e);
      toast({ title: t('msg.downloadError'), description: e.message || t('msg.downloadFailed'), variant: 'destructive' });
    }
  };

  const sourceConfig: Record<string, { label: string; icon: string; color: string }> = {
    link: { label: t('common.link'), icon: '🔗', color: 'bg-blue-600 text-white' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /> {t('detail.backToList')}</Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}</Button>
          <Button variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
            <Copy className="w-4 h-4" /> {t('detail.copyNew')}</Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50">
            <Pencil className="w-4 h-4" /> {t('common.edit')}</Button>
          <Button variant="outline" size="sm" onClick={onSendToMoh}
            disabled={detail.mohStatus.status !== 'not_sent' && detail.mohStatus.status !== 'reviewed'}
            className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
            <Send className="w-4 h-4" /> {t('dialog.sendRevToMoh', {rev: latestRevNumber})}
          </Button>
          <Button size="sm" onClick={() => onDownloadExcel()} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Download className="w-4 h-4" /> {t('detail.downloadExcel')}</Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-6">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{detail.reference}</h2>
            <Badge variant="secondary" className={getDisciplineColor(detail.discipline, disciplines)}>{getDisciplineLabel(detail.discipline, disciplines)} · {detail.discipline}</Badge>
            <Badge variant="outline" className={detail.computedStatus.color}>{detail.computedStatus.emoji} {t(detail.computedStatus.statusKey || 'status.' + detail.computedStatus.status, detail.computedStatus.daysOpen !== undefined ? {days: detail.computedStatus.daysOpen} : {})}</Badge>
          </div>
          {detail.type && <p className="text-sm text-slate-600">{t('detail.typeLabel', {type: detail.type})}</p>}
          {detail.description && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{detail.description}</p>
            </div>
          )}

          {/* Linked Transmittals (parent + children) */}
          {((detail as any).parent || (detail as any).children?.length > 0) && (
            <div className="mt-4 space-y-2">
              {(detail as any).parent && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-xs text-slate-500">📚 مرتبط بـ:</span>
                  <button
                    onClick={() => onOpenDetail((detail as any).parent.id)}
                    className="text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium flex items-center gap-1"
                  >
                    <Link className="w-3 h-3" />
                    {(detail as any).parent.reference}
                    {(detail as any).parent.description && (
                      <span className="text-slate-500 font-normal">— {(detail as any).parent.description.slice(0, 50)}</span>
                    )}
                  </button>
                </div>
              )}
              {(detail as any).children?.length > 0 && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-xs text-slate-500 mb-1">↳ الكتب المرتبطة بهذا ({(detail as any).children.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {(detail as any).children.map((child: any) => (
                      <button
                        key={child.id}
                        onClick={() => onOpenDetail(child.id)}
                        className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline font-medium flex items-center gap-1 bg-white px-2 py-1 rounded border border-emerald-200"
                      >
                        <Link className="w-3 h-3" />
                        {child.reference}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent></Card>

      {/* Reviews Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5" /> {t('detail.consultant')}</h3>
            <Badge variant="outline" className={detail.consultantStatus.color}>{detail.consultantStatus.emoji} {t(detail.consultantStatus.statusKey || 'status.' + detail.consultantStatus.status, detail.consultantStatus.daysOpen !== undefined ? {days: detail.consultantStatus.daysOpen} : {})}</Badge>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">{t('detail.lastSubmit')}</dt><dd>{fmtDate(detail.lastSubmitDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t('detail.lastReply')}</dt><dd>{fmtDate(detail.lastReplyDate)}</dd></div>
          </dl>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Hospital className="w-5 h-5 text-blue-700" /> {t('detail.mohFull')}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={detail.mohStatus.color}>{detail.mohStatus.emoji} {t(detail.mohStatus.statusKey || 'status.' + detail.mohStatus.status, detail.mohStatus.daysOpen !== undefined ? {days: detail.mohStatus.daysOpen} : {})}</Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => setEditingMohReview({
                  party: 'MOH',
                  submitDate: (detail as any).mohSubmitDate || null,
                  submitRev: (detail as any).mohSubmitRev ?? null,
                  reviewDate: (detail as any).mohReviewDate || null,
                  status: (detail as any).mohStatusRaw?.status || null,
                  notes: (detail as any).mohNotes || '',
                })}
                title={detail.mohStatus.status === 'not_sent' ? t('dialog.addMohReview') : t('dialog.editMohReview')}
              >
                <Pencil className="w-3 h-3 text-amber-700" />
                <span className="text-amber-700">
                  {detail.mohStatus.status === 'not_sent' ? t('common.add') : t('common.edit')}
                </span>
              </Button>
            </div>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">{t('detail.sendToMoh')}</dt><dd>{fmtDate(detail.mohSubmitDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t('detail.sentRev')}</dt><dd>{detail.mohSubmitRev !== null ? `REV.${detail.mohSubmitRev}` : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t('detail.mohReply')}</dt><dd>{fmtDate(detail.mohReviewDate)}</dd></div>
          </dl>
        </CardContent></Card>
      </div>

      {/* Revisions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5" /> {t('detail.revisionsLog', {count: detail.revisions.length})}</CardTitle>
            <CardDescription>{t('dialog.revAutoSuggest', {count: detail.revisions.length})}</CardDescription></div>
          <Button size="sm" onClick={() => setShowRevDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> {t('dialog.addRevision', {count: detail.revisions.length})}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {detail.revisions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">{t('detail.noRevisions')}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-center">{t('common.revision')}</TableHead>
                <TableHead className="text-center">{t('field.submitDate')}</TableHead>
                <TableHead className="text-center">{t('field.replyDate')}</TableHead>
                <TableHead className="text-center">{t('field.action')}</TableHead>
                <TableHead className="text-right">{t('common.notes')}</TableHead>
                <TableHead className="text-center">{t('common.download')}</TableHead>
                <TableHead className="text-center">{t('common.edit')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {detail.revisions.map((r) => {
                  let actionLabel: string;
                  let actionColor: string;
                  const act = (r.action || '').toLowerCase().trim();
                  if (act === 'approved') {
                    if (r.approvalType === 'NOT_APPROVED') { actionLabel = `(D) ${getApprovalTypeLabel('NOT_APPROVED')} — ${t('status.rejected_d')}`; actionColor = 'text-red-700'; }
                    else if (r.approvalType === 'FOR_INFORMATION') { actionLabel = `(E) ${getApprovalTypeLabel('FOR_INFORMATION')} — ${t('status.info_e')}`; actionColor = 'text-orange-700'; }
                    else if (r.approvalType === 'APPROVED_AS_NOTED_RESUBMIT') { actionLabel = `(C) ${getApprovalTypeLabel('APPROVED_AS_NOTED_RESUBMIT')} — ${t('status.approved_c')}`; actionColor = 'text-orange-700'; }
                    else if (r.approvalType === 'APPROVED_AS_NOTED') { actionLabel = `(B) ${getApprovalTypeLabel('APPROVED_AS_NOTED')} — ${t('status.approved_b')}`; actionColor = 'text-emerald-700'; }
                    else if (r.approvalType === 'APPROVED') { actionLabel = `(A) ${getApprovalTypeLabel('APPROVED')} — ${t('status.approved_a')}`; actionColor = 'text-emerald-700'; }
                    else { actionLabel = `✅ ${t('status.approved')}`; actionColor = 'text-emerald-700'; }
                  } else if (act === 'rejected') {
                    actionLabel = `❌ ${t('status.resubmit')}`; actionColor = 'text-red-700';
                  } else if (act === 'withdrawn') {
                    actionLabel = `🚫 ${t('status.cancelled')}`; actionColor = 'text-gray-600';
                  } else if (act === 'pending') {
                    actionLabel = `⏳ ${t('status.pending_reply')}`; actionColor = 'text-yellow-700';
                  } else {
                    actionLabel = r.action || '—'; actionColor = 'text-yellow-700';
                  }
                  // Distinct color per revision number
                  const revColor = getRevisionColor(r.revNumber);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${revColor}`}>REV.{r.revNumber}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{fmtDate(r.submitDate)}</TableCell>
                      <TableCell className="text-center text-sm">{fmtDate(r.replyDate)}</TableCell>
                      <TableCell className={`text-center font-semibold ${actionColor}`}>{actionLabel}</TableCell>
                      <TableCell className="text-sm text-slate-600">{r.notes || '—'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onDownloadExcel(detail.reference, detail.description || '', detail.category, r.revNumber)}
                          title={`${t('detail.downloadExcelForRev')} Rev.${String(r.revNumber).padStart(2, '0')}`}
                        >
                          <FileDown className="w-3 h-3" /> Rev.{String(r.revNumber).padStart(2, '0')}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setEditingRev(r)}
                          title={t('dialog.editRevision')}
                        >
                          <Pencil className="w-3 h-3 text-amber-700" />
                        </Button>
                      </TableCell>
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
        onSaved={() => { setShowRevDialog(false); onRefresh(); toast({ title: t('msg.revSaved') }); }}
      />

      {/* Attachments Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileDown className="w-5 h-5" /> {t('detail.attachments', {count: attachments.length})}
            </CardTitle>
            <CardDescription>{t('new.attachmentsHint')}</CardDescription>
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
              <Upload className="w-4 h-4" /> {uploading ? t('msg.loading') : t('msg.uploadFile')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowLinkDialog(true)}
            >
              <FileDown className="w-4 h-4" /> {t('button.addExternalLink')}</Button>
          </div>

          {/* Attachments list */}
          {attachments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">{t('detail.noAttachments')}</p>
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
                  : isImage ? { label: t('common.image'), color: 'bg-emerald-100 text-emerald-700', icon: '🖼️' }
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
                        <Button size="sm" variant="ghost" title={t('common.download')} onClick={() => handleDownloadFile(att)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {isLink && (
                        <a href={openUrl} target="_blank" rel="noopener noreferrer" title={t('common.open')}>
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
                {t('button.addExternalLink')}</DialogTitle>
              <DialogDescription>{t('new.externalLinkHint')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t('common.type')}</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white w-fit">
                  <span className="text-lg">🔗</span>
                  <span className="font-semibold text-sm">{t('button.externalLink')}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t('msg.fileNameDesc')}</Label>
                <Input
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder={t('new.descExample1')}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t('field.url')}</Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>{t('common.cancel')}</Button>
              <Button
                onClick={handleAddLink}
                disabled={!linkUrl.trim() || !linkName.trim() || uploading}
                className="bg-blue-700 hover:bg-blue-800 gap-1.5"
              >
                <FileDown className="w-4 h-4" /> {uploading ? t('msg.loading') : t('msg.addLink')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Transmittal Dialog — edit description, type, alternative title */}
      {showEditDialog && (
        <EditTransmittalDialog
          transmittal={detail}
          onOpenChange={(v) => !v && setShowEditDialog(false)}
          onSaved={() => { setShowEditDialog(false); onRefresh(); }}
        />
      )}

      {/* Edit Revision Dialog — edit submit/reply date, action, approval type, notes */}
      {editingRev && (
        <EditRevisionDialog
          transmittalId={detail.id}
          revision={editingRev}
          onOpenChange={(v) => !v && setEditingRev(null)}
          onSaved={() => { setEditingRev(null); onRefresh(); }}
        />
      )}

      {/* Edit MOH Review Dialog — edit review date, status, notes */}
      {editingMohReview && (
        <EditMohReviewDialog
          transmittalId={detail.id}
          review={editingMohReview}
          onOpenChange={(v) => !v && setEditingMohReview(null)}
          onSaved={() => { setEditingMohReview(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ============ EDIT TRANSMITTAL DIALOG ============ */
function EditTransmittalDialog({ transmittal, onOpenChange, onSaved }: {
  transmittal: TransmittalDetail;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [description, setDescription] = useState(transmittal.description || '');
  const [type, setType] = useState(transmittal.type || '');
  const [alternativeTitle, setAlternativeTitle] = useState(transmittal.alternativeTitle || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/transmittals/${transmittal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim() || null,
          type: type.trim() || null,
          alternativeTitle: alternativeTitle.trim() || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || t('msg.saveFailed'));
      }
      toast({ title: t('msg.updated'), description: transmittal.reference });
      onSaved();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-amber-700" />
            {t('dialog.editTransmittal')} — {transmittal.reference}
          </DialogTitle>
          <DialogDescription>{t('dialog.editTransmittalDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('common.description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('new.descExample1')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('common.type')}</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={t('new.typeExample1')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('field.alternativeTitle')}</Label>
            <Input
              value={alternativeTitle}
              onChange={(e) => setAlternativeTitle(e.target.value)}
              placeholder={t('field.alternativeTitlePlaceholder')}
            />
            <p className="text-xs text-slate-500">{t('field.alternativeTitleHint')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-700 hover:bg-amber-800 gap-1.5"
          >
            {saving ? t('msg.saving') : <><Pencil className="w-4 h-4" /> {t('common.save')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ EDIT REVISION DIALOG ============ */
function EditRevisionDialog({ transmittalId, revision, onOpenChange, onSaved }: {
  transmittalId: string;
  revision: { id: string; revNumber: number; submitDate: string | null; replyDate: string | null; action: string | null; approvalType: string | null; notes: string | null };
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [submitDate, setSubmitDate] = useState(revision.submitDate ? revision.submitDate.slice(0, 10) : '');
  const [replyDate, setReplyDate] = useState(revision.replyDate ? revision.replyDate.slice(0, 10) : '');
  const [action, setAction] = useState(revision.action || '');
  const [approvalType, setApprovalType] = useState(revision.approvalType || '');
  const [notes, setNotes] = useState(revision.notes || '');
  const [saving, setSaving] = useState(false);

  const handleActionChange = (v: string) => {
    setAction(v);
    if (v !== 'approved') setApprovalType('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update via revisions API — uses upsert with existing revNumber
      const r = await fetch(`/api/transmittals/${transmittalId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revNumber: revision.revNumber,
          submitDate: submitDate || null,
          replyDate: replyDate || null,
          action: action || null,
          approvalType: action === 'approved' ? (approvalType || null) : null,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || t('msg.saveFailed'));
      }

      // If this is a consultant reply (has replyDate + action), also update the consultant review
      if (replyDate && action) {
        const actionToStatus: Record<string, string> = {
          approved: (approvalType === 'NOT_APPROVED' ? 'Submit Next Rev' :
                     approvalType === 'FOR_INFORMATION' ? 'Under Review' :
                     approvalType === 'APPROVED_AS_NOTED_RESUBMIT' ? 'Submit Next Rev' : 'Approved'),
          rejected: 'Submit Next Rev',
          withdrawn: 'Cancelled',
        };
        const status = actionToStatus[action] || 'Under Review';
        await fetch(`/api/transmittals/${transmittalId}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ party: 'CONSULTANT', status, reviewDate: replyDate, notes: notes || null }),
        });
      }

      toast({ title: t('msg.updated'), description: `Rev.${String(revision.revNumber).padStart(2, '0')}` });
      onSaved();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-amber-700" />
            {t('dialog.editRevision')} — Rev.{String(revision.revNumber).padStart(2, '0')}
          </DialogTitle>
          <DialogDescription>{t('dialog.editRevisionDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm">
            <strong>{t('common.revision')}:</strong> Rev.{String(revision.revNumber).padStart(2, '0')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.submitDate')}</Label>
              <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.replyDate')}</Label>
              <Input type="date" value={replyDate} onChange={(e) => setReplyDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.action')}</Label>
            <Select value={action} onValueChange={handleActionChange}>
              <SelectTrigger><SelectValue placeholder={t('field.selectAction')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">✅ {t('status.approved_short')}</SelectItem>
                <SelectItem value="rejected">❌ {t('status.rejected')}</SelectItem>
                <SelectItem value="withdrawn">🚫 {t('status.cancelled_short')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{t('dialog.editActionHint')}</p>
          </div>
          {action === 'approved' && (
            <div className="space-y-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-emerald-800">{t('field.acceptTypeReq')}</Label>
              <Select value={approvalType} onValueChange={setApprovalType}>
                <SelectTrigger className="!w-full !h-auto !min-h-[36px] !whitespace-normal !break-words text-left [&_[data-slot=select-value]]:!line-clamp-none [&_[data-slot=select-value]]:!whitespace-normal [&_[data-slot=select-value]]:!break-words"><SelectValue placeholder={t('field.selectAcceptType')} className="whitespace-normal break-words leading-snug" /></SelectTrigger>
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
            <Label className="text-sm">{t('common.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('field.notesExtra')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-700 hover:bg-amber-800 gap-1.5">
            {saving ? t('msg.saving') : <><Pencil className="w-4 h-4" /> {t('common.save')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ EDIT MOH REVIEW DIALOG ============ */
function EditMohReviewDialog({ transmittalId, review, onOpenChange, onSaved }: {
  transmittalId: string;
  review: { party: string; submitDate: string | null; submitRev: number | null; reviewDate: string | null; status: string | null; notes: string };
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [submitDate, setSubmitDate] = useState(review.submitDate ? review.submitDate.slice(0, 10) : '');
  const [submitRev, setSubmitRev] = useState<string>(review.submitRev !== null ? String(review.submitRev) : '');
  const [reviewDate, setReviewDate] = useState(review.reviewDate ? review.reviewDate.slice(0, 10) : '');
  const [status, setStatus] = useState(review.status || '');
  const [notes, setNotes] = useState(review.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/transmittals/${transmittalId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party: 'MOH',
          status: status || null,
          submitDate: submitDate || null,
          submitRev: submitRev !== '' ? Number(submitRev) : null,
          reviewDate: reviewDate || null,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || t('msg.saveFailed'));
      }
      toast({ title: t('msg.updated'), description: t('detail.mohFull') });
      onSaved();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-amber-700" />
            {t('dialog.editMohReview')}
          </DialogTitle>
          <DialogDescription>{t('dialog.editMohReviewDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('detail.sendToMoh')}</Label>
              <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('detail.sentRev')}</Label>
              <Input type="number" min="0" value={submitRev} onChange={(e) => setSubmitRev(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('detail.mohReply')}</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.statusReq')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder={t('field.selectStatus')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">{`✅ ${t('status.approved_short')}`}</SelectItem>
                  <SelectItem value="Rejected">❌ {t('status.rejected')}</SelectItem>
                  <SelectItem value="Under Review">{`⏳ ${t('status.underReview')}`}</SelectItem>
                  <SelectItem value="Cancelled">{`🚫 ${t('status.cancelled_short')}`}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('field.mohNotes')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-700 hover:bg-amber-800 gap-1.5">
            {saving ? t('msg.saving') : <><Pencil className="w-4 h-4" /> {t('common.save')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRevisionDialog({ open, onOpenChange, transmittalId, nextRevNumber, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  transmittalId: string; nextRevNumber: number; onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [submitDate, setSubmitDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-set submit date to today when dialog opens
  useEffect(() => {
    if (open) {
      setSubmitDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!submitDate) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/transmittals/${transmittalId}/revisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revNumber: nextRevNumber,
          submitDate: submitDate,
          replyDate: null,
          action: null,
          approvalType: null,
          notes: notes || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || t('msg.saveFailed'));
      }
      onSaved();
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
    }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialog.addRevisionTitle', {next: nextRevNumber})}</DialogTitle>
          <DialogDescription>{t('field.submitDateOnlyHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-sm">
            <strong>{t('field.revNumber')}</strong> REV.{nextRevNumber} ({t('common.auto')})
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.submitDateReq')}</Label>
            <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('field.notesExtra')} />
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
            {t('dialog.addRevisionNote')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || !submitDate} className="bg-emerald-700 hover:bg-emerald-800">{saving ? t('msg.saving') : `${t('common.save')} REV.${nextRevNumber}`}</Button>
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
  const { t, lang } = useI18n();
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [refInfo, setRefInfo] = useState<{ lastGlobalMax: number; totalAllDisciplines: number; recentAllDisciplines: string[] } | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [parentTransmittalId, setParentTransmittalId] = useState('');
  const [parentOptions, setParentOptions] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const { toast } = useToast();

  const fetchNextReference = async (d: string) => {
    if (!d) return;
    setLoadingRef(true);
    try {
      const r = await fetch(`/api/transmittals/next-ref?discipline=${encodeURIComponent(d)}`);
      if (!r.ok) throw new Error(t('msg.loadNextRefFailed'));
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
      toast({ title: t('msg.error'), description: t('msg.refAndDiscRequired'), variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/transmittals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, discipline, type: type || undefined, description: description || undefined, parentTransmittalId: parentTransmittalId || undefined }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.createFailed')); }
      const created = await r.json();
      if (submitDate) {
        await fetch(`/api/transmittals/${created.id}/revisions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revNumber: 0, submitDate }),
        });
      }
      onCreated(created);
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('new.title')}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {t('new.refHint', {examples: 'CIV-171, EL-172, PL-173, ...'})}
        </p>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
        {/* Step 1: Main Category */}
        <div className="space-y-1.5">
          <Label>{t('field.mainCategoryReq')}<span className="text-xs text-slate-500">(ترانسميتال / MIR / RFI / كتب / ...)</span></Label>
          <Select value={category} onValueChange={(v) => { setCategory(v); setDiscipline(''); setReference(''); setRefInfo(null); }}>
            <SelectTrigger><SelectValue placeholder={t('new.categoryPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Discipline (filtered by category, INCLUDING linked categories) */}
        {category && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('field.subDisciplineReq')}</Label>
              <Select value={discipline} onValueChange={(v) => { setDiscipline(v); fetchNextReference(v); }}>
                <SelectTrigger><SelectValue placeholder={t('new.selectDiscipline')} /></SelectTrigger>
                <SelectContent>
                  {disciplines.filter(d => {
                    // Check if discipline is linked to the selected category:
                    // - via default categoryCode
                    // - OR via allCategories (multi-category link)
                    const defaultCat = d.categoryCode || d.category || 'TRANSMITTAL';
                    const allCats: string[] = (d as any).allCategories || [defaultCat];
                    return allCats.includes(category);
                  }).map(d => <SelectItem key={d.code} value={d.code}>{d.label} ({d.code})</SelectItem>)}
                </SelectContent>
              </Select>
              {disciplines.filter(d => {
                const defaultCat = d.categoryCode || d.category || 'TRANSMITTAL';
                const allCats: string[] = (d as any).allCategories || [defaultCat];
                return allCats.includes(category);
              }).length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  {t('settings.noDisciplinesInCategory')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t('field.referenceReq')} {loadingRef && <span className="text-xs text-slate-500">({t('msg.calculating')})</span>}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('new.refAutoSuggest')} className="font-mono" />
              {refInfo && (
                <p className="text-xs text-slate-500">
                  {t('field.nextAuto', {lastMax: refInfo.lastGlobalMax, total: refInfo.totalAllDisciplines})}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Other fields (only show after discipline is selected) */}
        {discipline && (
          <>
            <div className="space-y-1.5">
              <Label>{t('common.type')}</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder={t('new.selectType')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SHOP DRAWINGS">{t('acceptType.shopDrawings')}</SelectItem>
              <SelectItem value="SAMPLE">{t('acceptType.sample')}</SelectItem>
              <SelectItem value="SOURCE APPROVAL">{t('acceptType.source')}</SelectItem>
              <SelectItem value="COMPANY PROFILE">{t('acceptType.companyProfile')}</SelectItem>
              <SelectItem value="TEST REPORT">{t('acceptType.testReport')}</SelectItem>
              <SelectItem value="SUBMITTAL">{t('acceptType.submittal')}</SelectItem>
              <SelectItem value="MATERIAL APPROVAL">{t('acceptType.material')}</SelectItem>
              <SelectItem value="METHOD STATEMENT">{t('acceptType.methodStatement')}</SelectItem>
              <SelectItem value="CALCULATION">{t('acceptType.calculation')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('common.description')}</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t('new.descExample2')} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('field.revZeroDate')}</Label>
          <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} />
        </div>

        {/* Link to parent transmittal (for incoming letters linked to outgoing) */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5" />
            {t('button.linkToLetter')}<span className="text-xs text-slate-500">— للكتب الواردة المرتبطة بكتب صادرة</span>
          </Label>
          <div className="flex gap-2">
            <Input
              value={parentTransmittalId}
              onChange={(e) => setParentTransmittalId(e.target.value)}
              placeholder={t('button.linkToLetterPlaceholder')}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingParents}
              onClick={async () => {
                setLoadingParents(true);
                try {
                  const r = await fetch('/api/transmittals?limit=50');
                  if (r.ok) {
                    const data = await r.json();
                    setParentOptions(data.items || []);
                  }
                } catch {}
                setLoadingParents(false);
              }}
            >
              {loadingParents ? '...' : '🔍 بحث'}
            </Button>
          </div>
          {parentOptions.length > 0 && (
            <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              {parentOptions.map((opt: any) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setParentTransmittalId(opt.id); setParentOptions([]); }}
                  className="block w-full text-right p-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <span className="font-mono text-sm font-semibold">{opt.reference}</span>
                  <span className="text-xs text-slate-500 mr-2">{opt.category}</span>
                  {opt.description && <span className="text-xs text-slate-600 block">{opt.description.slice(0, 60)}</span>}
                </button>
              ))}
            </div>
          )}
          {parentTransmittalId && (
            <p className="text-xs text-emerald-700">✓ مرتبط بكتاب ID: {parentTransmittalId}</p>
          )}
        </div>
          </>
        )}
      </CardContent></Card>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => onDownloadTemplate(reference, discipline, description)} disabled={!reference}>
          <Download className="w-4 h-4" /> {t('new.downloadTemplate')}</Button>
        <Button onClick={handleCreate} disabled={saving || !reference || !discipline} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
          <Plus className="w-4 h-4" /> {saving ? t('msg.creating') : t('button.createTransmittal')}
        </Button>
      </div>

      {refInfo && refInfo.recentAllDisciplines.length > 0 && (
        <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">{t('dashboard.lastFiveRefs')}</p>
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
  const { t, lang } = useI18n();
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
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.importFailed')); }
      const data = await r.json();
      setResult(data);
      toast({ title: t('msg.importSuccess'), description: t('msg.importResult', {imported: data.imported, skipped: data.skipped}) });
    } catch (e: any) { toast({ title: t('msg.importFailed'), description: e.message, variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('import.title')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('import.desc')}</p>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>{t('import.file')}</Label>
          <Input type="file" accept=".xlsm,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-900"><strong>⚠️ تنبيه:</strong> {t('confirm.wipeData')}</p>
        </div>
        <Button onClick={handleImport} disabled={!file || importing} className="w-full bg-emerald-700 hover:bg-emerald-800 gap-1.5">
          {importing ? (<><RefreshCw className="w-4 h-4 animate-spin" /> {t('import.loading')}</>) : (<><Upload className="w-4 h-4" /> {t('import.start')}</>)}
        </Button>
      </CardContent></Card>

      {result && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader><CardTitle className="text-lg text-emerald-800">{t('import.result')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-3xl font-bold text-emerald-700">{result.imported}</p><p className="text-xs text-slate-600">{t('list.imported')}</p></div>
              <div><p className="text-3xl font-bold text-slate-600">{result.skipped}</p><p className="text-xs text-slate-600">{t('status.skipped')}</p></div>
              <div><p className="text-3xl font-bold text-slate-600">{result.totalExtracted}</p><p className="text-xs text-slate-600">{t('list.totalExtracted')}</p></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 max-h-32 overflow-y-auto">
                <p className="font-semibold mb-1">{t('import.errors')}</p>
                <ul className="list-disc list-inside space-y-0.5">{result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <Button onClick={onDone} className="w-full bg-emerald-700 hover:bg-emerald-800">{t('dashboard.viewDashboard')}</Button>
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
  const { t, lang } = useI18n();
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
      if (!r.ok) throw new Error(t('msg.loadReportFailed'));
      const data = await r.json();
      setItems(data.items);
    } catch (e: any) {
      toast({ title: t('msg.error'), description: e.message, variant: 'destructive' });
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
    toast({ title: t('msg.generatingExcel'), description: t('reports.willDownloadSoon') });
    try {
      const res = await fetch(`/api/reports/export?${params}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('msg.generateFailed', {status: res.status}));
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
      toast({ title: t('msg.downloadError'), description: e.message, variant: 'destructive' });
    }
  };

  const handlePrintReport = async () => {
    // Build a clean printable HTML with the report table
    const printHtml = `
<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${t('reports.title')}</title>
<style>
  body { font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 20px; color: #1e293b; }
  h1 { color: #0f766e; margin-bottom: 8px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: ${lang === 'ar' ? 'right' : 'left'}; }
  th { background: #f1f5f9; font-weight: 700; }
  tr:nth-child(even) { background: #fafafa; }
  .header-row { background: #ecfeff !important; font-weight: 700; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${t('reports.title')}</h1>
  <div class="meta">
    ${t('common.mainCategory')}: ${filterCategory === 'all' ? t('common.all') : filterCategory} ·
    ${t('common.discipline')}: ${filterDiscipline === 'all' ? t('common.all') : filterDiscipline} ·
    ${t('reports.dateFrom')}: ${dateFrom || '—'} · ${t('reports.dateTo')}: ${dateTo || '—'} ·
    ${items.length} ${t('common.results')}
  </div>
  <table>
    <thead>
      <tr class="header-row">
        <th>${t('common.reference')}</th>
        <th>${t('common.description')}</th>
        <th>${t('common.discipline')}</th>
        <th>${t('common.type')}</th>
        <th>${t('reports.rev.submit')}</th>
        <th>${t('reports.rev.reply')}</th>
        <th>${t('reports.rev.action')}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it: any) => {
        const latestRev = it.revisions && it.revisions.length > 0
          ? it.revisions[it.revisions.length - 1]
          : null;
        return `<tr>
          <td style="font-family: monospace; font-weight: 700;">${it.reference}</td>
          <td>${(it.description || '').replace(/</g, '&lt;')}</td>
          <td>${it.discipline || '—'}</td>
          <td>${it.type || '—'}</td>
          <td>${latestRev?.submitDate ? new Date(latestRev.submitDate).toLocaleDateString() : '—'}</td>
          <td>${latestRev?.replyDate ? new Date(latestRev.replyDate).toLocaleDateString() : '—'}</td>
          <td>${latestRev?.action || '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</body>
</html>`;

    // Use Electron's printContent IPC if available (cleaner output)
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.printContent) {
      try {
        await electronAPI.printContent(printHtml);
        return;
      } catch (e) {
        console.warn('Electron print failed, falling back to window.print()', e);
      }
    }
    // Fallback: open new window and print
    const printWin = window.open('', '_blank', 'width=1024,height=768');
    if (printWin) {
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 500);
    } else {
      // Last resort — print current page
      window.print();
    }
  };

  const availableDisciplines = filterCategory !== 'all'
    ? disciplines.filter(d => {
        const defaultCat = d.categoryCode || d.category || 'TRANSMITTAL';
        const allCats: string[] = (d as any).allCategories || [defaultCat];
        return allCats.includes(filterCategory);
      })
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
          <h2 className="text-2xl font-bold text-slate-900">{t('reports.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} ترانسميتال · {revColumns.length} مراجعة (REV.0 - REV.{maxRevNumber}) · كل ريفجن في جدول منفصل بفواصل رأسية
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}</Button>
          <Button variant="outline" size="sm" onClick={handlePrintReport} className="gap-1.5">
            <Printer className="w-4 h-4" /> {t('reports.printFull')}</Button>
          <Button size="sm" onClick={handleExportExcel} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <FileDown className="w-4 h-4" /> {t('reports.exportExcel')}</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">{t('common.search')}</Label>
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('reports.searchPlaceholder')} className="pr-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('field.mainCategory')}</Label>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setFilterDiscipline('all'); }}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {categories.map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('common.discipline')}</Label>
            <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {availableDisciplines.map(d => <SelectItem key={d.code} value={d.code}>{d.label} ({d.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('common.type')}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('reports.dateFrom')}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('reports.dateTo')}</Label>
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
              <p>{t('reports.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="border-collapse">
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="text-right sticky right-0 bg-white z-20 min-w-[120px] border-l-2 border-slate-300">{t('common.reference')}</TableHead>
                    <TableHead className="text-right min-w-[180px] border-l-2 border-slate-300">{t('common.description')}</TableHead>
                    {revColumns.map((rev, revIdx) => {
                      // Static color palette — Tailwind JIT requires literal class names
                      const revColors = [
                        { header: 'bg-blue-700', light: 'bg-blue-50', border: 'border-blue-200', borderL: 'border-blue-500' },
                        { header: 'bg-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-200', borderL: 'border-emerald-500' },
                        { header: 'bg-amber-700', light: 'bg-amber-50', border: 'border-amber-200', borderL: 'border-amber-500' },
                        { header: 'bg-purple-700', light: 'bg-purple-50', border: 'border-purple-200', borderL: 'border-purple-500' },
                        { header: 'bg-rose-700', light: 'bg-rose-50', border: 'border-rose-200', borderL: 'border-rose-500' },
                        { header: 'bg-cyan-700', light: 'bg-cyan-50', border: 'border-cyan-200', borderL: 'border-cyan-500' },
                        { header: 'bg-indigo-700', light: 'bg-indigo-50', border: 'border-indigo-200', borderL: 'border-indigo-500' },
                        { header: 'bg-orange-700', light: 'bg-orange-50', border: 'border-orange-200', borderL: 'border-orange-500' },
                      ];
                      const c = revColors[rev % revColors.length];
                      return (
                        <TableHead
                          key={rev}
                          className={`text-center min-w-[260px] p-0 border-l-4 ${revIdx === 0 ? 'border-l-2 border-slate-400' : `border-l-4 ${c.borderL}`}`}
                        >
                          {/* REV group header — colored band on top, distinct color per rev */}
                          <div className={`${c.header} text-white py-1.5 px-2 font-bold text-sm`}>REV.{rev}</div>
                          <div className={`flex text-xs font-normal mt-0 ${c.light}`}>
                            <div className={`flex-1 py-1 border-l ${c.border}`}>{t('reports.rev.submit')}</div>
                            <div className={`flex-1 py-1 border-l ${c.border}`}>{t('reports.rev.reply')}</div>
                            <div className={`flex-1 py-1 border-l ${c.border}`}>{t('common.action')}</div>
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="text-center min-w-[100px] border-l-4 border-emerald-500 bg-emerald-50">{t('detail.consultant')}</TableHead>
                    <TableHead className="text-center min-w-[100px] border-l-2 border-purple-500 bg-purple-50">{t('detail.moh')}</TableHead>
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
                        const revColors = [
                          { border: 'border-blue-200', borderL: 'border-blue-500', bg: 'bg-blue-50/30' },
                          { border: 'border-emerald-200', borderL: 'border-emerald-500', bg: 'bg-emerald-50/30' },
                          { border: 'border-amber-200', borderL: 'border-amber-500', bg: 'bg-amber-50/30' },
                          { border: 'border-purple-200', borderL: 'border-purple-500', bg: 'bg-purple-50/30' },
                          { border: 'border-rose-200', borderL: 'border-rose-500', bg: 'bg-rose-50/30' },
                          { border: 'border-cyan-200', borderL: 'border-cyan-500', bg: 'bg-cyan-50/30' },
                          { border: 'border-indigo-200', borderL: 'border-indigo-500', bg: 'bg-indigo-50/30' },
                          { border: 'border-orange-200', borderL: 'border-orange-500', bg: 'bg-orange-50/30' },
                        ];
                        const c = revColors[rev % revColors.length];
                        if (!r || (!r.submitDate && !r.action)) {
                          return (
                            <TableCell key={rev} className={`p-0 border-l-4 ${revIdx === 0 ? 'border-l-2 border-slate-400' : `border-l-4 ${c.borderL}`}`}>
                              <div className={`flex text-xs min-h-[44px] items-center ${c.bg}`}>
                                <div className={`flex-1 p-2 border-l ${c.border} text-center text-slate-300`}>—</div>
                                <div className={`flex-1 p-2 border-l ${c.border} text-center text-slate-300`}>—</div>
                                <div className={`flex-1 p-2 border-l ${c.border} text-center text-slate-300`}>—</div>
                              </div>
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={rev} className={`p-0 border-l-4 ${revIdx === 0 ? 'border-l-2 border-slate-400' : `border-l-4 ${c.borderL}`}`}>
                            <div className={`flex text-xs min-h-[44px] ${c.bg}`}>
                              <div className={`flex-1 p-2 border-l ${c.border} text-center`}>
                                {r.submitDate ? (
                                  <div>
                                    <div className="font-medium text-slate-700">{fmtDate(r.submitDate)}</div>
                                    {r.daysOpen !== null && r.daysOpen !== undefined && (
                                      <div className={`text-[10px] mt-0.5 font-semibold ${r.daysOpen > 30 ? 'text-red-700' : r.daysOpen > 14 ? 'text-yellow-700' : 'text-emerald-700'}`}>
                                        {r.daysOpen}ي
                                      </div>
                                    )}
                                  </div>
                                ) : <span className="text-slate-300">—</span>}
                              </div>
                              <div className={`flex-1 p-2 border-l ${c.border} text-center`}>
                                {r.replyDate ? (
                                  <div className="font-medium text-slate-700">{fmtDate(r.replyDate)}</div>
                                ) : <span className="text-slate-300">—</span>}
                              </div>
                              <div className={`flex-1 p-2 border-l ${c.border} text-center font-bold ${actionColor(r.action, r.approvalType)}`}>
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
            <span className="font-semibold">{t('reports.colorGuide')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-50 border border-emerald-300 inline-block"></span> A: APPROVED</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-50 border border-emerald-300 inline-block"></span> B: APPROVED AS NOTED</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-50 border border-orange-300 inline-block"></span> C: APPROVED AS NOTED & RESUBMIT</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-300 inline-block"></span> D: NOT APPROVED</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-50 border border-orange-300 inline-block"></span> E: FOR INFORMATION</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-300 inline-block"></span> ❌ {t('status.rejected')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 border border-gray-300 inline-block"></span> 🚫 {t('status.cancelled_short')}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">Xي = عدد الأيام من التقديم حتى الرد</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600">{t('reports.totalDaysHint')}</span>
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
  const { t, lang } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddDocType, setShowAddDocType] = useState(false);
  const [newDocTypeCode, setNewDocTypeCode] = useState('');
  const [newDocTypeLabel, setNewDocTypeLabel] = useState('');
  const [newDocTypeLabelEn, setNewDocTypeLabelEn] = useState('');
  const [editing, setEditing] = useState<Discipline | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingDocType, setEditingDocType] = useState<any | null>(null);
  const [showWipeData, setShowWipeData] = useState(false);
  const [wipePassword, setWipePassword] = useState('');
  const [wipeLoading, setWipeLoading] = useState(false);
  const [savePath, setSavePath] = useState<string>('');
  const { toast } = useToast();

  // Always fetch fresh data when SettingsView mounts
  useEffect(() => {
    onRefreshDisciplines();
    onRefreshCategories();
  }, []);

  const handleDelete = async (code: string) => {
    if (!confirm(t('confirm.deleteDiscipline', {code}))) return;
    try {
      const r = await fetch(`/api/disciplines/${code}`, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.deleteFailed')); }
      toast({ title: t('msg.disciplineDeleted'), description: code });
      onRefreshDisciplines();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteCategory = async (code: string) => {
    if (!confirm(t('confirm.deleteCategory', {code}))) return;
    try {
      const r = await fetch(`/api/categories/${code}`, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.deleteFailed')); }
      toast({ title: t('msg.categoryDeleted'), description: code });
      onRefreshCategories();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteDocType = async (id: string, code: string) => {
    if (!confirm(t('confirm.deleteType', {code}))) return;
    try {
      const r = await fetch(`/api/doc-types/${id}`, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || t('msg.deleteFailed')); }
      toast({ title: t('msg.typeDeleted'), description: code });
      onRefreshDocTypes();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
  };

  const handleAddDocType = async () => {
    if (!newDocTypeCode || !newDocTypeLabel) return;
    try {
      const r = await fetch('/api/doc-types', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newDocTypeCode.toUpperCase().trim(), label: newDocTypeLabel.trim(), labelEn: newDocTypeLabelEn.trim() || undefined }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || t('msg.saveFailed')); }
      toast({ title: t('msg.saved'), description: newDocTypeCode.toUpperCase() });
      setShowAddDocType(false);
      setNewDocTypeCode(''); setNewDocTypeLabel(''); setNewDocTypeLabelEn('');
      onRefreshDocTypes();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
  };

  const handleSaveDocType = async (updated: { id: string; code: string; label: string; labelEn?: string | null }) => {
    try {
      const r = await fetch(`/api/doc-types/${updated.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: updated.label, labelEn: updated.labelEn || null }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || t('msg.saveFailed')); }
      toast({ title: t('msg.saved'), description: updated.code });
      setEditingDocType(null);
      onRefreshDocTypes();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
  };

  const handleWipeData = async () => {
    if (wipePassword !== '0160') {
      toast({ title: t('msg.error'), description: t('msg.wrongPassword'), variant: 'destructive' });
      return;
    }
    setWipeLoading(true);
    try {
      const r = await fetch('/api/wipe-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: wipePassword }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || t('msg.wipeFailed')); }
      const data = await r.json();
      toast({ title: t('msg.wipeSuccess'), description: t('msg.wipeResult', {count: data.wiped?.transmittals || 0}) });
      setShowWipeData(false); setWipePassword('');
      onRefreshDisciplines(); onRefreshCategories(); onRefreshDocTypes();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
    finally { setWipeLoading(false); }
  };

  const handleChooseSavePath = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.chooseSavePath) {
        toast({ title: t('msg.error'), description: t('msg.savePathElectronOnly'), variant: 'destructive' });
        return;
      }
      const chosen = await electronAPI.chooseSavePath();
      if (chosen) {
        localStorage.setItem('nova-save-path', chosen);
        setSavePath(chosen);
        toast({ title: t('msg.savePathUpdated'), description: chosen });
      }
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
  };

  const handleFetchSavePath = async () => {
    try {
      const saved = localStorage.getItem('nova-save-path');
      if (saved) { setSavePath(saved); return; }
      const r = await fetch('/api/config/storage-path');
      if (r.ok) { const d = await r.json(); setSavePath(d.path || ''); }
    } catch {}
  };

  useEffect(() => { handleFetchSavePath(); }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('settings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddCategory(true)} variant="outline" className="gap-1.5">
            <FolderPlus className="w-4 h-4" /> {t('settings.addCategory')}</Button>
          <Button onClick={() => setShowAdd(true)} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Plus className="w-4 h-4" /> {t('settings.addDiscipline')}</Button>
        </div>
      </div>

      {/* Categories Management Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Folder className="w-5 h-5" /> {t('settings.categoriesCount', {count: categories.length})}
          </CardTitle>
          <CardDescription>{t('settings.categoriesHint')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">{t('common.icon')}</TableHead>
              <TableHead className="text-right">{t('common.code')}</TableHead>
              <TableHead className="text-right">{t('common.name')}</TableHead>
              <TableHead className="text-center">{t('settings.disciplinesCount')}</TableHead>
              <TableHead className="text-center">{t('settings.documentsCount')}</TableHead>
              <TableHead className="text-center">{t('common.color')}</TableHead>
              <TableHead className="text-center">{t('common.actions')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="text-2xl">{c.icon}</TableCell>
                  <TableCell className="font-mono font-bold">{c.code}</TableCell>
                  <TableCell>{c.label}</TableCell>
                  <TableCell className="text-center font-semibold">{c.disciplinesCount || 0}</TableCell>
                  <TableCell className="text-center font-semibold">{c.transmittalsCount || 0}</TableCell>
                  <TableCell className="text-center"><div className={`inline-block px-2 py-1 rounded text-xs ${c.color}`}>{t('common.sample')}</div></TableCell>
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
        <CardHeader className="border-b bg-slate-50 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5" /> {t('settings.docTypesCount', {count: docTypes.length})}
            </CardTitle>
            <CardDescription>{t('settings.docTypesHint')}</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddDocType(true)}>
            <Plus className="w-4 h-4" /> {t('settings.addDocType')}</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">{t('common.code')}</TableHead>
              <TableHead className="text-right">{t('common.name')}</TableHead>
              <TableHead className="text-center">{t('settings.documentsCount')}</TableHead>
              <TableHead className="text-center">{t('common.actions')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docTypes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-bold">{item.code}</TableCell>
                  <TableCell>{item.label}</TableCell>
                  <TableCell className="text-center font-semibold">{item.transmittalsCount || 0}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingDocType(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDocType(item.id, item.code)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add DocType Dialog */}
      {showAddDocType && (
        <Dialog open={true} onOpenChange={(v) => !v && setShowAddDocType(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.addDocTypeNew')}</DialogTitle>
              <DialogDescription>{t('settings.addDocTypeHint')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t('field.codeReq')}</Label>
                <Input value={newDocTypeCode} onChange={(e) => setNewDocTypeCode(e.target.value.toUpperCase())} placeholder={t('new.codeExample1')} className="font-mono" maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t('field.nameReq')}</Label>
                <Input value={newDocTypeLabel} onChange={(e) => setNewDocTypeLabel(e.target.value)} placeholder={t('new.typeExample1')} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t('field.nameEn')}</Label>
                <Input value={newDocTypeLabelEn} onChange={(e) => setNewDocTypeLabelEn(e.target.value)} placeholder="Method Statement" dir="ltr" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDocType(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleAddDocType} disabled={!newDocTypeCode || !newDocTypeLabel} className="bg-emerald-700 hover:bg-emerald-800">{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <h3 className="text-lg font-semibold text-slate-700 pt-2">{t('settings.disciplinesByCategory')}</h3>

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
                  <TableHead className="text-right">{t('common.code')}</TableHead>
                  <TableHead className="text-right">{t('common.name')}</TableHead>
                  <TableHead className="text-right">{t('field.prefix')}</TableHead>
                  <TableHead className="text-center">{t('common.color')}</TableHead>
                  <TableHead className="text-center">{t('settings.documentsCount')}</TableHead>
                  <TableHead className="text-center">{t('common.actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {catDisciplines.map((d) => (
                    <TableRow key={d.code}>
                      <TableCell className="font-mono font-bold">{d.code}</TableCell>
                      <TableCell>{d.label}</TableCell>
                      <TableCell className="font-mono text-sm">{d.prefix}</TableCell>
                      <TableCell className="text-center"><div className={`inline-block px-2 py-1 rounded text-xs ${d.color}`}>{t('common.sample')}</div></TableCell>
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
            <p className="text-sm text-slate-700 mb-2"><strong>{t('settings.emptyCategories')}</strong></p>
            <div className="flex flex-wrap gap-2">
              {emptyCats.map(c => (
                <Badge key={c.code} variant="outline" className="text-sm">{c.icon} {c.label}</Badge>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">{t('settings.addDisciplineHint')}</p>
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
      {editingDocType && <EditDocTypeDialog docType={editingDocType} onOpenChange={(v) => !v && setEditingDocType(null)} onSaved={handleSaveDocType} />}

      {/* Advanced Tools Section */}
      <Card className="border-amber-200 bg-amber-50/30 mt-6">
        <CardHeader className="border-b bg-amber-100/40">
          <CardTitle className="text-base flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-5 h-5" /> {t('settings.advancedTools')}
          </CardTitle>
          <CardDescription>{t('settings.advancedToolsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Save Path */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-1">{t('settings.savePathTitle')}</p>
                <p className="text-xs text-slate-500 mb-1">{t('settings.savePathDesc')}</p>
                <p className="text-xs font-mono text-slate-700 truncate" dir="ltr">{savePath || t('settings.savePathDefault')}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleChooseSavePath}>
                <FolderOpen className="w-4 h-4" /> {t('settings.changeSavePath')}
              </Button>
            </div>
          </div>

          {/* Wipe Data */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-1">{t('settings.wipeDataTitle')}</p>
                <p className="text-xs text-red-700">{t('settings.wipeDataDesc')}</p>
              </div>
              <Button size="sm" variant="destructive" className="gap-1.5 shrink-0" onClick={() => setShowWipeData(true)}>
                <Trash2 className="w-4 h-4" /> {t('settings.wipeDataButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wipe Data Confirmation Dialog */}
      {showWipeData && (
        <Dialog open={true} onOpenChange={(v) => !v && setShowWipeData(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> {t('settings.wipeDataDialogTitle')}
              </DialogTitle>
              <DialogDescription>{t('settings.wipeDataDialogDesc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
                {t('confirm.wipeData')}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t('settings.wipePassword')}</Label>
                <Input type="password" value={wipePassword} onChange={(e) => setWipePassword(e.target.value)} placeholder={t('settings.wipePasswordHint')} className="font-mono" autoFocus />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWipeData(false)}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={handleWipeData} disabled={wipeLoading || !wipePassword} className="gap-1.5">
                {wipeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('settings.wipeDataConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ============ EDIT DOC TYPE DIALOG ============ */
function EditDocTypeDialog({ docType, onOpenChange, onSaved }: {
  docType: { id: string; code: string; label: string; labelEn?: string | null };
  onOpenChange: (v: boolean) => void;
  onSaved: (updated: { id: string; code: string; label: string; labelEn?: string | null }) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState(docType.label);
  const [labelEn, setLabelEn] = useState(docType.labelEn || '');

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.editDocType')} — {docType.code}</DialogTitle>
          <DialogDescription>{t('settings.editDocTypeDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.codeReq')}</Label>
            <Input value={docType.code} disabled className="font-mono bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameReq')}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameEn')}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Method Statement" dir="ltr" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => onSaved({ id: docType.id, code: docType.code, label, labelEn })} disabled={!label} className="bg-emerald-700 hover:bg-emerald-800">{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDisciplineDialog({ open, onOpenChange, onSaved, categories }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; categories?: Category[] }) {
  const { t, lang } = useI18n();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [prefix, setPrefix] = useState('');
  const [color, setColor] = useState('bg-gray-100 text-gray-700');
  const [category, setCategory] = useState('TRANSMITTAL');
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setCode(''); setLabel(''); setLabelEn(''); setPrefix(''); setColor('bg-gray-100 text-gray-700'); setCategory('TRANSMITTAL'); setExtraCategories([]); }
  }, [open]);

  const colorOptions = [
    { value: 'bg-gray-100 text-gray-700', label: t('color.gray') },
    { value: 'bg-amber-100 text-amber-700', label: t('color.amber') },
    { value: 'bg-purple-100 text-purple-700', label: t('color.purple') },
    { value: 'bg-cyan-100 text-cyan-700', label: t('color.cyan') },
    { value: 'bg-rose-100 text-rose-700', label: t('color.rose') },
    { value: 'bg-red-100 text-red-700', label: t('color.red') },
    { value: 'bg-emerald-100 text-emerald-700', label: t('color.green') },
    { value: 'bg-blue-100 text-blue-700', label: t('color.blue') },
    { value: 'bg-indigo-100 text-indigo-700', label: t('color.indigo') },
    { value: 'bg-orange-100 text-orange-700', label: t('color.orange') },
  ];

  const handleSave = async () => {
    if (!code || !label || !prefix) {
      toast({ title: t('msg.error'), description: t('msg.allFieldsRequired'), variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const allCategories = [category, ...extraCategories.filter(c => c !== category)];
      const r = await fetch('/api/disciplines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), label, labelEn: labelEn || undefined, prefix, color, category, categories: allCategories }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.saveFailed')); }
      toast({ title: t('msg.disciplineAdded'), description: `${code.toUpperCase()} - ${label}` });
      onSaved();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (code && !prefix) setPrefix(`${code.toUpperCase()}-`);
  }, [code, prefix]);

  const toggleExtraCategory = (catCode: string) => {
    if (catCode === category) return;
    setExtraCategories(prev => prev.includes(catCode) ? prev.filter(c => c !== catCode) : [...prev, catCode]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('settings.addDisciplineNew')}</DialogTitle>
          <DialogDescription>{t('settings.addDisciplineMultiHint')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.defaultCategoryReq')}</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setExtraCategories(prev => prev.filter(c => c !== v)); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categories || (CATEGORIES as any)).map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {(lang === 'en' && c.labelEn) ? c.labelEn : c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.extraCategories')}</Label>
            <p className="text-xs text-slate-500">{t('field.linkToCategories')}</p>
            <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
              {(categories || (CATEGORIES as any)).filter((c: any) => c.code !== category).map((c: any) => (
                <label key={c.code} className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                  <input type="checkbox" checked={extraCategories.includes(c.code)} onChange={() => toggleExtraCategory(c.code)} className="w-3 h-3" />
                  <span>{c.icon}</span>
                  <span>{(lang === 'en' && c.labelEn) ? c.labelEn : c.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.codeReq')}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ELV" className="font-mono" maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.nameArReq')}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('discipline.elevators')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameEn')}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Elevators" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.prefixReq')}</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="ELV-" className="font-mono" />
            <p className="text-xs text-slate-500">{t('common.example')}<code className="bg-slate-100 px-1 rounded">{prefix || 'CIV-'}171</code></p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.color')}</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className={`inline-block px-3 py-1.5 rounded text-sm mt-1 ${color}`}>{t('settings.colorPreview')}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? t('msg.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDisciplineDialog({ discipline, onOpenChange, onSaved, categories }: { discipline: Discipline; onOpenChange: (v: boolean) => void; onSaved: () => void; categories?: Category[] }) {
  const { t, lang } = useI18n();
  const [label, setLabel] = useState(discipline.label);
  const [labelEn, setLabelEn] = useState((discipline as any).labelEn || '');
  const [prefix, setPrefix] = useState(discipline.prefix);
  const [color, setColor] = useState(discipline.color);
  const [category, setCategory] = useState(discipline.category || 'TRANSMITTAL');
  const [extraCategories, setExtraCategories] = useState<string[]>(
    Array.isArray((discipline as any).allCategories)
      ? (discipline as any).allCategories.filter((c: string) => c !== (discipline.category || 'TRANSMITTAL'))
      : []
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const colorOptions = [
    { value: 'bg-gray-100 text-gray-700', label: t('color.gray') },
    { value: 'bg-amber-100 text-amber-700', label: t('color.amber') },
    { value: 'bg-purple-100 text-purple-700', label: t('color.purple') },
    { value: 'bg-cyan-100 text-cyan-700', label: t('color.cyan') },
    { value: 'bg-rose-100 text-rose-700', label: t('color.rose') },
    { value: 'bg-red-100 text-red-700', label: t('color.red') },
    { value: 'bg-emerald-100 text-emerald-700', label: t('color.green') },
    { value: 'bg-blue-100 text-blue-700', label: t('color.blue') },
    { value: 'bg-indigo-100 text-indigo-700', label: t('color.indigo') },
    { value: 'bg-orange-100 text-orange-700', label: t('color.orange') },
  ];

  const toggleExtraCategory = (catCode: string) => {
    if (catCode === category) return;
    setExtraCategories(prev => prev.includes(catCode) ? prev.filter(c => c !== catCode) : [...prev, catCode]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allCategories = [category, ...extraCategories.filter(c => c !== category)];
      const r = await fetch(`/api/disciplines/${discipline.code}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, labelEn: labelEn || null, prefix, color, category, categories: allCategories }),
      });
      if (!r.ok) throw new Error(t('msg.saveFailed'));
      toast({ title: t('msg.updated'), description: `${discipline.code}` });
      onSaved();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('settings.editDiscipline', {code: discipline.code})}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.mainCategory')}</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setExtraCategories(prev => prev.filter(c => c !== v)); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categories || CATEGORIES).map(c => <SelectItem key={c.code} value={c.code}>{c.icon} {(lang === 'en' && (c as any).labelEn) ? (c as any).labelEn : c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.extraCategories')}</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
              {(categories || CATEGORIES).filter((c: any) => c.code !== category).map((c: any) => (
                <label key={c.code} className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                  <input type="checkbox" checked={extraCategories.includes(c.code)} onChange={() => toggleExtraCategory(c.code)} className="w-3 h-3" />
                  <span>{c.icon}</span>
                  <span>{(lang === 'en' && c.labelEn) ? c.labelEn : c.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameAr')}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameEn')}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Elevators" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.prefix')}</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.color')}</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? t('msg.saving') : t('common.save')}</Button>
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
  const { t, lang } = useI18n();
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
            {t('dialog.sendToMohTitle', {ref: target.reference})}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.sendToMohDesc', {rev: target.latestRev})}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            <p className="text-sm text-blue-900">
              <strong>{t('detail.reference')}</strong> <span className="font-mono">{target.reference}</span>
            </p>
            <p className="text-sm text-blue-900">
              <strong>{t('dialog.sentRevisionAuto')}</strong> REV.{target.latestRev}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.mohSubmitDateReq')}</Label>
            <Input
              type="date"
              value={submitDate}
              onChange={(e) => setSubmitDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.notesOptional')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('field.submitNotes')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !submitDate}
            className="bg-blue-700 hover:bg-blue-800 gap-1.5"
          >
            <Send className="w-4 h-4" />
            {saving ? t('msg.sending') : t('dialog.sendRevToMoh', {rev: target.latestRev})}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ ADD CATEGORY DIALOG ============ */
function AddCategoryDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [icon, setIcon] = useState('📄');
  const [color, setColor] = useState('bg-blue-100 text-blue-700');
  const [template, setTemplate] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setCode(''); setLabel(''); setLabelEn(''); setIcon('📄'); setColor('bg-blue-100 text-blue-700'); setTemplate(null); }
  }, [open]);

  const iconOptions = ['📄', '🔍', '❓', '📚', '📋', '📝', '🏗️', '⚡', '🔥', '💧', '❄️', '📡', '🚪', '🛡️', '🔧', '📦'];
  const colorOptions = [
    { value: 'bg-blue-100 text-blue-700', label: t('color.blue') },
    { value: 'bg-orange-100 text-orange-700', label: t('color.orange') },
    { value: 'bg-purple-100 text-purple-700', label: t('color.purple') },
    { value: 'bg-emerald-100 text-emerald-700', label: t('color.green') },
    { value: 'bg-red-100 text-red-700', label: t('color.red') },
    { value: 'bg-amber-100 text-amber-700', label: t('color.amber') },
    { value: 'bg-cyan-100 text-cyan-700', label: t('color.cyan') },
    { value: 'bg-rose-100 text-rose-700', label: t('color.rose') },
    { value: 'bg-indigo-100 text-indigo-700', label: t('color.indigo') },
    { value: 'bg-gray-100 text-gray-700', label: t('color.gray') },
  ];

  const handleSave = async () => {
    if (!code || !label) {
      toast({ title: t('msg.error'), description: t('msg.codeLabelRequired'), variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      // Use FormData if template file is provided, otherwise JSON
      if (template) {
        const fd = new FormData();
        fd.append('code', code.toUpperCase());
        fd.append('label', label);
        fd.append('labelEn', labelEn);
        fd.append('icon', icon);
        fd.append('color', color);
        fd.append('template', template);
        const r = await fetch('/api/categories', { method: 'POST', body: fd });
        if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.saveFailed')); }
      } else {
        const r = await fetch('/api/categories', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code.toUpperCase(), label, labelEn: labelEn || undefined, icon, color }),
        });
        if (!r.ok) { const err = await r.json(); throw new Error(err.error || t('msg.saveFailed')); }
      }
      toast({ title: t('msg.saved'), description: `${code.toUpperCase()} - ${label}` });
      onSaved();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('settings.addCategoryNew')}</DialogTitle>
          <DialogDescription>{t('settings.addCategoryHint')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.codeReq')}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('new.codeExample2')} className="font-mono" maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.nameReq')}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('new.typeExample2')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameEn')}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Method Statements" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.icon')}</Label>
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
            <Label className="text-sm">{t('common.color')}</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className={`inline-block px-3 py-1.5 rounded text-sm mt-1 ${color}`}>{icon} معاينة</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('settings.templateOptional')}</Label>
            <input
              type="file"
              accept=".xlsx,.xlsm,.docx,.doc,.pdf,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setTemplate(f);
                else setTemplate(null);
              }}
              className="block w-full text-sm text-slate-500
                file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0
                file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700
                hover:file:bg-emerald-100 cursor-pointer"
            />
            {template && (
              <p className="text-xs text-emerald-700 flex items-center gap-1">
                ✓ {template.name} ({(template.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <p className="text-xs text-slate-500">{t('settings.templateHint')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? t('msg.saving') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ EDIT CATEGORY DIALOG ============ */
function EditCategoryDialog({ category, onOpenChange, onSaved }: { category: Category; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [label, setLabel] = useState(category.label);
  const [labelEn, setLabelEn] = useState((category as any).labelEn || '');
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);
  const [template, setTemplate] = useState<File | null>(null);
  const [removeTemplate, setRemoveTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const iconOptions = ['📄', '🔍', '❓', '📚', '📋', '📝', '🏗️', '⚡', '🔥', '💧', '❄️', '📡', '🚪', '🛡️', '🔧', '📦'];
  const colorOptions = [
    { value: 'bg-blue-100 text-blue-700', label: t('color.blue') },
    { value: 'bg-orange-100 text-orange-700', label: t('color.orange') },
    { value: 'bg-purple-100 text-purple-700', label: t('color.purple') },
    { value: 'bg-emerald-100 text-emerald-700', label: t('color.green') },
    { value: 'bg-red-100 text-red-700', label: t('color.red') },
    { value: 'bg-amber-100 text-amber-700', label: t('color.amber') },
    { value: 'bg-cyan-100 text-cyan-700', label: t('color.cyan') },
    { value: 'bg-rose-100 text-rose-700', label: t('color.rose') },
    { value: 'bg-indigo-100 text-indigo-700', label: t('color.indigo') },
    { value: 'bg-gray-100 text-gray-700', label: t('color.gray') },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      // Use FormData if template file is provided or removal requested
      if (template || removeTemplate) {
        const fd = new FormData();
        fd.append('label', label);
        fd.append('labelEn', labelEn);
        fd.append('icon', icon);
        fd.append('color', color);
        if (template) fd.append('template', template);
        if (removeTemplate) fd.append('removeTemplate', 'true');
        const r = await fetch(`/api/categories/${category.code}`, { method: 'PATCH', body: fd });
        if (!r.ok) throw new Error(t('msg.saveFailed'));
      } else {
        const r = await fetch(`/api/categories/${category.code}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, labelEn, icon, color }),
        });
        if (!r.ok) throw new Error(t('msg.saveFailed'));
      }
      toast({ title: t('msg.updated'), description: category.code });
      onSaved();
    } catch (e: any) { toast({ title: t('msg.error'), description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('settings.editCategory', {code: category.code})}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.name')}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.nameEn')}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Method Statements" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.icon')}</Label>
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
            <Label className="text-sm">{t('common.color')}</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.template')}</Label>
            {(category as any).templatePath && !removeTemplate ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-sm text-emerald-700 flex items-center gap-1">
                  ✓ قالب مخصص محفوظ ({(category as any).templateType || t('common.unknown')})
                </span>
                <Button size="sm" variant="ghost" onClick={() => setRemoveTemplate(true)} className="text-red-600">
                  {t('settings.deleteTemplate')}</Button>
              </div>
            ) : removeTemplate ? (
              <p className="text-sm text-amber-700">{t('settings.deleteTemplateHint')}</p>
            ) : (
              <input
                type="file"
                accept=".xlsx,.xlsm,.docx,.doc,.pdf,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setTemplate(f);
                }}
                className="block w-full text-sm text-slate-500
                  file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0
                  file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700
                  hover:file:bg-emerald-100 cursor-pointer"
              />
            )}
            {template && (
              <p className="text-xs text-emerald-700">✓ {template.name} ({(template.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">{saving ? t('msg.saving') : t('common.save')}</Button>
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
  const { t, lang } = useI18n();
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!submitDate) return;
    setSaving(true);
    // Only submit date + notes — action/replyDate are recorded via ConsultantReplyDialog
    await onConfirm(submitDate, '', '', '', notes);
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-700" />
            {t('dialog.registerRevisionTitle', {ref: target.reference})}
          </DialogTitle>
          <DialogDescription>
            {t('field.submitDateOnlyHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>{t('detail.reference')}</strong> <span className="font-mono">{target.reference}</span> ·
              <strong> {t('detail.newRevision')}</strong> REV.{target.nextRev}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('field.submitDateReq')}</Label>
            <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t('common.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('field.notesExtra')} />
          </div>

          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
            {t('dialog.addRevisionNote')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={saving || !submitDate} className="bg-blue-700 hover:bg-blue-800 gap-1.5">
            <History className="w-4 h-4" />
            {saving ? t('msg.registering') : t('msg.registerRev', {rev: target.nextRev})}
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
  const { t, lang } = useI18n();
  const [replyDate, setReplyDate] = useState(new Date().toISOString().slice(0, 10));
  const [action, setAction] = useState('');
  const [approvalType, setApprovalType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!replyDate || !action) {
      alert(t('dialog.replyRequiredFields'));
      return;
    }
    if (action === 'approved' && !approvalType) {
      alert(t('dialog.approvalTypeRequired'));
      return;
    }
    setSaving(true);
    await onConfirm(replyDate, action, approvalType, notes || '');
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
            {t('dialog.consultantReplyTitle', {ref: target.reference})}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.consultantReplyDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm text-emerald-900">
              <strong>{t('detail.reference')}</strong> <span className="font-mono">{target.reference}</span> ·
              سيتم تحديث آخر ريفجن تلقائياً
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.replyDateReq')}</Label>
              <Input type="date" value={replyDate} onChange={(e) => setReplyDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.actionReq')}</Label>
              <Select value={action} onValueChange={handleActionChange}>
                <SelectTrigger><SelectValue placeholder={t('field.selectAction')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✅ {t('status.approved_short')}</SelectItem>
                  <SelectItem value="rejected">❌ {t('status.rejected')}</SelectItem>
                  <SelectItem value="withdrawn">🚫 {t('status.cancelled_short')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Approval type sub-dropdown — only visible when action=approved */}
          {action === 'approved' && (
            <div className="space-y-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-emerald-800">{t('field.acceptTypeReq')}</Label>
              <Select value={approvalType} onValueChange={setApprovalType}>
                <SelectTrigger className="!w-full !h-auto !min-h-[36px] !whitespace-normal !break-words text-left [&_[data-slot=select-value]]:!line-clamp-none [&_[data-slot=select-value]]:!whitespace-normal [&_[data-slot=select-value]]:!break-words"><SelectValue placeholder={t('field.selectAcceptType')} className="whitespace-normal break-words leading-snug" /></SelectTrigger>
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
            <Label className="text-sm">{t('field.notesOptional')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('field.consultantNotes')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={saving || !replyDate || !action || (action === 'approved' && !approvalType)} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Building2 className="w-4 h-4" />
            {saving ? t('msg.registering') : t('button.registerReply')}
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
  const { t, lang } = useI18n();
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
            {t('dialog.mohReplyTitle', {ref: target.reference})}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.mohReplyDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-900">
              <strong>{t('detail.reference')}</strong> <span className="font-mono">{target.reference}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.mohReplyDateReq')}</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('field.replyStatusReq')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder={t('field.selectStatus')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">{`✅ ${t('status.approved_short')}`}</SelectItem>
                  <SelectItem value="Rejected">❌ {t('status.rejected')}</SelectItem>
                  <SelectItem value="Under Review">⏳ {t('status.underReview')}</SelectItem>
                  <SelectItem value="Cancelled">{`🚫 ${t('status.cancelled_short')}`}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.notesOptional')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('field.mohNotes')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={saving || !reviewDate || !status} className="bg-purple-700 hover:bg-purple-800 gap-1.5">
            <Hospital className="w-4 h-4" />
            {saving ? t('msg.registering') : t('button.registerMohReply')}
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
  const { t, lang } = useI18n();
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
            {t('dialog.copyTransmittal', {ref: target.reference})}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.copyDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm text-emerald-900">
              <strong>{t('detail.source')}</strong> <span className="font-mono">{target.reference}</span> ·
              سيتم إنشاء مرجع جديد تلقائياً
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t('field.descEditable')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t('new.descPlaceholder')}
              autoFocus
            />
            <p className="text-xs text-slate-500">{t('dialog.copyDescShort')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 gap-1.5">
            <Copy className="w-4 h-4" />
            {saving ? t('msg.copying') : t('detail.copyNew')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
