#!/usr/bin/env python3
"""إضافة المفاتيح الناقصة للنصوص المعقدة (مع متغيرات JSX/template literals)"""
import json
import re
from pathlib import Path

ar_path = Path('/home/z/my-project/src/lib/i18n/ar.json')
en_path = Path('/home/z/my-project/src/lib/i18n/en.json')

with open(ar_path, encoding='utf-8') as f:
    ar = json.load(f)
with open(en_path, encoding='utf-8') as f:
    en = json.load(f)

# مفاتيح للنصوص المعقدة (مع placeholders)
COMPLEX_TRANSLATIONS = {
    # نصوص بها {variable} (JSX interpolation) — استخدم {var} كـ placeholder
    "أنواع المستندات ({count})": ("settings.docTypesCount", "Document Types ({count})"),
    "الأقسام الرئيسية ({count})": ("settings.categoriesCount", "Main Categories ({count})"),
    "المرفقات والصور ({count})": ("detail.attachments", "Attachments & Images ({count})"),
    "سجل المراجعات ({count})": ("detail.revisionsLog", "Revisions Log ({count})"),
    "النوع: {type}": ("detail.typeLabel", "Type: {type}"),
    "تعديل القسم الرئيسي: {code}": ("settings.editCategory", "Edit Main Category: {code}"),
    "تعديل القسم: {code}": ("settings.editDiscipline", "Edit Discipline: {code}"),
    "إضافة مراجعة (REV.{count})": ("dialog.addRevision", "Add Revision (REV.{count})"),
    "إضافة مراجعة جديدة - REV.{next}": ("dialog.addRevisionTitle", "Add New Revision - REV.{next}"),
    "تسجيل ريفجن (REV.{count})": ("dialog.registerRevision", "Register Revision (REV.{count})"),
    "تسجيل ريفجن جديد - {ref}": ("dialog.registerRevisionTitle", "Register New Revision - {ref}"),
    "سيتم إنشاء مراجعة جديدة REV.{next} (آخر رقم + 1). أدخل تاريخ الإرسال والرد والإجراء.": ("dialog.registerRevisionDesc", "A new revision REV.{next} will be created (last number + 1). Enter submit date, reply date, and action."),
    "سيتم اقتراح REV.{count} تلقائياً عند الإضافة": ("dialog.revAutoSuggest", "REV.{count} will be suggested automatically on add"),
    "تسجيل رد الاستشاري - {ref}": ("dialog.consultantReplyTitle", "Register Consultant Reply - {ref}"),
    "تسجيل رد وزارة الصحة - {ref}": ("dialog.mohReplyTitle", "Register MOH Reply - {ref}"),
    "إرسال للوزارة - {ref}": ("dialog.sendToMohTitle", "Send to MOH - {ref}"),
    "نسخ الترانسميتال - {ref}": ("dialog.copyTransmittal", "Copy Document - {ref}"),
    "تنبيهات تأخر الاستشاري ({count})": ("dashboard.consultantOverdue", "Consultant Overdue Alerts ({count})"),
    "تنبيهات تأخر الوزارة ({count})": ("dashboard.mohOverdueAlerts", "MOH Overdue Alerts ({count})"),
    "تم استيراد {imported} سجل، تخطّي {skipped}": ("import.success", "Imported {imported} records, skipped {skipped}"),
    "التالي تلقائياً: آخر رقم في القسم = {lastMax} · إجمالي {total} في هذا القسم": ("field.nextAuto", "Auto next: last number in category = {lastMax} · total {total} in this category"),
    "أدخل تاريخ الإرسال لوزارة الصحة. سيتم إرسال آخر مراجعة (REV.{rev}) تلقائياً.": ("dialog.sendToMohDesc", "Enter MOH submission date. The latest revision (REV.{rev}) will be sent automatically."),
    "إرسال REV.{rev} للوزارة": ("dialog.sendRevToMoh", "Send REV.{rev} to MOH"),
    "رابط خارجي": ("button.externalLink", "External Link"),
}

added = 0
for arabic, (key, english) in COMPLEX_TRANSLATIONS.items():
    if key not in ar:
        ar[key] = arabic
        added += 1
    if key not in en:
        en[key] = english

with open(ar_path, 'w', encoding='utf-8') as f:
    json.dump(ar, f, ensure_ascii=False, indent=2)
with open(en_path, 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print(f'✅ تمت إضافة {added} مفتاح إضافي')
print(f'   إجمالي المفاتيح: ar={len(ar)} en={len(en)}')

# تحديث خريطة الاستبدال
with open('/home/z/my-project/scripts/replacement_map.json', encoding='utf-8') as f:
    rep = json.load(f)

for arabic, (key, _) in COMPLEX_TRANSLATIONS.items():
    rep[arabic] = key

with open('/home/z/my-project/scripts/replacement_map.json', 'w', encoding='utf-8') as f:
    json.dump(rep, f, ensure_ascii=False, indent=2)

print(f'✅ خريطة الاستبدال: {len(rep)} تعيين')
