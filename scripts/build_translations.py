#!/usr/bin/env python3
"""
بناء قاموس ترجمة كامل من النصوص العربية المستخرجة، وتحديث ar.json + en.json،
ثم توليد خريطة استبدال لاستخدامها في السكريبت التالي.
"""
import json
import re
from pathlib import Path

# ============================================================
# قاموس المفاتيح: (arabic_text) → (key, english_text)
# مرتبة حسب المجموعات
# ============================================================

TRANSLATIONS = {
    # === التطبيق ===
    "سكرتير الموقع": ("app.name", "Site Secretary"),
    "سكرتير الموقع · Sabah Al Salem South Health Center · {year}": ("app.footer", "Site Secretary · Sabah Al Salem South Health Center · {year}"),

    # === التنقل ===
    "الرئيسية": ("nav.dashboard", "Home"),
    "القائمة": ("nav.list", "List"),
    "جديد": ("nav.new", "New"),
    "تقارير": ("nav.reports", "Reports"),
    "الإعدادات": ("nav.settings", "Settings"),
    "استيراد": ("nav.import", "Import"),

    # === عام ===
    "تحديث": ("common.refresh", "Refresh"),
    "إلغاء": ("common.cancel", "Cancel"),
    "حفظ": ("common.save", "Save"),
    "بحث": ("common.search", "Search"),
    "إجراء": ("common.action", "Action"),
    "إجراءات": ("common.actions", "Actions"),
    "الكل": ("common.all", "All"),
    "فتح": ("common.open", "Open"),
    "تنزيل": ("common.download", "Download"),
    "طباعة": ("common.print", "Print"),
    "عينة": ("common.sample", "Sample"),
    "المرجع": ("common.reference", "Reference"),
    "الوصف": ("common.description", "Description"),
    "النوع": ("common.type", "Type"),
    "الحالة": ("common.status", "Status"),
    "القسم": ("common.category", "Category"),
    "التخصص": ("common.discipline", "Discipline"),
    "المراجعة": ("common.revision", "Revision"),
    "المراجعات": ("common.revisions", "Revisions"),
    "ملاحظات": ("common.notes", "Notes"),
    "القالب": ("common.template", "Template"),
    "اللون": ("common.color", "Color"),
    "الكود": ("common.code", "Code"),
    "الاسم": ("common.name", "Name"),
    "الأيقونة": ("common.icon", "Icon"),
    "عرض التفاصيل": ("common.viewDetails", "View Details"),

    # === الحالات ===
    "معتمد": ("status.approved", "Approved"),
    "بانتظار": ("status.pending", "Pending"),
    "متأخر": ("status.overdue", "Overdue"),
    "للوزارة": ("status.toMoh", "To MOH"),
    "معتمد وزارة": ("status.mohApproved", "MOH Approved"),
    "متخطّى (فارغ)": ("status.skipped", "Skipped (empty)"),

    # === الداشبورد ===
    "لوحة المعلومات": ("dashboard.title", "Dashboard"),
    "نظرة عامة على حالة كل الترانسميتالات": ("dashboard.subtitle", "Overview of all documents' status"),
    "حالة الإرسال لوزارة الصحة": ("dashboard.mohStatus", "MOH Submission Status"),
    "تفصيل حسب القسم الرئيسي": ("dashboard.byCategoryDetail", "Details by Main Category"),
    "توزيع الترانسميتالات على الأقسام الرئيسية (ترانسميتال/MIR/RFI/كتب)": ("dashboard.byCategoryDesc", "Distribution of documents across main categories (Transmittal/MIR/RFI/Letters)"),
    "تفصيل حسب التخصص الفرعي": ("dashboard.byDisciplineTitle", "Details by Sub-Discipline"),
    "توزيع الترانسميتالات على التخصصات داخل كل قسم رئيسي": ("dashboard.byDisciplineDesc", "Distribution of documents across disciplines within each main category"),
    "تنبيهات تأخر الاستشاري ({count})": ("dashboard.consultantOverdue", "Consultant Overdue Alerts ({count})"),
    "تنبيهات تأخر الوزارة ({count})": ("dashboard.mohOverdueAlerts", "MOH Overdue Alerts ({count})"),
    "لا توجد بيانات. قم باستيراد ملف Excel أولاً.": ("dashboard.noData", "No data. Please import an Excel file first."),
    "عرض لوحة المعلومات": ("dashboard.viewDashboard", "View Dashboard"),
    "آخر 5 مراجع مُنشأة:": ("dashboard.lastFiveRefs", "Last 5 created references:"),

    # === القائمة ===
    "قائمة الترانسميتالات": ("list.title", "Documents List"),
    "كل الأقسام": ("list.allCategories", "All Categories"),
    "كل التخصصات": ("list.allDisciplines", "All Disciplines"),
    "كل الأنواع": ("list.allTypes", "All Types"),
    "كل الحالات": ("list.allStatuses", "All Statuses"),
    "ابحث بالمرجع أو الوصف...": ("list.searchPlaceholder", "Search by reference or description..."),
    "لا توجد نتائج مطابقة": ("list.noResults", "No matching results"),
    "لا توجد بيانات": ("list.noData", "No data"),
    "إجمالي مستخرج": ("list.totalExtracted", "Total extracted"),
    "مستورد": ("list.imported", "Imported"),

    # === التفاصيل ===
    "رجوع للقائمة": ("detail.backToList", "Back to List"),
    "تنزيل ملف Excel": ("detail.downloadExcel", "Download Excel File"),
    "نسخ برقم جديد": ("detail.copyNew", "Copy with New Number"),
    "الاستشاري": ("detail.consultant", "Consultant"),
    "الوزارة": ("detail.moh", "MOH"),
    "وزارة الصحة": ("detail.mohFull", "Ministry of Health"),
    "آخر إرسال:": ("detail.lastSubmit", "Last Submit:"),
    "آخر رد:": ("detail.lastReply", "Last Reply:"),
    "سجل المراجعات ({count})": ("detail.revisionsLog", "Revisions Log ({count})"),
    "لا توجد مراجعات بعد": ("detail.noRevisions", "No revisions yet"),
    "المرفقات والصور ({count})": ("detail.attachments", "Attachments & Images ({count})"),
    "لا توجد مرفقات بعد": ("detail.noAttachments", "No attachments yet"),
    "النوع: {type}": ("detail.typeLabel", "Type: {type}"),
    "إرسال للوزارة:": ("detail.sendToMoh", "Send to MOH:"),
    "الريفجن المُرسل:": ("detail.sentRev", "Sent Revision:"),
    "المصدر:": ("detail.source", "Source:"),
    "رد الوزارة:": ("detail.mohReply", "MOH Reply:"),
    "المرجع:": ("detail.reference", "Reference:"),
    "المراجعة الجديدة:": ("detail.newRevision", "New Revision:"),

    # === جديد ===
    "إنشاء ترانسميتال جديد": ("new.title", "Create New Document"),
    "اختر القسم الرئيسي أولاً": ("new.categoryPlaceholder", "Select main category first"),
    "اختر التخصص": ("new.selectDiscipline", "Select Discipline"),
    "اختر النوع": ("new.selectType", "Select Type"),
    "سيتم اقتراحه تلقائياً": ("new.refAutoSuggest", "Will be suggested automatically"),
    "عدّل الوصف كما تريد...": ("new.descPlaceholder", "Edit description as you wish..."),
    "مثال: Excavation Plan PDF": ("new.descExample1", "Example: Excavation Plan PDF"),
    "مثال: Excavation Plan & Excavation Section": ("new.descExample2", "Example: Excavation Plan & Excavation Section"),
    "مثال: Method Statement": ("new.typeExample1", "Example: Method Statement"),
    "مثال: Method Statements": ("new.typeExample2", "Example: Method Statements"),
    "مثال: MD": ("new.codeExample1", "Example: MD"),
    "مثال: MS": ("new.codeExample2", "Example: MS"),
    "تنزيل ملف Excel جاهز": ("new.downloadTemplate", "Download Excel Template"),
    "سيتم اقتراح المرجع تلقائياً (الرقم التسلسلي الموحد + كود القسم). مثال: {examples}": ("new.refHint", "Reference will be suggested automatically (unified serial + category code). Example: {examples}"),
    "أضف أي رابط مباشر لملف أو صورة خارجية": ("new.externalLinkHint", "Add a direct link to an external file or image"),

    # === استيراد ===
    "استيراد البيانات من Excel": ("import.title", "Import Data from Excel"),
    "ارفع ملف LOG_Final.xlsm لاستيراد كل الترانسميتالات. سيتم تخطّي الصفوف بدون وصف.": ("import.desc", "Upload LOG_Final.xlsm to import all documents. Rows without description will be skipped."),
    "الملف (LOG_Final.xlsm)": ("import.file", "File (LOG_Final.xlsm)"),
    "بدء الاستيراد": ("import.start", "Start Import"),
    "جاري الاستيراد... قد يستغرق دقيقة": ("import.loading", "Importing... may take a minute"),
    "نتيجة الاستيراد": ("import.result", "Import Result"),
    "تم استيراد {imported} سجل، تخطّي {skipped}": ("import.success", "Imported {imported} records, skipped {skipped}"),
    "أخطاء:": ("import.errors", "Errors:"),

    # === التقارير ===
    "تقارير الجدول الزمني": ("reports.title", "Timeline Report"),
    "من تاريخ": ("reports.dateFrom", "From Date"),
    "إلى تاريخ": ("reports.dateTo", "To Date"),
    "مرجع أو وصف...": ("reports.searchPlaceholder", "Reference or description..."),
    "تنزيل Excel": ("reports.exportExcel", "Download Excel"),
    "لا توجد بيانات مطابقة للفلاتر": ("reports.empty", "No data matching filters"),
    "دليل الألوان والإجراءات:": ("reports.colorGuide", "Colors & Actions Guide:"),
    "إجمالي الأيام: مجموع كل الفترات (أخضر <14ي · أصفر 14-30ي · أحمر >30ي)": ("reports.totalDaysHint", "Total days: sum of all periods (green <14d · yellow 14-30d · red >30d)"),
    "تقديم": ("reports.rev.submit", "Submit"),
    "رد": ("reports.rev.reply", "Reply"),
    "آخر مرجع": ("reports.lastRef", "Last Reference"),

    # === الإعدادات ===
    "إعدادات الأقسام": ("settings.title", "Categories Settings"),
    "الأقسام الرئيسية والتخصصات الفرعية تحتها": ("settings.subtitle", "Main categories and sub-disciplines"),
    "الأقسام الرئيسية ({count})": ("settings.categoriesCount", "Main Categories ({count})"),
    "التخصصات الفرعية حسب القسم الرئيسي": ("settings.disciplinesByCategory", "Sub-disciplines by Main Category"),
    "أنواع المستندات ({count})": ("settings.docTypesCount", "Document Types ({count})"),
    "إضافة قسم رئيسي": ("settings.addCategory", "Add Main Category"),
    "إضافة تخصص": ("settings.addDiscipline", "Add Discipline"),
    "إضافة نوع": ("settings.addDocType", "Add Type"),
    "إضافة قسم رئيسي جديد": ("settings.addCategoryNew", "Add New Main Category"),
    "إضافة تخصص فرعي جديد": ("settings.addDisciplineNew", "Add New Sub-Discipline"),
    "إضافة نوع مستند جديد": ("settings.addDocTypeNew", "Add New Document Type"),
    "أضف قسماً رئيسياً جديداً (مثل: Method Statements، Calculations، إلخ)": ("settings.addCategoryHint", "Add a new main category (e.g., Method Statements, Calculations, etc.)"),
    "أضف تخصصاً جديداً واختر القسم المناسب له.": ("settings.addDisciplineHint", "Add a new discipline and select its category."),
    "أضف تخصصاً جديداً مع إمكانية ربطه بأكثر من قسم رئيسي": ("settings.addDisciplineMultiHint", "Add a new discipline that can be linked to multiple main categories"),
    "أضف نوعاً جديداً لتصنيف الترانسميتالات": ("settings.addDocTypeHint", "Add a new type to classify documents"),
    "الأقسام الرئيسية القابلة للإضافة (ترانسميتال، MIR، RFI، كتب، وأي قسم آخر)": ("settings.categoriesHint", "Addable main categories (Transmittal, MIR, RFI, Letters, etc.)"),
    "الأنواع المستخدمة في تصنيف الترانسميتالات (Shop Drawings, Sample, ...)": ("settings.docTypesHint", "Types used to classify documents (Shop Drawings, Sample, ...)"),
    "أقسام رئيسية بدون تخصصات بعد:": ("settings.emptyCategories", "Main categories with no disciplines yet:"),
    "عدد التخصصات": ("settings.disciplinesCount", "Disciplines Count"),
    "عدد الترانسميتالات": ("settings.documentsCount", "Documents Count"),
    "تعديل القسم الرئيسي: {code}": ("settings.editCategory", "Edit Main Category: {code}"),
    "تعديل القسم: {code}": ("settings.editDiscipline", "Edit Discipline: {code}"),
    "معاينة اللون": ("settings.colorPreview", "Color Preview"),
    "حذف القالب": ("settings.deleteTemplate", "Delete Template"),
    "سيتم حذف القالب عند الحفظ": ("settings.deleteTemplateHint", "Template will be deleted on save"),
    "القالب (اختياري)": ("settings.templateOptional", "Template (optional)"),
    "ارفع قالب مخصص لهذا القسم (Excel، Word، PDF، أو نص). سيُستخدم عند توليد الملفات لهذا القسم.": ("settings.templateHint", "Upload a custom template for this category (Excel, Word, PDF, or text). It will be used when generating files for this category."),
    "لا توجد تخصصات تحت هذا القسم بعد. أضف تخصصاً من صفحة الإعدادات.": ("settings.noDisciplinesInCategory", "No disciplines in this category yet. Add one from Settings."),

    # === الحقول ===
    "القسم الرئيسي": ("field.mainCategory", "Main Category"),
    "القسم الرئيسي *": ("field.mainCategoryReq", "Main Category *"),
    "القسم الرئيسي الافتراضي *": ("field.defaultCategoryReq", "Default Main Category *"),
    "التخصص الفرعي": ("field.subDiscipline", "Sub-Discipline"),
    "التخصص الفرعي *": ("field.subDisciplineReq", "Sub-Discipline *"),
    "المرجع *": ("field.referenceReq", "Reference *"),
    "الاسم *": ("field.nameReq", "Name *"),
    "الاسم (عربي) *": ("field.nameArReq", "Name (Arabic) *"),
    "الاسم (عربي)": ("field.nameAr", "Name (Arabic)"),
    "الاسم (English)": ("field.nameEn", "Name (English)"),
    "الكود *": ("field.codeReq", "Code *"),
    "البادئة": ("field.prefix", "Prefix"),
    "البادئة * (تُستخدم في رقم المرجع)": ("field.prefixReq", "Prefix * (used in reference number)"),
    "الوصف (قابل للتعديل)": ("field.descEditable", "Description (editable)"),
    "الرابط (URL)": ("field.url", "Link (URL)"),
    "تاريخ الإرسال": ("field.submitDate", "Submit Date"),
    "تاريخ الإرسال *": ("field.submitDateReq", "Submit Date *"),
    "تاريخ إرسال REV.0": ("field.revZeroDate", "REV.0 Submit Date"),
    "تاريخ الرد": ("field.replyDate", "Reply Date"),
    "تاريخ الرد (اختياري)": ("field.replyDateOptional", "Reply Date (optional)"),
    "تاريخ الرد *": ("field.replyDateReq", "Reply Date *"),
    "تاريخ الإرسال للوزارة *": ("field.mohSubmitDateReq", "MOH Submit Date *"),
    "تاريخ رد الوزارة *": ("field.mohReplyDateReq", "MOH Reply Date *"),
    "حالة الرد *": ("field.replyStatusReq", "Reply Status *"),
    "نوع القبول *": ("field.acceptTypeReq", "Acceptance Type *"),
    "الإجراء": ("field.action", "Action"),
    "الإجراء *": ("field.actionReq", "Action *"),
    "ملاحظات (اختياري)": ("field.notesOptional", "Notes (optional)"),
    "ملاحظات إضافية...": ("field.notesExtra", "Additional notes..."),
    "ملاحظات الاستشاري...": ("field.consultantNotes", "Consultant notes..."),
    "ملاحظات الوزارة...": ("field.mohNotes", "MOH notes..."),
    "ملاحظات حول الإرسال...": ("field.submitNotes", "Submission notes..."),
    "ملاحظات حول المراجعة...": ("field.reviewNotes", "Review notes..."),
    "اختر الإجراء": ("field.selectAction", "Select Action"),
    "اختر الحالة": ("field.selectStatus", "Select Status"),
    "اختر نوع القبول": ("field.selectAcceptType", "Select Acceptance Type"),
    "رقم المراجعة:": ("field.revNumber", "Revision Number:"),
    "رقم المراجعة مقترح تلقائياً (آخر رقم + 1). سجّل تاريخ الإرسال والرد والإجراء.": ("field.revNumberHint", "Revision number is auto-suggested (last number + 1). Enter submit date, reply date, and action."),
    "التالي تلقائياً: آخر رقم في القسم = {lastMax} · إجمالي {total} في هذا القسم": ("field.nextAuto", "Auto next: last number in category = {lastMax} · total {total} in this category"),

    # === أنواع القبول ===
    "اعتماد مادة (Material Approval)": ("acceptType.material", "Material Approval"),
    "اعتماد مصدر (Source Approval)": ("acceptType.source", "Source Approval"),
    "طلب اعتماد (Submittal)": ("acceptType.submittal", "Submittal"),
    "رسم تنفيذي (Shop Drawings)": ("acceptType.shopDrawings", "Shop Drawings"),
    "حسابات (Calculation)": ("acceptType.calculation", "Calculation"),
    "طريقة تنفيذ (Method Statement)": ("acceptType.methodStatement", "Method Statement"),
    "تقرير اختبار (Test Report)": ("acceptType.testReport", "Test Report"),
    "ملف شركة (Company Profile)": ("acceptType.companyProfile", "Company Profile"),
    "عينة (Sample)": ("acceptType.sample", "Sample"),

    # === الأزرار ===
    "إضافة رابط خارجي": ("button.addExternalLink", "Add External Link"),
    "ربط بكتاب آخر (اختياري)": ("button.linkToLetter", "Link to another Letter (optional)"),
    "أدخل معرف الكتاب المرتبط (ID) أو ابحث...": ("button.linkToLetterPlaceholder", "Enter related Letter ID or search..."),

    # === نوافذ المراجعات ===
    "إضافة مراجعة (REV.{count})": ("dialog.addRevision", "Add Revision (REV.{count})"),
    "إضافة مراجعة جديدة - REV.{next}": ("dialog.addRevisionTitle", "Add New Revision - REV.{next}"),
    "تسجيل ريفجن (REV.{count})": ("dialog.registerRevision", "Register Revision (REV.{count})"),
    "تسجيل ريفجن جديد - {ref}": ("dialog.registerRevisionTitle", "Register New Revision - {ref}"),
    "سيتم إنشاء مراجعة جديدة REV.{next} (آخر رقم + 1). أدخل تاريخ الإرسال والرد والإجراء.": ("dialog.registerRevisionDesc", "A new revision REV.{next} will be created (last number + 1). Enter submit date, reply date, and action."),
    "سيتم اقتراح REV.{count} تلقائياً عند الإضافة": ("dialog.revAutoSuggest", "REV.{count} will be suggested automatically on add"),
    "تسجيل رد الاستشاري": ("dialog.consultantReply", "Register Consultant Reply"),
    "تسجيل رد الاستشاري - {ref}": ("dialog.consultantReplyTitle", "Register Consultant Reply - {ref}"),
    "سيتم تحديث آخر ريفجن بتاريخ الرد والإجراء، وتحديث حالة الاستشاري.": ("dialog.consultantReplyDesc", "The last revision will be updated with reply date and action, and consultant status will be updated."),
    "تسجيل رد الوزارة": ("dialog.mohReply", "Register MOH Reply"),
    "تسجيل رد وزارة الصحة - {ref}": ("dialog.mohReplyTitle", "Register MOH Reply - {ref}"),
    "سيتم تحديث حالة المراجعة عند الوزارة بتاريخ الرد والحالة.": ("dialog.mohReplyDesc", "The MOH revision status will be updated with reply date and status."),
    "إرسال REV.{rev} للوزارة": ("dialog.sendRevToMoh", "Send REV.{rev} to MOH"),
    "إرسال REV.{rev} للوزارة": ("dialog.sendRevToMohVar", "Send REV.{rev} to MOH"),
    "إرسال للوزارة - {ref}": ("dialog.sendToMohTitle", "Send to MOH - {ref}"),
    "أدخل تاريخ الإرسال لوزارة الصحة. سيتم إرسال آخر مراجعة (REV.{rev}) تلقائياً.": ("dialog.sendToMohDesc", "Enter MOH submission date. The latest revision (REV.{rev}) will be sent automatically."),
    "المراجعة المُرسلة (تلقائي - آخر ريفجن):": ("dialog.sentRevisionAuto", "Sent Revision (auto - latest):"),
    "نسخ الترانسميتال - {ref}": ("dialog.copyTransmittal", "Copy Document - {ref}"),
    "سيتم إنشاء ترانسميتال جديد بنفس البيانات (التخصص، النوع) ورقم تسلسلي جديد تلقائي. يمكنك تعديل الوصف قبل النسخ.": ("dialog.copyDesc", "A new document will be created with the same data (discipline, type) and a new serial number automatically. You can edit the description before copying."),
    "يمكنك تعديل الوصف قبل النسخ. سيتم نسخ باقي البيانات كما هي.": ("dialog.copyDescShort", "You can edit the description before copying. The rest of the data will be copied as is."),

    # === رسائل التأكيد ===
    "هل أنت متأكد من حذف القسم {code}؟": ("confirm.deleteDiscipline", "Are you sure you want to delete discipline {code}?"),
    "هل أنت متأكد من حذف القسم الرئيسي {code}؟": ("confirm.deleteCategory", "Are you sure you want to delete main category {code}?"),
    "هل أنت متأكد من حذف النوع {code}؟": ("confirm.deleteType", "Are you sure you want to delete type {code}?"),
    "سيتم حذف كل البيانات الحالية في قاعدة البيانات واستبدالها بالبيانات الجديدة.": ("confirm.wipeData", "All current data in the database will be deleted and replaced with new data."),

    # === تنزيل Excel ===
    "سيتم تنزيل {ref}.xlsx": ("msg.downloadExcel", "{ref}.xlsx will be downloaded"),
    "فشل التوليد ({status})": ("msg.generateFailed", "Generation failed ({status})"),
    "فشل التحضير ({status})": ("msg.prepareFailed", "Preparation failed ({status})"),
    "اسم الملف / الوصف": ("msg.fileNameDesc", "File name / Description"),

    # === أنواع التخصصات الافتراضية ===
    "المدنية": ("discipline.civil", "Civil"),
    "المصاعد": ("discipline.elevators", "Elevators"),

    # === الإجمالي ===
    "الإجمالي": ("total.label", "Total"),
    "بانتظار:": ("total.pending", "Pending:"),
    "معتمد:": ("total.approved", "Approved:"),
    "متأخر:": ("total.overdue", "Overdue:"),
    "للوزارة:": ("total.toMoh", "To MOH:"),
    "أقسام إضافية (اختياري - متعدد)": ("field.extraCategories", "Additional Categories (optional - multiple)"),
    "ربط هذا التخصص بأقسام رئيسية أخرى — مثلاً: تخصص \"المدنية\" يظهر تحت ترانسميتال و MIR و RFI": ("field.linkToCategories", "Link this discipline to other main categories — e.g., \"Civil\" appears under Transmittal, MIR, and RFI"),
    "ارفع صور (PNG, JPG, GIF, WebP) أو PDF أو Word فقط": ("new.attachmentsHint", "Upload images (PNG, JPG, GIF, WebP) or PDF or Word only"),
    "مثال:": ("common.example", "Example:"),
}

