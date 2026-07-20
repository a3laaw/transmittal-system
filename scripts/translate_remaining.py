#!/usr/bin/env python3
"""استبدال النصوص العربية المكتوبة مباشرة في strings بـ t('key')"""
import json
import re
from pathlib import Path

with open('/home/z/my-project/src/lib/i18n/ar.json', encoding='utf-8') as f:
    ar = json.load(f)

# Reverse map: arabic text → key (for replacement)
ar_to_key = {}
for key, val in ar.items():
    if isinstance(val, str) and len(val) >= 3:
        ar_to_key[val] = key

# Specific replacements we want to do (priority translations)
SPECIFIC_REPLACEMENTS = {
    # Colors in SelectItems (label: 'أحمر' → label: t('color.red'))
    # We need to be careful - these are inside JS objects, not JSX
    # Skip colors for now - they need careful handling
}

page_path = Path('/home/z/my-project/src/app/page.tsx')
with open(page_path, encoding='utf-8') as f:
    src = f.read()

# Only replace specific safe contexts:
# 1. 'arabic' inside toast({ title: '...' or description: '...' })
# 2. throw new Error('arabic')
# 3. alert('arabic')

stats = {'toast': 0, 'throw': 0, 'alert': 0}

# Pattern 1: toast({ title: 'arabic', ...})
def replace_toast_title(match):
    full = match.group(0)
    text = match.group(1)
    if text in ar_to_key:
        key = ar_to_key[text]
        stats['toast'] += 1
        return f"title: t('{key}')"
    return full

src = re.sub(r"title: '([\u0600-\u06FF][^']{2,})'", replace_toast_title, src)

# Pattern 2: description: 'arabic'
def replace_toast_desc(match):
    full = match.group(0)
    text = match.group(1)
    if text in ar_to_key:
        key = ar_to_key[text]
        stats['toast'] += 1
        return f"description: t('{key}')"
    return full

src = re.sub(r"description: '([\u0600-\u06FF][^']{2,})'", replace_toast_desc, src)

# Pattern 3: throw new Error('arabic')
def replace_throw(match):
    full = match.group(0)
    text = match.group(1)
    if text in ar_to_key:
        key = ar_to_key[text]
        stats['throw'] += 1
        return f"throw new Error(t('{key}'))"
    return full

src = re.sub(r"throw new Error\('([\u0600-\u06FF][^']{2,})'\)", replace_throw, src)

# Pattern 4: alert('arabic')
def replace_alert(match):
    full = match.group(0)
    text = match.group(1)
    if text in ar_to_key:
        key = ar_to_key[text]
        stats['alert'] += 1
        return f"alert(t('{key}'))"
    return full

src = re.sub(r"alert\('([\u0600-\u06FF][^']{2,})'\)", replace_alert, src)

with open(page_path, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'Replaced:')
print(f'  toast title/description: {stats["toast"]}')
print(f'  throw new Error: {stats["throw"]}')
print(f'  alert: {stats["alert"]}')
