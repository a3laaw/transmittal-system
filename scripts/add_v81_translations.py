#!/usr/bin/env python3
"""إضافة مفاتيح الترجمة الجديدة لـ v8.1"""
import json
from pathlib import Path

ar_path = Path('/home/z/my-project/src/lib/i18n/ar.json')
en_path = Path('/home/z/my-project/src/lib/i18n/en.json')

with open(ar_path, encoding='utf-8') as f:
    ar = json.load(f)
with open(en_path, encoding='utf-8') as f:
    en = json.load(f)

NEW_KEYS = {
    # Settings - Advanced Tools
    "settings.advancedTools": ("أدوات متقدمة", "Advanced Tools"),
    "settings.advancedToolsDesc": ("أدوات إدارية حساسة — استخدمها بحذر", "Sensitive administrative tools — use with caution"),
    "settings.savePathTitle": ("مسار الحفظ الحالي", "Current Save Path"),
    "settings.savePathDesc": ("المكان الذي تُحفظ فيه الملفات المرفوعة والقوالب", "Where uploaded files and templates are stored"),
    "settings.savePathDefault": ("افتراضي (داخل مجلد التطبيق)", "Default (inside app folder)"),
    "settings.changeSavePath": ("تغيير المسار", "Change Path"),
    "settings.wipeDataTitle": ("مسح جميع البيانات", "Wipe All Data"),
    "settings.wipeDataDesc": ("سيتم حذف كل المستندات والمراجعات والمرفقات نهائياً. لا يمكن التراجع.", "All documents, revisions, and attachments will be permanently deleted. Cannot be undone."),
    "settings.wipeDataButton": ("مسح البيانات", "Wipe Data"),
    "settings.wipeDataDialogTitle": ("تأكيد مسح البيانات", "Confirm Data Wipe"),
    "settings.wipeDataDialogDesc": ("أدخل كلمة المرور للتأكيد. هذا الإجراء لا يمكن التراجع عنه.", "Enter password to confirm. This action cannot be undone."),
    "settings.wipePassword": ("كلمة المرور", "Password"),
    "settings.wipePasswordHint": ("كلمة المرور الافتراضية: 0160", "Default password: 0160"),
    "settings.wipeDataConfirm": ("مسح نهائي", "Wipe Now"),
    "settings.editDocType": ("تعديل النوع", "Edit Type"),
    "settings.editDocTypeDesc": ("تعديل اسم النوع (عربي وإنجليزي)", "Edit type name (Arabic and English)"),

    # Messages - Wipe
    "msg.wrongPassword": ("كلمة المرور غير صحيحة", "Wrong password"),
    "msg.wipeFailed": ("فشل المسح", "Wipe failed"),
    "msg.wipeSuccess": ("تم مسح البيانات", "Data wiped successfully"),
    "msg.wipeResult": ("تم حذف {count} مستند", "Deleted {count} documents"),
    "msg.savePathUpdated": ("تم تحديث مسار الحفظ", "Save path updated"),
    "msg.savePathElectronOnly": ("تغيير المسار متاح فقط في نسخة سطح المكتب", "Changing path is only available in desktop version"),
    "msg.saveFailed": ("فشل الحفظ", "Save failed"),
    "msg.error": ("خطأ", "Error"),
    "msg.saving": ("جاري الحفظ...", "Saving..."),
    "msg.codeLabelRequired": ("الكود والاسم مطلوبان", "Code and name are required"),
    "msg.deleted": ("تم الحذف", "Deleted"),
    "msg.saved": ("تم الحفظ", "Saved"),
    "msg.updated": ("تم التحديث", "Updated"),
}

added = 0
for key, (ar_text, en_text) in NEW_KEYS.items():
    if key not in ar:
        ar[key] = ar_text
        added += 1
    if key not in en:
        en[key] = en_text

with open(ar_path, 'w', encoding='utf-8') as f:
    json.dump(ar, f, ensure_ascii=False, indent=2)
with open(en_path, 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print(f'✅ تمت إضافة {added} مفتاح جديد')
print(f'   إجمالي: ar={len(ar)} en={len(en)}')
