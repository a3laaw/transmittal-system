/**
 * Status computation helper — replicates LOG_Final.xlsm logic
 * Tracks Consultant status and MOH status separately
 */

export type ComputedStatus = {
  status: string;
  label: string;
  color: string; // tailwind classes for badge
  emoji: string;
};

const CONSULTANT_OVERDUE_DAYS = 14;
const MOH_OVERDUE_DAYS = 30; // MOH usually takes longer

// Approval types (consultant action codes A-E from the original Excel template)
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
 * Compute Consultant status based on the latest revision's action/reply
 */
export function computeConsultantStatus(
  revisions: { submitDate: Date | null; replyDate: Date | null; action: string | null; approvalType?: string | null }[],
  consultantReview?: { status: string | null; reviewDate: Date | null } | null,
): ComputedStatus {
  if (consultantReview?.status === 'Cancelled' || consultantReview?.status === '🚫 Cancelled') {
    return { status: 'cancelled', label: 'ملغى', color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '🚫' };
  }

  const activeRevs = revisions.filter(r => r.submitDate !== null);
  if (activeRevs.length === 0) {
    return { status: 'draft', label: 'مسودة', color: 'bg-gray-100 text-gray-600 border-gray-300', emoji: '📝' };
  }

  const lastRev = activeRevs[activeRevs.length - 1];
  const action = (lastRev.action || '').toLowerCase().trim();
  const approvalType = lastRev.approvalType || '';

  // Approved — but check approval type: NOT_APPROVED (D) and FOR_INFORMATION (E) are not really "approved"
  if (action === 'approved') {
    if (approvalType === 'NOT_APPROVED') {
      return { status: 'rejected', label: 'غير معتمد (D)', color: 'bg-red-100 text-red-700 border-red-300', emoji: '❌' };
    }
    if (approvalType === 'FOR_INFORMATION') {
      return { status: 'resubmit', label: 'للمعلومات (E)', color: 'bg-orange-100 text-orange-700 border-orange-300', emoji: '🔔' };
    }
    if (approvalType === 'APPROVED_AS_NOTED_RESUBMIT') {
      return { status: 'resubmit', label: 'معتمد بملاحظات وإعادة (C)', color: 'bg-orange-100 text-orange-700 border-orange-300', emoji: '✅' };
    }
    if (approvalType === 'APPROVED_AS_NOTED') {
      return { status: 'approved', label: 'معتمد بملاحظات (B)', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
    }
    return { status: 'approved', label: 'معتمد (A)', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  if (consultantReview?.status === 'Approved' || consultantReview?.status === '✅ Approved') {
    return { status: 'approved', label: 'معتمد', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  if (action === 'withdrawn') {
    return { status: 'cancelled', label: 'ملغى', color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '🚫' };
  }

  if (lastRev.replyDate === null && lastRev.submitDate) {
    const daysOpen = Math.floor((Date.now() - new Date(lastRev.submitDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOpen > CONSULTANT_OVERDUE_DAYS) {
      return { status: 'overdue', label: `متأخر (${daysOpen}ي)`, color: 'bg-red-100 text-red-700 border-red-300', emoji: '🔴' };
    }
    return { status: 'pending', label: 'بانتظار الرد', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '⏳' };
  }

  if (action === 'rejected') {
    return { status: 'resubmit', label: 'إعادة إرسال', color: 'bg-orange-100 text-orange-700 border-orange-300', emoji: '🔔' };
  }

  // Backward compat: old imported data may have action='pending'
  if (action === 'pending') {
    if (lastRev.replyDate === null && lastRev.submitDate) {
      const daysOpen = Math.floor((Date.now() - new Date(lastRev.submitDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOpen > CONSULTANT_OVERDUE_DAYS) {
        return { status: 'overdue', label: `متأخر (${daysOpen}ي)`, color: 'bg-red-100 text-red-700 border-red-300', emoji: '🔴' };
      }
    }
    return { status: 'pending', label: 'بانتظار الرد', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '⏳' };
  }

  return { status: 'pending', label: 'قيد المراجعة', color: 'bg-blue-100 text-blue-700 border-blue-300', emoji: '⏳' };
}

/**
 * Compute MOH status based on the MOH review (when was it sent, was there a reply?)
 */
export function computeMohStatus(
  mohReview?: { status: string | null; submitDate: Date | null; reviewDate: Date | null; submitRev: number | null } | null,
): ComputedStatus {
  if (!mohReview || !mohReview.submitDate) {
    return { status: 'not_sent', label: 'لم يُرسل', color: 'bg-gray-100 text-gray-600 border-gray-300', emoji: '📭' };
  }

  if (mohReview.status === 'Approved' || mohReview.status === '✅ Approved') {
    return { status: 'approved', label: 'معتمد بالوزارة', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  if (mohReview.status === 'Cancelled' || mohReview.status === '🚫 Cancelled') {
    return { status: 'cancelled', label: 'ملغى', color: 'bg-gray-100 text-gray-700 border-gray-300', emoji: '🚫' };
  }

  // If reviewDate is set, MOH has replied
  if (mohReview.reviewDate) {
    if (mohReview.status === 'Rejected' || mohReview.status === '❌ Rejected') {
      return { status: 'rejected', label: 'مرفوض بالوزارة', color: 'bg-red-100 text-red-700 border-red-300', emoji: '❌' };
    }
    return { status: 'reviewed', label: 'تمت المراجعة', color: 'bg-blue-100 text-blue-700 border-blue-300', emoji: '📋' };
  }

  // No reply yet — check overdue
  const daysOpen = Math.floor((Date.now() - new Date(mohReview.submitDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysOpen > MOH_OVERDUE_DAYS) {
    return { status: 'overdue', label: `متأخر بالوزارة (${daysOpen}ي)`, color: 'bg-red-100 text-red-700 border-red-300', emoji: '🔴' };
  }

  return { status: 'under_review', label: `قيد المراجعة (${daysOpen}ي)`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '⏳' };
}

/**
 * Combined overall status — shows the most critical one
 */
export function computeOverallStatus(
  revisions: { submitDate: Date | null; replyDate: Date | null; action: string | null; approvalType?: string | null }[],
  consultantReview?: { status: string | null; reviewDate: Date | null } | null,
  mohReview?: { status: string | null; submitDate: Date | null; reviewDate: Date | null; submitRev: number | null } | null,
): ComputedStatus {
  const consultant = computeConsultantStatus(revisions, consultantReview);
  const moh = computeMohStatus(mohReview);

  // Priority: cancelled > overdue > approved (both) > pending
  if (consultant.status === 'cancelled') return consultant;

  // If consultant approved but not sent to MOH → still "approved" overall
  if (consultant.status === 'approved' && moh.status === 'not_sent') {
    return consultant;
  }

  // If consultant approved and MOH overdue → show MOH overdue
  if (moh.status === 'overdue') return moh;

  // If consultant overdue
  if (consultant.status === 'overdue') return consultant;

  // If both approved
  if (consultant.status === 'approved' && moh.status === 'approved') {
    return { status: 'approved', label: 'معتمد بالكل', color: 'bg-green-100 text-green-700 border-green-300', emoji: '✅' };
  }

  // Otherwise show consultant status (primary)
  return consultant;
}

// Fallback for backward compatibility
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

// Default disciplines (used as fallback when DB is not yet seeded)
export const DEFAULT_DISCIPLINES = [
  { code: 'CIV',  label: 'المدنية',     color: 'bg-amber-100 text-amber-700',   prefix: 'CIV-',  categoryCode: 'TRANSMITTAL' },
  { code: 'EL',   label: 'الكهربائية',  color: 'bg-purple-100 text-purple-700', prefix: 'EL-',   categoryCode: 'TRANSMITTAL' },
  { code: 'PL',   label: 'الصحي',       color: 'bg-cyan-100 text-cyan-700',     prefix: 'PL-',   categoryCode: 'TRANSMITTAL' },
  { code: 'HVAC', label: 'التكييف',     color: 'bg-rose-100 text-rose-700',     prefix: 'HAVC-', categoryCode: 'TRANSMITTAL' },
  { code: 'FF',   label: 'الحريق',      color: 'bg-red-100 text-red-700',       prefix: 'FF-',   categoryCode: 'TRANSMITTAL' },
  { code: 'ELVE', label: 'المصاعد',     color: 'bg-emerald-100 text-emerald-700', prefix: 'ELEV ', categoryCode: 'TRANSMITTAL' },
] as const;

// Top-level categories - fallback defaults used when DB not seeded yet
// (the actual list is now fetched from /api/categories)
export const DEFAULT_CATEGORIES = [
  { code: 'TRANSMITTAL', label: 'ترانسميتال',     icon: '📄', color: 'bg-blue-100 text-blue-700' },
  { code: 'MIR',         label: 'MIR - تفتيش مواد', icon: '🔍', color: 'bg-orange-100 text-orange-700' },
  { code: 'RFI',         label: 'RFI - طلب معلومات', icon: '❓', color: 'bg-purple-100 text-purple-700' },
  { code: 'BOOKS',       label: 'كتب',              icon: '📚', color: 'bg-emerald-100 text-emerald-700' },
] as const;

// Backward-compat aliases (used by older code)
export const CATEGORIES = DEFAULT_CATEGORIES;

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

// For backward compatibility with existing UI code
export const DISCIPLINES = DEFAULT_DISCIPLINES;
