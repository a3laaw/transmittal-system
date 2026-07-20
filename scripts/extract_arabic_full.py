#!/usr/bin/env python3
"""فهرسة كل النصوص العربية في page.tsx - شامل (JSX text + strings + placeholders)"""
import re
import json

with open('/home/z/my-project/src/app/page.tsx', encoding='utf-8') as f:
    src = f.read()

# 1) نصوص داخل JSX: >النص< 
jsx_text = re.findall(r'>\s*([\u0600-\u06FF][^<>]{1,200})\s*<', src)
# 2) نصوص في strings (placeholder, title, alt)
quoted_strings = re.findall(r'"([\u0600-\u06FF][^"]{1,200})"', src)
# 3) نصوص في template literals
template_strings = re.findall(r'`([\u0600-\u06FF][^`]{1,200})`', src)

all_strings = jsx_text + quoted_strings + template_strings
# تنظيف
clean = []
for s in all_strings:
    s = s.strip()
    if len(s) >= 2:
        clean.append(s)

unique = sorted(set(clean))
print(f'إجمالي النصوص العربية الفريدة: {len(unique)}')
print('=' * 60)
for i, s in enumerate(unique, 1):
    print(f'{i:3d}. {s}')

with open('/home/z/my-project/scripts/hardcoded_arabic_full.json', 'w', encoding='utf-8') as f:
    json.dump(unique, f, ensure_ascii=False, indent=2)
