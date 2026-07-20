#!/usr/bin/env python3
"""إضافة const { t, lang } = useI18n(); في بداية كل function تستخدم t()"""
import re
from pathlib import Path

page_path = Path('/home/z/my-project/src/app/page.tsx')
with open(page_path, encoding='utf-8') as f:
    src = f.read()

# كل function اسمها View أو Dialog أو تستخدم t()
funcs_to_patch = [
    'NavButton',
    'DashboardView',
    'ListView',
    'DetailView',
    'AddRevisionDialog',
    'NewTransmittalView',
    'ImportView',
    'ReportsView',
    'SettingsView',
    'AddDisciplineDialog',
    'EditDisciplineDialog',
    'SendToMohDialog',
    'AddCategoryDialog',
    'EditCategoryDialog',
    'RegisterRevisionDialog',
    'ConsultantReplyDialog',
    'MohReplyDialog',
    'CopyTransmittalDialog',
]

added = 0
for fn_name in funcs_to_patch:
    # ابحث عن: function Name(...) {
    # ثم ابحث عن السطر التالي الذي يبدأ بـ if (loading أو return أو const
    # pattern: function Name({ ... }) { \n ...
    # نريد إضافة const { t, lang } = useI18n();\n بعد القوس المفتوح
    
    # نمط: function Name(...) {  ...newline...
    # استبدل: function Name(...) { \n const { t, lang } = useI18n();\n
    
    # النمط: `function Name(...) {` في نهاية سطر
    pattern = rf'(function {fn_name}\([^)]*\)[^{{]*\{{)\n'
    # تأكد إنه ما فيها useI18n بالفعل
    m = re.search(pattern, src)
    if not m:
        # جرب نمط متعدد الأسطر: function Name(\n  ...\n) {
        pattern2 = rf'(function {fn_name}\([^)]*(?:\n[^)]*)*\)[^{{]*\{{)\n'
        m = re.search(pattern2, src)
        if not m:
            print(f'⚠️  {fn_name}: لم أجد النمط')
            continue
    
    # تحقق إن useI18n مش موجود بالفعل بعد القوس المفتوح مباشرة
    start = m.end()
    next_chunk = src[start:start+200]
    if 'useI18n' in next_chunk.split('\n')[0]:
        print(f'  {fn_name}: useI18n موجود بالفعل')
        continue
    
    # أضف const { t, lang } = useI18n();\n بعد القوس المفتوح
    src = src[:start] + '  const { t, lang } = useI18n();\n' + src[start:]
    added += 1
    print(f'  ✅ {fn_name}')

# حفظ
with open(page_path, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'\n✅ تمت إضافة useI18n() إلى {added} function')
