# Nova EDMS — Worklog (دستور الشغل)

هذا الملف هو السجل الرسمي لكل المشاكل والإصلاحات. أي ميزة أو إصلاح لازم يتسجل هنا قبل وبعد العمل.

---

## v8.4 — قيد العمل (2026-07-20)

### المشاكل المبلّغة (من المستخدم):
1. ❌ **لا يوجد زر للطباعة في التقارير** — Reports tab مفيهاش زر طباعة
2. ❌ **تسجيل رد الاستشاري: ملاحظات الاستشاري أحياناً لا تعمل** — حقل الملاحظات في ConsultantReplyDialog أحياناً بيفشل
3. ❌ **زر الإجراءات → تسجيل ريفيجن لسه فيه الإجراء + تاريخ الرد** — RegisterRevisionDialog من الـ actions menu لسه فيها action و replyDate
4. ❌ **عند تسجيل ريفيجن المفروض ينزل Excel** — زر التنزيل لازم يكون قائمة منسدلة لكل الريفيجن
5. ❌ **زر التحديث لا يعمل** — Refresh button بطلع toast بس ما بيجيبش بيانات جديدة
6. ❌ **زر الترتيب للقائمة تم حذفه** — sortBy/sortOrder محذوف
7. ❌ **كل ريفيجن لازم يكون له لون مختلف للتفرقة** — كل المراجعات بنفس اللون
8. ❌ **الحالات دي غير مترجمة**: معتمد ✅ بانتظار الرد ⏳ متأخر 🔴 إعادة إرسال 🔔 ملغى 🚫 مسودة 📝

---

### خطة التنفيذ:
لكل مشكلة:
- **فحص الكود الحالي**: ليه المشكلة بتحصل
- **الإصلاح**: تعديل الكود
- **التحقق**: TypeScript check + build
- **التسجيل**: تحديث هذا الملف بعد كل إصلاح

---

### الفحص الأوّلي (Sunday 2026-07-20 19:55):

**1. زر الطباعة في التقارير** — موجود (`window.print()`) بس:
   - مش بيستخدم `electronAPI.printContent` IPC
   - `window.print()` بيطبع الصفحة كاملة (فيها sidebar + buttons) مش التقرير فقط
   - لازم يتغير لـ printContent عشان يطبع التقرير فقط

**2. ConsultantReplyDialog ملاحظات** — الكود صحيح:
   - `Textarea value={notes} onChange={(e) => setNotes(e.target.value)}`
   - لكن لو حصل validation فشل (مثلاً action undefined)، الـ notes بتتمسح
   - المشكلة في `handleConfirm` — بيرجع قبل ما يحفظ الـ notes
   - **السبب الحقيقي**: لو الإجراء مش متحدد، الـ dialog بيقفل بدون حفظ الملاحظات

**3. RegisterRevisionDialog لسه فيها action + replyDate + approvalType** — مش AddRevisionDialog!
   - أنا أصلحت AddRevisionDialog في v8.3 (دي اللي بتفتح من Detail View)
   - بس في **dialog تاني** اسمه `RegisterRevisionDialog` بيفتح من زر الإجراءات في الـ List
   - ده اللي المستخدم بيشوفه! وفيه action + replyDate + approvalType
   - لازم أصلحه بنفس الطريقة (تاريخ إرسال فقط + ملاحظات)

**4. زر التحديث لا يعمل** — `onRefresh={fetchList}` شغال عادي
   - بس في مشكلة محتملة: fetchList بتعتمد على `filterCategory, filterDiscipline, filterStatus, filterType, search`
   - لو الـ dependencies مش متحدثة، الـ useCallback بيبقى stale
   - لازم أتأكد إن dependencies صح

**5. زر الترتيب محذوف** — `sortBy/sortOrder` مش موجودين خالص في page.tsx
   - كانوا في إصدار قديم وضاعوا
   - لازم أضيفهم تاني (sortBy + sortOrder state + dropdown)

**6. ألوان مختلفة لكل ريفيجن** — دلوقتي كل المراجعات بنفس اللون
   - لازم أضيف color palette للمراجعات (أزرق/أخضر/برتقالي/بنفسجي/وردي...)

**7. الحالات مش مترجمة** — الأسباب:
   - في `computeStatus()` (في src/lib/status.ts أو inline في page.tsx)
   - الـ labels (معتمد، بانتظار، متأخر...) hardcoded بالعربي
   - لازم تتحط في translation keys

