#!/usr/bin/env python3
"""إضافة مفاتيح للنصوص المتبقية (toast/error messages) واستبدالها في page.tsx"""
import json
import re
from pathlib import Path

ar_path = Path('/home/z/my-project/src/lib/i18n/ar.json')
en_path = Path('/home/z/my-project/src/lib/i18n/en.json')
page_path = Path('/home/z/my-project/src/app/page.tsx')

with open(ar_path, encoding='utf-8') as f:
    ar = json.load(f)
with open(en_path, encoding='utf-8') as f:
    en = json.load(f)
with open(page_path, encoding='utf-8') as f:
    src = f.read()

# مفاتيح إضافية لـ toast/error/loading messages
EXTRA = {
    "فشل تحميل البيانات": ("msg.loadFailed", "Failed to load data"),
    "فشل تحميل القائمة": ("msg.loadListFailed", "Failed to load list"),
    "فشل تحميل التفاصيل": ("msg.loadDetailsFailed", "Failed to load details"),
    "فشل الإرسال": ("msg.sendFailed", "Send failed"),
    "تم الإرسال للوزارة": ("msg.sentToMoh", "Sent to MOH"),
    "فشل النسخ": ("msg.copyFailed", "Copy failed"),
    "فشل تسجيل الريفجن": ("msg.registerRevFailed", "Register revision failed"),
    "تم تسجيل الريفجن": ("msg.revRegistered", "Revision registered"),
    "فشل تحميل الترانسميتال": ("msg.loadTransmittalFailed", "Failed to load document"),
    "فشل تسجيل رد الاستشاري": ("msg.consultantReplyFailed", "Register consultant reply failed"),
    "تم تسجيل رد الاستشاري": ("msg.consultantReplyRegistered", "Consultant reply registered"),
    "فشل تسجيل رد الوزارة": ("msg.mohReplyFailed", "Register MOH reply failed"),
    "تم تسجيل رد الوزارة": ("msg.mohReplyRegistered", "MOH reply registered"),
    "جاري توليد ملف Excel": ("msg.generatingExcel", "Generating Excel file"),
    "سيتم تنزيل {ref}.xlsx": ("msg.willDownload", "{ref}.xlsx will be downloaded"),
    "فشل التوليد ({status})": ("msg.generateFailed", "Generation failed ({status})"),
    "جاري توليد الملف...": ("msg.generatingFile", "Generating file..."),
    "فشل الرفع": ("msg.uploadFailed", "Upload failed"),
    "فشل إضافة الرابط": ("msg.addLinkFailed", "Add link failed"),
    "فشل الحذف": ("msg.deleteFailed", "Delete failed"),
    "جاري التنزيل...": ("msg.downloading", "Downloading..."),
    "فشل التحضير ({status})": ("msg.prepareFailed", "Preparation failed ({status})"),
    "فشل قراءة الملف": ("msg.readFileFailed", "Failed to read file"),
    "خطأ في التنزيل": ("msg.downloadError", "Download error"),
    "فشل التنزيل": ("msg.downloadFailed", "Download failed"),
    "جاري...": ("msg.loading", "Loading..."),
    "رفع ملف": ("msg.uploadFile", "Upload file"),
    "إضافة الرابط": ("msg.addLink", "Add link"),
    "تم الاستيراد بنجاح": ("msg.importSuccess", "Import succeeded"),
    "تم استيراد {imported} سجل، تخطّي {skipped}": ("msg.importResult", "Imported {imported} records, skipped {skipped}"),
    "تم الحذف": ("msg.deleted", "Deleted"),
    "تم الحفظ": ("msg.saved", "Saved"),
    "تم التحديث": ("msg.updated", "Updated"),
    "جاري الحساب...": ("msg.calculating", "Calculating..."),
    "جاري الإرسال...": ("msg.sending", "Sending..."),
    "جاري التسجيل...": ("msg.registering", "Registering..."),
    "مسحوب": ("msg.cancelled", "Cancelled"),
    "بانتظار الرد": ("msg.awaitingReply", "Awaiting reply"),
    "غير معتمد": ("msg.notApproved", "Not approved"),
    "بتاريخ {date}": ("msg.dated", "dated {date}"),
    "إرسال REV.{rev} للوزارة": ("msg.sendRevToMoh", "Send REV.{rev} to MOH"),
    "تسجيل REV.{rev}": ("msg.registerRev", "Register REV.{rev}"),
    "المرجع *": ("field.referenceReq", "Reference *"),
    "REV.{rev} (تلقائي)": ("field.revAuto", "REV.{rev} (auto)"),
    "تلقائي": ("common.auto", "Auto"),
    "REV.{rev}": ("common.revNumber", "REV.{rev}"),
    "• الأقسام الرئيسية: ترانسميتال، MIR، RFI، كتب — قابلة للإضافة والحذف": ("settings.note1", "• Main categories: Transmittal, MIR, RFI, Letters — addable and removable"),
    "• التخصصات متعددة الأقسام: يمكن ربط تخصص بأكثر من قسم رئيسي": ("settings.note2", "• Multi-category disciplines: a discipline can be linked to multiple main categories"),
    "• الأنواع: قابلة للإضافة والحذف": ("settings.note3", "• Types: addable and removable"),
    "• يمكن رفع قالب مخصص لكل قسم رئيسي (Excel، Word، PDF، أو نص)": ("settings.note4", "• Custom templates can be uploaded per main category (Excel, Word, PDF, or text)"),
    "حذف": ("common.delete", "Delete"),
    "تعديل": ("common.edit", "Edit"),
    "إغلاق": ("common.close", "Close"),
}

