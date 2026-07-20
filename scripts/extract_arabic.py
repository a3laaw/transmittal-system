#!/usr/bin/env python3
"""فهرسة كل النصوص العربية المكتوبة مباشرة في page.tsx"""
import re
import json

with open('/home/z/my-project/src/app/page.tsx', encoding='utf-8') as f:
    src = f.read()

# كل النصوص العربية المكتوبة في الكود (hardcoded)
ar_strings = re.findall(r'"([\u0600-\u06FF][^\"]{1,80})"', src)
unique = sorted(set(ar_strings))

print(f'إجمالي النصوص الفريدة: {len(unique)}')
print('=' * 60)
for i, s in enumerate(unique, 1):
    print(f'{i:3d}. {s}')

# حفظ في ملف
with open('/home/z/my-project/scripts/hardcoded_arabic.json', 'w', encoding='utf-8') as f:
    json.dump(unique, f, ensure_ascii=False, indent=2)