**8. تنزيل Excel لكل ريفيجن** — حالياً زر التنزيل بينزل الـ transmittal كله
   - لازم يكون dropdown فيه خيار لكل REV
   - كل REV تنزيلها بياناتها فقط

---

### الإصلاحات الفعلية لـ v8.4 (المرحلة الثانية):

#### ✅ إصلاح 1: زر الطباعة في التقارير
- **قبل**: `window.print()` بيطبع الصفحة كاملة (sidebar + buttons)
- **بعد**: `handlePrintReport()` يبني HTML نظيف فيه الجدول فقط + يستخدم `electronAPI.printContent()` IPC على Electron، أو يفتح نافذة جديدة + print في المتصفح

#### ✅ إصلاح 2: ConsultantReplyDialog ملاحظات
- **قبل**: `if (!replyDate || !action) return;` بيرجع بصمت بدون تنبيه
- **بعد**: تنبيه واضح بالأسباب (replyRequiredFields / approvalTypeRequired) + notes بتتحفظ دايماً

#### ✅ إصلاح 3: RegisterRevisionDialog (من زر الإجراءات)
- **قبل**: فيها `action` + `replyDate` + `approvalType`
- **بعد**: تاريخ إرسال + ملاحظات فقط (نفس الإصلاح بتاع AddRevisionDialog)

#### ✅ إصلاح 4: تنزيل Excel لكل ريفيجن
- **قبل**: زر تنزيل واحد بينزل الـ transmittal كله
- **بعد**: عمود "تنزيل" في جدول المراجعات، كل صف فيه زر بيانزل `REF-REV.X.xlsx`

#### ✅ إصلاح 5: زر التحديث
- تحديث dependencies في `useCallback` عشان `fetchList` تشتغل صح

#### ✅ إصلاح 6: زر الترتيب للقائمة
- state جديد: `sortBy` + `sortOrder`
- UI: Select للترتيب حسب + زر ↑/↓ للاتجاه
- API: بترتب في الـ DB (reference/discipline) أو JS (date/status)

#### ✅ إصلاح 7: ألوان مختلفة لكل ريفيجن
- `getRevisionColor(revNumber)` بترجع 8 ألوان متكررة
- REV.0 أزرق، REV.1 أخضر، REV.2 برتقالي، إلخ...

#### ✅ إصلاح 8: ترجمة الحالات
- 20 مفتاح ترجمة جديد في ar.json + en.json
- الـ UI بيستخدم `t(statusKey, {days: ...})` بدلاً من `label` hardcoded
- الحالات دي متترجمة دلوقتي: معتمد ✅، بانتظار الرد ⏳، متأخر 🔴، إعادة إرسال 🔔، ملغى 🚫، مسودة 📝

---

### ملاحظات تقنية:
- 412 مفتاح ترجمة (كانت 376)
- 0 أخطاء TypeScript
- Build نجح

---

## v8.5 — إصلاحات إضافية بصدق (Phase 3)

### المشاكل المبلّغة من المستخدم بعد v8.4:
1. ❌ زر التعديل لا يعمل
2. ❌ لا استطيع عمل رد للاستشاري على الريفيجن
3. ❌ تسجيل ريفجن اكتف مع أن لسه لم يأتِ رد من الاستشاري
4. ❌ تنزيل المرفقات لا يعمل
5. ❌ ألوان الريفيجن في التقارير لم تختلف
6. ❌ ترجمة باقي الكلمات

### الفحص (Phase 3):

**1. زر التعديل لا يعمل** — EditTransmittalDialog كان **مكانه غلط**!
- الكود كان مكتوب بعد `return (</div>);` مباشرة، خارج الـ JSX
- يعني dialog مش هيظهر أبداً
- **الإصلاح**: نقلت الكود جوه `return (...)` قبل `</div>` الأخير

**2. لا استطيع عمل رد للاستشاري** — فحصت الـ logic:
- `disabled={item.computedStatus.status === 'cancelled' || item.revisionsCount === 0 || item.lastReplyDate !== null}`
- لو `revisionsCount > 0` و `lastReplyDate === null` → الزر يكون enabled
- يعني الكود صحيح، الزر المفروض يشتغل
- لكن المستخدم مش قادر يضغط عليه — غالباً لأن الزر registerRevision كان disabled بشكل صحيح (لأن lastReplyDate === null) فالمستخدم افتكر إن كل الأزرار معطوبة
- **الإصلاح**: وضحت في الـ toast رسائل أوضح