added = 0
for ar_text, (key, en_text) in EXTRA.items():
    if key not in ar:
        ar[key] = ar_text
        added += 1
    if key not in en:
        en[key] = en_text

with open(ar_path, 'w', encoding='utf-8') as f:
    json.dump(ar, f, ensure_ascii=False, indent=2)
with open(en_path, 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print(f'✅ تمت إضافة {added} مفتاح إضافي (toast/error/loading)')
print(f'   إجمالي: ar={len(ar)} en={len(en)}')

# الآن استبدال النصوص العربية في strings بسيطة (داخل علامات اقتباس مفردة)
# نمط: 'نص عربي'  =>  t('key')
stats = {'replaced': 0, 'skipped': 0}

def replace_simple_string(match):
    text = match.group(1)
    if '{' in text or '}' in text or '$' in text:
        stats['skipped'] += 1
        return match.group(0)
    key = EXTRA.get(text, (None, None))[0]
    if key:
        stats['replaced'] += 1
        return f"t('{key}')"
    return match.group(0)

# استبدال 'نص عربي' (single quotes)
new_src = re.sub(r"'([\u0600-\u06FF][^']{1,200})'", replace_simple_string, src)

# استبدال "نص عربي" (double quotes) - بحذر أكبر لتجنب JSX props
def replace_double_string(match):
    text = match.group(1)
    if '{' in text or '}' in text or '$' in text:
        stats['skipped'] += 1
        return match.group(0)
    key = EXTRA.get(text, (None, None))[0]
    if key:
        stats['replaced'] += 1
        # إذا كانت قبلها '=' يعني prop value، استخدم JSX expression
        return f"{{t('{key}')}}"
    return match.group(0)

# لا نستبدل double quotes لأن السكريبت السابق فعل ذلك، فقط نضيف المفاتيح الجديدة للنصوص الباقية

# استبدال في template literals: `نص عربي ${var}`
def replace_template_literal_simple(match):
    """يعالج template literals البسيطة بدون متغيرات"""
    full = match.group(0)
    text = match.group(1)
    if not text or '{' in text or '$' in text:
        return full
    key = EXTRA.get(text, (None, None))[0]
    if key:
        stats['replaced'] += 1
        return f"t('{key}')"
    return full

# `نص عربي فقط` (template literal بدون ${})
new_src = re.sub(r'`([\u0600-\u06FF][^`]*?)`', replace_template_literal_simple, new_src)

# حالات خاصة لـ template literals مع متغيرات: `سيتم تنزيل ${reference}.xlsx`
def replace_template_with_var(match):
    full = match.group(0)
    inner = match.group(1)
    # نمط: سيتم تنزيل ${reference}.xlsx
    m = re.match(r'^سيتم تنزيل \$\{(\w+)\}\.xlsx$', inner)
    if m:
        var = m.group(1)
        stats['replaced'] += 1
        return f"t('msg.willDownload', {{ref: {var}}})"
    # نمط: تم استيراد ${data.imported} سجل، تخطّي ${data.skipped}
    m = re.match(r'^تم استيراد \$\{(\w+\.imported)\} سجل، تخطّي \$\{(\w+\.skipped)\}$', inner)
    if m:
        stats['replaced'] += 1
        return f"t('msg.importResult', {{imported: {m.group(1)}, skipped: {m.group(2)}}})"
    return full

new_src = re.sub(r'`([^`]*[\u0600-\u06FF][^`]*?)`', replace_template_with_var, new_src)

# حفظ
with open(page_path, 'w', encoding='utf-8') as f:
    f.write(new_src)

print(f'   استبدال: {stats["replaced"]} | تخطي: {stats["skipped"]}')
