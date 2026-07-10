"""
Seed the database with categories, disciplines, and document types.
Run: python3 seed_db.py
"""
import sqlite3
import os

DB_PATH = '/home/z/my-project/db/custom.db'
if not os.path.exists(DB_PATH):
    print(f'Database not found at {DB_PATH}')
    exit(1)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# === Categories ===
print('=== Seeding Categories ===')
categories = [
    ('TRANSMITTAL', 'ترانسميتال', '📄', 'bg-blue-100 text-blue-700'),
    ('MIR', 'مادة', '📦', 'bg-purple-100 text-purple-700'),
    ('RFI', 'طلب معلومات', '❓', 'bg-amber-100 text-amber-700'),
    ('BOOKS', 'كتب', '📚', 'bg-emerald-100 text-emerald-700'),
]
for code, label, icon, color in categories:
    c.execute('SELECT code FROM Category WHERE code = ?', (code,))
    if c.fetchone():
        c.execute('UPDATE Category SET label=?, icon=?, color=? WHERE code=?', (label, icon, color, code))
        print(f'  ✓ Updated {code}')
    else:
        c.execute('INSERT INTO Category (id, code, label, icon, color, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
                  (f'cat-{code.lower()}', code, label, icon, color, '2026-07-10 00:00:00', '2026-07-10 00:00:00'))
        print(f'  ✓ Created {code}')

# === Disciplines ===
print('\n=== Seeding Disciplines ===')
disciplines = [
    ('CIV',  'المدنية',     'bg-amber-100 text-amber-700',   'CIV-',  'TRANSMITTAL'),
    ('EL',   'الكهربائية',  'bg-purple-100 text-purple-700', 'EL-',   'TRANSMITTAL'),
    ('PL',   'الصحي',       'bg-cyan-100 text-cyan-700',     'PL-',   'TRANSMITTAL'),
    ('HVAC', 'التكييف',     'bg-rose-100 text-rose-700',     'HAVC-', 'TRANSMITTAL'),
    ('FF',   'الحريق',      'bg-red-100 text-red-700',       'FF-',   'TRANSMITTAL'),
    ('ELVE', 'المصاعد',     'bg-emerald-100 text-emerald-700', 'ELEV ', 'TRANSMITTAL'),
]
for code, label, color, prefix, categoryCode in disciplines:
    c.execute('SELECT code FROM Discipline WHERE code = ?', (code,))
    if c.fetchone():
        c.execute('UPDATE Discipline SET label=?, color=?, prefix=?, categoryCode=? WHERE code=?',
                  (label, color, prefix, categoryCode, code))
        print(f'  ✓ Updated {code}')
    else:
        c.execute('INSERT INTO Discipline (id, code, label, color, prefix, categoryCode, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)',
                  (f'disc-{code.lower()}', code, label, color, prefix, categoryCode, '2026-07-10 00:00:00', '2026-07-10 00:00:00'))
        print(f'  ✓ Created {code}')

# === Document Types ===
print('\n=== Seeding Document Types ===')
doc_types = [
    ('SHOP_DRAWINGS', 'رسم تنفيذي'),
    ('SAMPLE', 'عينة'),
    ('SOURCE_APPROVAL', 'اعتماد مصدر'),
    ('TEST_REPORT', 'تقرير اختبار'),
    ('METHOD_STATEMENT', 'طريقة تنفيذ'),
    ('CALCULATION', 'حسابات'),
    ('SPECIFICATION', 'مواصفات'),
    ('CATALOG', 'كتالوج'),
    ('AS_BUILT', 'كما نُفذ'),
    ('OTHER', 'أخرى'),
]
for code, label in doc_types:
    c.execute('SELECT code FROM DocType WHERE code = ?', (code,))
    if c.fetchone():
        c.execute('UPDATE DocType SET label=? WHERE code=?', (label, code))
        print(f'  ✓ Updated {code}')
    else:
        c.execute('INSERT INTO DocType (id, code, label, createdAt, updatedAt) VALUES (?,?,?,?,?)',
                  (f'dt-{code.lower()}', code, label, '2026-07-10 00:00:00', '2026-07-10 00:00:00'))
        print(f'  ✓ Created {code}')

conn.commit()

# === Verify ===
print('\n=== Verification ===')
c.execute('SELECT COUNT(*) FROM Category')
print(f'Categories: {c.fetchone()[0]}')
c.execute('SELECT COUNT(*) FROM Discipline')
print(f'Disciplines: {c.fetchone()[0]}')
c.execute('SELECT COUNT(*) FROM DocType')
print(f'DocTypes: {c.fetchone()[0]}')

conn.close()
print('\n✅ Seed complete!')