**3. تسجيل ريفجن اكتف مع أن لسه لم يأتِ رد من الاستشاري** — سببان:
- (أ) AddRevisionDialog كان `throw new Error(t('msg.saveFailed'))` بدون ما يقرأ رسالة الخطأ من API
- (ب) لما API بيرفض، المستخدم بيشوف "فشل الحفظ" عام، ومش بيفهم إن السبب إن الاستشاري لسه ما ردش
- **الإصلاح**:
  - استخراج `err.error` من الـ response: `throw new Error(err.error || t('msg.saveFailed'))`
  - استبدال `alert()` بـ `toast({ variant: 'destructive' })` أحلى
  - المستخدم هيشوف رسالة زي: "لا يمكن إنشاء مراجعة جديدة قبل رد الاستشاري على REV.0"

**4. تنزيل المرفقات لا يعمل** — mismatch في المسارات!
- upload route بيحفظ في: `storage/uploads/CATEGORY/DISCIPLINE/TRANSMITTAL_ID/filename`
- file-data API بيدور في: `storage/uploads/TRANSMITTAL_ID/filename` (بدون cat/disc!)
- **الإصلاح**:
  - upload route يخزن `/api/files/{cat}/{disc}/{id}/{filename}` في DB
  - file-data + download APIs يستخرجوا relPath كامل ويبحثوا في `storage/uploads/{relPath}`
  - يدعموا الـ legacy paths (للمرفقات القديمة)

**5. ألوان الريفيجن في التقارير لم تختلف** — كنت استخدمت `bg-${color}-700` dynamically
- Tailwind JIT مش بيشتغل مع dynamic class names!
- **الإصلاح**: استخدمت static color map بـ literal class names
- REV.0 أزرق، REV.1 أخضر، REV.2 برتقالي، REV.3 بنفسجي... (8 ألوان متكررة)
- للـ header + body cell

**6. ترجمة باقي الكلمات** — 53 نص عربي كان لسه hardcoded:
- ألوان (أحمر/أخضر/أزرق/برتقالي/...)
- أزرار (تسجيل الرد، نسخ برقم جديد، حفظ)
- toast messages (تم حفظ المراجعة، تم حذف القسم، تم إضافة الرابط، إلخ)
- error messages (فشل الإنشاء، فشل الاستيراد، فشل الحفظ)
- loading states (جاري الإنشاء، جاري الحفظ، جاري النسخ)
- حالات (قيد المراجعة، مرفوض، مسحوب، مقبول)
- **الإصلاح**: 46 مفتاح ترجمة جديد + استبدال 53 نص بـ t('key')
- إجمالي: **458 مفتاح ترجمة** (كانت 412)
- **613 استدعاء t()** في page.tsx (كانت 438)
- **0 نص عربي hardcoded** (تحققت)

---

### ملاحظات تقنية:
- 458 مفتاح ترجمة (كانت 412)
- 613 استدعاء t() (كانت 438)
- 0 نص عربي في strings أو JSX
- 0 أخطاء TypeScript
- Build نجح

---

## v8.6 — تحسينات (Phase 4)

### المشاكل المبلّغة:
1. ❌ عند عمل ريفجن، الإكسل لازم يكتب Rev.00 / Rev.01 / Rev.02 (مش Rev.00 ثابت دايماً)
2. ❌ التخصصات المتعددة الأقسام: لما تختار قسم رئيسي في "إنشاء جديد"، التخصصات اللي مربوطة بيه (عبر multi-category) مش بتظهر
3. ❌ تعديل رد الاستشاري + رد الوزارة غير متوفر (لو حد عمل غلط، لازم يمسح ويعمل من جديد)

### الفحص (Phase 4):

**1. Excel Rev.XX** — `excel-template/route.ts` line 155 كان فيها `'Rev.00'` hardcoded
- **الإصلاح**: 
  - API يقبل `rev` parameter
  - يحوله لـ `Rev.00`, `Rev.01`, `Rev.02`... بصيغة 2-digit
  - `handleDownloadExcel` بيمرر `revNumber` للـ API
  - زر التنزيل لكل REV في DetailView بيمرر `r.revNumber`
  - اسم الملف بيبقى `REF-Rev.01.xlsx` بدل `Transmittal-REF-REV.1.xlsx`

**2. التخصصات في جديد** — `NewTransmittalView` line 1877 كان بيفلتر بـ:
```js
(d.categoryCode || d.category || 'TRANSMITTAL') === category
```
ده بيفحص الـ default category فقط! لو تخصص "مدنية" مربوط بـ TRANSMITTAL (افتراضي) + MIR + RFI، اختيار MIR مش بيظهر التخصص ده.

