/**
 * Status computation helper — replicates LOG_Final.xlsm logic
 * Tracks Consultant status and MOH status separately
 *
 * IMPORTANT: status codes are language-neutral. The UI is responsible for
 * translating them via t(`status.${status}`) with dynamic params (e.g. days).
 */

export type ComputedStatus = {
  status: string;     // e.g. "approved", "pending", "overdue", "cancelled"
  statusKey: string;  // i18n key, e.g. "status.approved"
  label: string;      // fallback Arabic label (used by API for backward compat)
  color: string;      // tailwind classes for badge
  emoji: string;
  daysOpen?: number;  // for overdue/pending statuses
};

const CONSULTANT_OVERDUE_DAYS = 14;
const MOH_OVERDUE_DAYS = 30;

// Approval types (consultant action codes A-E)
export const APPROVAL_TYPES = [
  { code: 'APPROVED',                     label: 'APPROVED',                     letter: 'A', description: 'معتمد' },
  { code: 'APPROVED_AS_NOTED',            label: 'APPROVED AS NOTED',            letter: 'B', description: 'معتمد بملاحظات' },
  { code: 'APPROVED_AS_NOTED_RESUBMIT',   label: 'APPROVED AS NOTED & RESUBMIT', letter: 'C', description: 'معتمد بملاحظات وإعادة إرسال' },
  { code: 'NOT_APPROVED',                 label: 'NOT APPROVED',                 letter: 'D', description: 'غير معتمد' },
  { code: 'FOR_INFORMATION',              label: 'FOR INFORMATION / MORE INFO. REQUIRED', letter: 'E', description: 'للمعلومات / مطلوب معلومات إضافية' },
] as const;

export function getApprovalTypeLabel(code: string | null | undefined): string {
  if (!code) return '';
  return APPROVAL_TYPES.find(a => a.code === code)?.label || code;
}

export function getApprovalTypeLetter(code: string | null | undefined): string {
  if (!code) return '';
  return APPROVAL_TYPES.find(a => a.code === code)?.letter || '';
}

export function getApprovalTypeDescription(code: string | null | undefined): string {
  if (!code) return '';
  return APPROVAL_TYPES.find(a => a.code === code)?.description || '';
}

/**
 * Compute Consultant status based on the latest revision's action/reply.
 * Returns ComputedStatus with language-neutral `status` field + Arabic fallback `label`.
 */