# ============================================================
# تحميل ar.json الموجود ودمج المفاتيح الجديدة
# ============================================================

ar_path = Path('/home/z/my-project/src/lib/i18n/ar.json')
en_path = Path('/home/z/my-project/src/lib/i18n/en.json')

with open(ar_path, encoding='utf-8') as f:
    ar = json.load(f)
with open(en_path, encoding='utf-8') as f:
    en = json.load(f)

# إضافة المفاتيح الجديدة
added = 0
for arabic, (key, english) in TRANSLATIONS.items():
    if key not in ar:
        ar[key] = arabic
        added += 1
    if key not in en:
        en[key] = english

# حفظ
with open(ar_path, 'w', encoding='utf-8') as f:
    json.dump(ar, f, ensure_ascii=False, indent=2)
with open(en_path, 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print(f'✅ تمت إضافة {added} مفتاح جديد إلى ar.json و en.json')
print(f'   إجمالي المفاتيح الآن: ar={len(ar)} en={len(en)}')

# حفظ خريطة الاستبدال (arabic → key) للاستخدام في السكريبت التالي
replacement_map = {arabic: key for arabic, (key, _) in TRANSLATIONS.items()}
with open('/home/z/my-project/scripts/replacement_map.json', 'w', encoding='utf-8') as f:
    json.dump(replacement_map, f, ensure_ascii=False, indent=2)

print(f'✅ تم حفظ خريطة الاستبدال ({len(replacement_map)} تعيين)')

# طباعة النصوص العربية التي لم يتم تعيينها (ناقصة)
with open('/home/z/my-project/scripts/hardcoded_arabic_full.json', encoding='utf-8') as f:
    all_ar = json.load(f)

mapped = set(replacement_map.keys())
unmapped = [s for s in all_ar if s not in mapped and not s.startswith('${')]
print(f'\n⚠️  نصوص غير معينة ({len(unmapped)}):')
for s in unmapped[:30]:
    print(f'   {s}')