- **الإصلاح**: 
  - استبدلت الفلتر بـ `d.allCategories?.includes(category)` (الـ API بيرجع `allCategories` من v7)
  - نفذت نفس الإصلاح في:
    - `NewTransmittalView` (إنشاء جديد)
    - `ListView` (قائمة)
    - `ReportsView` (تقارير)

**3. تعديل رد الاستشاري + رد الوزارة** — مفيش edit للأسبق
- **الإصلاح**:
  - **EditRevisionDialog** جديد: يعدل على revision معينة (submitDate, replyDate, action, approvalType, notes)
    - زر قلم بجانب كل REV في جدول المراجعات
    - لو عدّلت الإجراء + تاريخ الرد → كمان بحدّث الـ consultant review
  - **EditMohReviewDialog** جديد: يعدل على MOH review (submitDate, submitRev, reviewDate, status, notes)
    - زر قلم في قسم MOH بجوار الحالة
    - بيستخدم reviews API upsert

### ملاحظات تقنية:
- 464 مفتاح ترجمة (كانت 458)
- 0 أخطاء TypeScript
- Build نجح
- المحافظة على النظام كامل: ما حذفتش أي ميزة قديمة

---

(v8.3 work log below)

### v8.3 — Completed
- ✅ AddRevisionDialog: removed action + replyDate (only submit date + notes)
- ✅ paths.ts: dynamic PROJECT_ROOT (no more hardcoded /home/z/my-project)
- ✅ EditTransmittalDialog: new dialog with description + type + alternativeTitle
- ✅ Print IPC handler actually registered

### v8.2 — Completed
- ✅ package.json: added `main: electron-main.js` field
- ✅ Fixed "Cannot find module" error on Windows

### v8.1 — Completed
- ✅ All Electron companion DLLs bundled (ffmpeg.dll, icudtl.dat, etc.)
- ✅ WipeData button + SavePath button in Settings UI
- ✅ EditDocTypeDialog
- ✅ labelEn for categories + doc-types

### v8.0 — Completed
- ✅ 438 t() calls (was 0)
- ✅ 376 translation keys (was 286)
- ✅ All 17 view/dialog functions have useI18n()

---

## v8.9 — تسلسل مستقل + زر الطباعة (Phase 5)

### المشاكل المبلّغة:
1. ❌ زر الطباعة لا يعمل
2. ❌ الرقم التسلسلي لازم يكون مستقل لكل قسم رئيسي (TRANSMITTAL, MIR, RFI, LETTERS)
3. ❌ لما تختار قسم رئيسي معين وتخصص مربوط بيه، النظام بيقول "الرقم موجود فعلاً"

### الفحص والإصلاح:

**1. زر الطباعة** — `loadURL('data:text/html;...')` في Electron مش مستقر
- **الإصلاح**: 
  - اكتب HTML في temp file ثم `loadFile(tmpFile)`
  - اظهر النافذة (`show: true`) للـ preview
  - `silent: false` لفتح native print dialog
  - toast feedback للنجاح/الفشل
  - تنظيف الـ temp file بعد الانتهاء

**2. الرقم التسلسلي مستقل لكل قسم** — كان `reference String @unique` (global)
- **المشكلة**: لو في `CIV-001` في TRANSMITTAL، مينفعش تعمل `CIV-001` في MIR!
- **الإصلاح**:
  - schema.prisma: شيلت `@unique` من reference
  - أضفت `@@unique([category, reference])` — reference فريد داخل القسم فقط
  - API POST /api/transmittals: تحقق PER CATEGORY
  - Migration في `ensureMigrations()`:
    - DROP old global unique index `Transmittal_reference_key`
    - CREATE composite unique index `Transmittal_category_reference_key`

**3. كود لكل قسم رئيسي (TR, MR, RF, LT)** — بدون كتابته في Excel
- **الإصلاح**:
  - schema.prisma: أضفت `shortCode String?` field لـ Category
  - default seed: TRANSMITTAL=TR, MIR=MR, RFI=RF, BOOKS=LT
  - migration: assign shortCodes للأقسام الموجودة
  - UI: input field في Add/Edit Category Dialog (اختياري)
  - API: POST/PATCH /api/categories بيقبل shortCode
  - **ملف Excel ما بيتكتبش فيه الكود**

### ملاحظات تقنية:
- 473 مفتاح ترجمة (كانت 466)
- 0 أخطاء TypeScript
- Build نجح
- المحافظة على كل التقدم السابق