export function computeConsultantStatus(
  revisions: { submitDate: Date | null; replyDate: Date | null; action: string | null; approvalType?: string | null }[],
  consultantReview?: { status: string | null; reviewDate: Date | null } | null,
): ComputedStatus {
  if (consultantReview?.status === 'Cancelled' || consultantReview?.status === '🚫 Cancelled') {
    return { status: 'cancelled', statusKey: 'status.cancelled', label: 'ملغى', color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '🚫' };
  }

  const activeRevs = revisions.filter(r => r.submitDate !== null);
  if (activeRevs.length === 0) {
    return { status: 'draft', statusKey: 'status.draft', label: 'مسودة', color: 'bg-gray-100 text-gray-600 border-gray-300', emoji: '📝' };
  }

  const lastRev = activeRevs[activeRevs.length - 1];
  const action = (lastRev.action || '').toLowerCase().trim();
  const approvalType = lastRev.approvalType || '';

  if (action === 'approved') {
    if (approvalType === 'NOT_APPROVED') {
      return { status: 'rejected', statusKey: 'status.rejected_d', label: 'غير معتمد (D)', color: 'bg-red-100 text-red-700 border-red-300', emoji: '❌' };
    }
    if (approvalType === 'FOR_INFORMATION') {
      return { status: 'resubmit', statusKey: 'status.info_e', label: 'للمعلومات (E)', color: 'bg-orange-100 text-orange-700 border-orange-300', emoji: '🔔' };
    }
    if (approvalType === 'APPROVED_AS_NOTED_RESUBMIT') {
      return { status: 'resubmit', statusKey: 'status.approved_c', label: 'معتمد بملاحظات وإعادة (C)', color: 'bg-orange-100 text-orange-700 border-orange-300', emoji: '✅' };
    }
    if (approvalType === 'APPROVED_AS_NOTED') {
      return { status: 'approved', statusKey: 'status.approved_b', label: 'معتمد بملاحظات (B)', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
    }
    return { status: 'approved', statusKey: 'status.approved_a', label: 'معتمد (A)', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  if (consultantReview?.status === 'Approved' || consultantReview?.status === '✅ Approved') {
    return { status: 'approved', statusKey: 'status.approved', label: 'معتمد', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  if (action === 'withdrawn') {
    return { status: 'cancelled', statusKey: 'status.cancelled', label: 'ملغى', color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '🚫' };
  }

  if (lastRev.replyDate === null && lastRev.submitDate) {
    const daysOpen = Math.floor((Date.now() - new Date(lastRev.submitDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOpen > CONSULTANT_OVERDUE_DAYS) {
      return { status: 'overdue', statusKey: 'status.overdue_days', label: `متأخر (${daysOpen}ي)`, color: 'bg-red-100 text-red-700 border-red-300', emoji: '🔴', daysOpen };
    }
    return { status: 'pending', statusKey: 'status.pending_reply', label: 'بانتظار الرد', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '⏳' };
  }

  if (action === 'rejected') {
    return { status: 'resubmit', statusKey: 'status.resubmit', label: 'إعادة إرسال', color: 'bg-orange-100 text-orange-700 border-orange-300', emoji: '🔔' };
  }

  // Backward compat: old imported data may have action='pending'
  if (action === 'pending') {
    if (lastRev.replyDate === null && lastRev.submitDate) {
      const daysOpen = Math.floor((Date.now() - new Date(lastRev.submitDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOpen > CONSULTANT_OVERDUE_DAYS) {
        return { status: 'overdue', statusKey: 'status.overdue_days', label: `متأخر (${daysOpen}ي)`, color: 'bg-red-100 text-red-700 border-red-300', emoji: '🔴', daysOpen };
      }
    }
    return { status: 'pending', statusKey: 'status.pending_reply', label: 'بانتظار الرد', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '⏳' };
  }

  return { status: 'pending', statusKey: 'status.pending_review', label: 'قيد المراجعة', color: 'bg-blue-100 text-blue-700 border-blue-300', emoji: '⏳' };
}

/**
 * Compute MOH status based on the MOH review
 */
export function computeMohStatus(
  mohReview?: { status: string | null; submitDate: Date | null; reviewDate: Date | null; submitRev: number | null } | null,
): ComputedStatus {
  if (!mohReview || !mohReview.submitDate) {
    return { status: 'not_sent', statusKey: 'status.moh_not_sent', label: 'لم يُرسل', color: 'bg-gray-100 text-gray-600 border-gray-300', emoji: '📭' };
  }

  if (mohReview.status === 'Approved' || mohReview.status === '✅ Approved') {
    return { status: 'approved', statusKey: 'status.moh_approved', label: 'معتمد بالوزارة', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  if (mohReview.status === 'Cancelled' || mohReview.status === '🚫 Cancelled') {
    return { status: 'cancelled', statusKey: 'status.cancelled', label: 'ملغى', color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '🚫' };
  }

  if (mohReview.reviewDate) {
    if (mohReview.status === 'Rejected' || mohReview.status === '❌ Rejected') {
      return { status: 'rejected', statusKey: 'status.moh_rejected', label: 'مرفوض بالوزارة', color: 'bg-red-100 text-red-700 border-red-300', emoji: '❌' };
    }
    return { status: 'reviewed', statusKey: 'status.moh_reviewed', label: 'تمت المراجعة', color: 'bg-blue-100 text-blue-700 border-blue-300', emoji: '📋' };
  }

  const daysOpen = Math.floor((Date.now() - new Date(mohReview.submitDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysOpen > MOH_OVERDUE_DAYS) {
    return { status: 'overdue', statusKey: 'status.moh_overdue', label: `متأخر بالوزارة (${daysOpen}ي)`, color: 'bg-red-100 text-red-700 border-red-300', emoji: '🔴', daysOpen };
  }

  return { status: 'under_review', statusKey: 'status.moh_under_review', label: `قيد المراجعة (${daysOpen}ي)`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '⏳', daysOpen };
}

/**
 * Combined overall status
 */
export function computeOverallStatus(
  revisions: { submitDate: Date | null; replyDate: Date | null; action: string | null; approvalType?: string | null }[],
  consultantReview?: { status: string | null; reviewDate: Date | null } | null,
  mohReview?: { status: string | null; submitDate: Date | null; reviewDate: Date | null; submitRev: number | null } | null,
): ComputedStatus {
  const consultant = computeConsultantStatus(revisions, consultantReview);
  const moh = computeMohStatus(mohReview);

  if (consultant.status === 'cancelled') return consultant;

  if (consultant.status === 'approved' && moh.status === 'not_sent') {
    return consultant;
  }

  if (moh.status === 'overdue') return moh;
  if (consultant.status === 'overdue') return consultant;

  if (consultant.status === 'approved' && moh.status === 'approved') {
    return { status: 'approved', statusKey: 'status.overall_approved', label: 'معتمد بالكل', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  return consultant;
}

// Fallback
export function computeStatus(
  revisions: { submitDate: Date | null; replyDate: Date | null; action: string | null; approvalType?: string | null }[],
  consultantStatus?: string | null,
  mohStatus?: string | null,
): ComputedStatus {
  return computeOverallStatus(
    revisions,
    consultantStatus ? { status: consultantStatus, reviewDate: null } : null,
    mohStatus ? { status: mohStatus, submitDate: null, reviewDate: null, submitRev: null } : null,
  );
}

/**
 * Get color for a revision number — each revision gets a distinct color.
 * Colors cycle through a palette so they're visually distinguishable.
 */
export function getRevisionColor(revNumber: number): string {
  const colors = [
    'bg-blue-100 text-blue-700 border-blue-300',       // REV.0
    'bg-emerald-100 text-emerald-700 border-emerald-300', // REV.1
    'bg-amber-100 text-amber-700 border-amber-300',    // REV.2
    'bg-purple-100 text-purple-700 border-purple-300', // REV.3
    'bg-rose-100 text-rose-700 border-rose-300',       // REV.4
    'bg-cyan-100 text-cyan-700 border-cyan-300',       // REV.5
    'bg-indigo-100 text-indigo-700 border-indigo-300', // REV.6
    'bg-orange-100 text-orange-700 border-orange-300', // REV.7
  ];
  return colors[revNumber % colors.length];
}

// Default disciplines (used as fallback when DB is not yet seeded)
export const DEFAULT_DISCIPLINES = [
  { code: 'CIV',  label: 'المدنية',     color: 'bg-amber-100 text-amber-700',   prefix: 'CIV-',  categoryCode: 'TRANSMITTAL' },
  { code: 'EL',   label: 'الكهربائية',  color: 'bg-purple-100 text-purple-700', prefix: 'EL-',   categoryCode: 'TRANSMITTAL' },
  { code: 'PL',   label: 'الصحي',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'PL-',   categoryCode: 'TRANSMITTAL' },
  { code: 'HVAC', label: 'التكييف',     color: 'bg-rose-100 text-rose-700',     prefix: 'HAVC-', categoryCode: 'TRANSMITTAL' },
  { code: 'FF',   label: 'الحريق',      color: 'bg-red-100 text-red-700',       prefix: 'FF-',   categoryCode: 'TRANSMITTAL' },
  { code: 'ELVE', label: 'المصاعد',     color: 'bg-emerald-100 text-emerald-700', prefix: 'ELEV ', categoryCode: 'TRANSMITTAL' },
];

export const DEFAULT_CATEGORIES = [
  { code: 'TRANSMITTAL', label: 'ترانسميتال', icon: '📤', color: 'bg-blue-100 text-blue-700' },
  { code: 'MIR',         label: 'MIR',        icon: '📋', color: 'bg-purple-100 text-purple-700' },
  { code: 'RFI',         label: 'RFI',        icon: '❓', color: 'bg-orange-100 text-orange-700' },
  { code: 'LETTERS',     label: 'كتب',        icon: '✉️', color: 'bg-emerald-100 text-emerald-700' },
];

// Backward-compat aliases
export const CATEGORIES = DEFAULT_CATEGORIES;
export const DISCIPLINES = DEFAULT_DISCIPLINES;

export function getCategoryLabel(code: string, categories?: { code: string; label: string }[]): string {
  if (categories && categories.length > 0) {
    const c = categories.find(c => c.code === code);
    if (c) return c.label;
  }
  return DEFAULT_CATEGORIES.find(c => c.code === code)?.label ?? code;
}

export function getCategoryColor(code: string, categories?: { code: string; color: string }[]): string {
  if (categories && categories.length > 0) {
    const c = categories.find(c => c.code === code);
    if (c) return c.color;
  }
  return DEFAULT_CATEGORIES.find(c => c.code === code)?.color ?? 'bg-gray-100 text-gray-700';
}

export function getCategoryIcon(code: string, categories?: { code: string; icon: string }[]): string {
  if (categories && categories.length > 0) {
    const c = categories.find(c => c.code === code);
    if (c) return c.icon;
  }
  return DEFAULT_CATEGORIES.find(c => c.code === code)?.icon ?? '📄';
}

export function getDisciplineLabel(code: string, disciplines?: { code: string; label: string }[]): string {
  if (disciplines && disciplines.length > 0) {
    const d = disciplines.find(d => d.code === code);
    if (d) return d.label;
  }
  return DEFAULT_DISCIPLINES.find(d => d.code === code)?.label ?? code;
}

export function getDisciplineColor(code: string, disciplines?: { code: string; color: string }[]): string {
  if (disciplines && disciplines.length > 0) {
    const d = disciplines.find(d => d.code === code);
    if (d) return d.color;
  }
  return DEFAULT_DISCIPLINES.find(d => d.code === code)?.color ?? 'bg-gray-100 text-gray-700';
}

export function getDisciplinePrefix(code: string, disciplines?: { code: string; prefix: string }[]): string {
  if (disciplines && disciplines.length > 0) {
    const d = disciplines.find(d => d.code === code);
    if (d) return d.prefix;
  }
  return DEFAULT_DISCIPLINES.find(d => d.code === code)?.prefix ?? `${code}-`;
}
