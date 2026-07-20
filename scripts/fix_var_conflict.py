#!/usr/bin/env python3
"""استبدال t كاسم متغير map إلى item لتجنب التعارض مع دالة t()"""
import re
from pathlib import Path

page_path = Path('/home/z/my-project/src/app/page.tsx')
with open(page_path, encoding='utf-8') as f:
    src = f.read()

# الـ 4 map patterns
# 1. data.consultantOverdueList.map((t) => (
# 2. data.mohOverdueList.map((t) => (
# 3. items.map((t) => (
# 4. docTypes.map((t) => (

# لكل واحدة، نجد البلوك من .map((t) => ( إلى الإغلاق ))}
# ونستبدل داخل هذا البلوك فقط: t. → item.

def patch_map_pattern(src, map_call_pattern, item_renames):
    """يستبدل t بـ item في نطاق map فقط"""
    # نجد موقع map_call
    m = re.search(map_call_pattern, src)
    if not m:
        return src, False
    
    start = m.end()
    # نعد الأقواس لنهاية البلوك
    # نبدأ من بعد (
    depth = 1  #因为我们已经匹配到了 (
    i = start
    while i < len(src) and depth > 0:
        if src[i] == '(':
            depth += 1
        elif src[i] == ')':
            depth -= 1
        i += 1
    end = i  # بعد )
    
    block = src[start:end]
    # استبدال t. بـ item. في البلوك (فقط في السياق الصحيح)
    for old, new in item_renames:
        block = re.sub(old, new, block)
    
    return src[:start] + block + src[end:], True

# Pattern 1: data.consultantOverdueList.map((t) => (
src, ok1 = patch_map_pattern(src, r'data\.consultantOverdueList\.map\(\(t\) => \(', [
    (r'\bt\.id\b', 'item.id'),
    (r'\bt\.reference\b', 'item.reference'),
    (r'\bt\.description\b', 'item.description'),
    (r'\bt\.status\b', 'item.status'),
])

# Pattern 2: data.mohOverdueList.map((t) => (
src, ok2 = patch_map_pattern(src, r'data\.mohOverdueList\.map\(\(t\) => \(', [
    (r'\bt\.id\b', 'item.id'),
    (r'\bt\.reference\b', 'item.reference'),
    (r'\bt\.description\b', 'item.description'),
    (r'\bt\.status\b', 'item.status'),
])

# Pattern 3: items.map((t) => ( — هذا الأكبر، يحتاج كل الحقول
src, ok3 = patch_map_pattern(src, r'items\.map\(\(t\) => \(', [
    (r'\bt\.id\b', 'item.id'),
    (r'\bt\.reference\b', 'item.reference'),
    (r'\bt\.description\b', 'item.description'),
    (r'\bt\.status\b', 'item.status'),
    (r'\bt\.computedStatus\b', 'item.computedStatus'),
    (r'\bt\.consultantStatus\b', 'item.consultantStatus'),
    (r'\bt\.mohStatus\b', 'item.mohStatus'),
    (r'\bt\.revisionsCount\b', 'item.revisionsCount'),
    (r'\bt\.lastReplyDate\b', 'item.lastReplyDate'),
])

# Pattern 4: docTypes.map((t) => (
src, ok4 = patch_map_pattern(src, r'docTypes\.map\(\(t\) => \(', [
    (r'\bt\.id\b', 'item.id'),
    (r'\bt\.code\b', 'item.code'),
    (r'\bt\.label\b', 'item.label'),
    (r'\bt\.labelEn\b', 'item.labelEn'),
])

# استبدال (t) => بـ (item) =>
src = src.replace('data.consultantOverdueList.map((t) =>', 'data.consultantOverdueList.map((item) =>')
src = src.replace('data.mohOverdueList.map((t) =>', 'data.mohOverdueList.map((item) =>')
src = src.replace('items.map((t) =>', 'items.map((item) =>')
src = src.replace('docTypes.map((t) =>', 'docTypes.map((item) =>')

with open(page_path, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'✅ تمت المعالجة: {ok1} {ok2} {ok3} {ok4}')
