#!/usr/bin/env python3
"""
استبدال النصوص العربية الـ hardcoded في page.tsx بـ t('key')
الاستراتيجية:
1. اقرأ خريطة الاستبدال
2. ابحث عن كل نص عربي مكتوب في JSX أو string
3. استبدله بـ t('key') — مع التعامل الذكي مع:
   - JSX text (بين > و <)
   - String literals ("...")
   - Template literals (`...`)
   - Placeholder attributes (placeholder="...")
"""
import json
import re
from pathlib import Path

# تحميل خريطة الاستبدال
with open('/home/z/my-project/scripts/replacement_map.json', encoding='utf-8') as f:
    rep_map = json.load(f)

# قراءة page.tsx
page_path = Path('/home/z/my-project/src/app/page.tsx')
with open(page_path, encoding='utf-8') as f:
    src = f.read()

original_len = len(src)
stats = {
    'jsx_text': 0,
    'string_literal': 0,
    'placeholder': 0,
    'title_attr': 0,
    'skipped_complex': 0,
}

# ============================================================
# المرور 1: استبدال النصوص العربية في JSX text
# النمط: >نص عربي<  =>  >{t('key')}<
# ============================================================
def replace_jsx_text(match):
    full = match.group(0)
    prefix = match.group(1)  # > مع مسافات
    text = match.group(2)    # النص العربي
    suffix = match.group(3)  # < مع مسافات
    # تجاهل النصوص المعقدة (التي تحتوي على { أو })
    if '{' in text or '}' in text or '$' in text:
        stats['skipped_complex'] += 1
        return full
    key = rep_map.get(text.strip())
    if key:
        stats['jsx_text'] += 1
        # استخدم شكل JSX: {t('key')}
        return f'{prefix}{{t(\'{key}\')}}{suffix}'
    return full

# نمط JSX text: >(whitespace)النص(whitespace)<
src = re.sub(r'(>\s*)([\u0600-\u06FF][^<>{}]{1,200})(\s*<)', replace_jsx_text, src)

# ============================================================
# المرور 2: استبدال النصوص العربية في string literals
# النمط: "نص عربي"  =>  {t('key')} إذا كانت في JSX أو t('key') إذا كانت في JS
# ============================================================
def replace_string_literal(match):
    full = match.group(0)
    text = match.group(1)
    # تجاهل النصوص المعقدة
    if '{' in text or '}' in text or '$' in text:
        stats['skipped_complex'] += 1
        return full
    key = rep_map.get(text.strip())
    if key:
        stats['string_literal'] += 1
        return f"t('{key}')"
    return full

# لكن يجب الحذر: النصوص في placeholder="..." أو title="..." لها سياق مختلف
# دعنا نتعامل أولاً مع placeholder ثم title ثم باقي strings

# placeholder="عربي"
def replace_placeholder(match):
    full = match.group(0)
    attr = match.group(1)
    text = match.group(2)
    if '{' in text or '}' in text or '$' in text:
        stats['skipped_complex'] += 1
        return full
    key = rep_map.get(text.strip())
    if key:
        stats['placeholder'] += 1
        return f'{attr}={{t(\'{key}\')}}'
    return full

src = re.sub(r'(placeholder=)"([\u0600-\u06FF][^"]{1,200})"', replace_placeholder, src)

# title="عربي" 
def replace_title_attr(match):
    full = match.group(0)
    attr = match.group(1)
    text = match.group(2)
    if '{' in text or '}' in text or '$' in text:
        stats['skipped_complex'] += 1
        return full
    key = rep_map.get(text.strip())
    if key:
        stats['title_attr'] += 1
        return f'{attr}={{t(\'{key}\')}}'
    return full

src = re.sub(r'(title=)"([\u0600-\u06FF][^"]{1,200})"', replace_title_attr, src)

# باقي strings عربية — لكن بحذر (نتجنب strings داخل تعليقات أو نصوص regex)
# نريد فقط النصوص العربية المنفردة في JSX context
# النمط: "نص عربي فقط" بدون JSX tag قبلها مباشرة
# لكن لتجنب الكسر، نستبدل فقط strings البسيطة (بدون { أو }) 
def replace_simple_string(match):
    full = match.group(0)
    text = match.group(1)
    if '{' in text or '}' in text or '$' in text:
        stats['skipped_complex'] += 1
        return full
    key = rep_map.get(text.strip())
    if key:
        stats['string_literal'] += 1
        # استبدل بـ {t('key')} لأنه في JSX
        return f"{{t('{key}')}}"
    return full

# strings عربية فقط (بدون JSX tag قبلها مباشرة)
src = re.sub(r'"([\u0600-\u06FF][^"]{1,200})"', replace_simple_string, src)

# حفظ
with open(page_path, 'w', encoding='utf-8') as f:
    f.write(src)

new_len = len(src)
print(f'✅ تم استبدال النصوص في page.tsx')
print(f'   حجم الملف: {original_len} → {new_len} ({new_len - original_len:+d})')
print(f'   إحصائيات:')
print(f'     JSX text: {stats["jsx_text"]}')
print(f'     String literals: {stats["string_literal"]}')
print(f'     Placeholder: {stats["placeholder"]}')
print(f'     Title attr: {stats["title_attr"]}')
print(f'     تم تخطيها (معقدة): {stats["skipped_complex"]}')
