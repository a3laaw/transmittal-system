# 📋 سجل الميزات الشامل — نظام سكرتير الموقع (Site Secretary)

> **المرجع الرسمي لكل ميزة في النظام.**
> كل ميزة موثقة مع: الوصف · كيفية العمل · الملفات المرتبطة · الحالة.

---

## 1. التخصصات الفرعية لكل قسم رئيسي ✅

### الوصف
كل قسم رئيسي له تخصصاته الفرعية الخاصة به، جاهزة عند أول تشغيل.

### الأقسام والتخصصات الافتراضية
| القسم | التخصصات |
|------|----------|
| 📄 ترانسميتال | مدنية، كهربائية، صحي، تكييف، حريق، مصاعد (6) |
| 📦 MIR | مواد مدنية، كهربائية، صحية، تكييف، حريق (5) |
| ✅ تشيك ليست | مدنية، كهربائية، ميكانيكية (3) |
| ❓ RFI | مدنية، كهربائية، صحي، تكييف، حريق، مصاعد (6) |
| 📚 كتب | واردة، صادرة (2) |
| **المجموع** | **22 تخصص** |

### الملفات
- `src/lib/db.ts` — `ensureSeedData()` يضيف 5 أقسام + 22 تخصص + 10 أنواع مستندات
- `prisma/schema.prisma` — نماذج Category, Discipline, DocType

### الحالة: ✅ مكتمل

---

## 2. نظام الترجمة الكامل (i18n — عربي/إنجليزي) ✅

### الوصف
زر تبديل اللغة 🇬🇧/🇸🇦 يترجم كل النصوص فوراً + يقلب اتجاه الصفحة (RTL/LTR).

### كيفية العمل
- `src/lib/i18n/ar.json` + `en.json` — مفاتيح ترجمة
- `src/lib/i18n/useI18n.tsx` — `LanguageProvider` + `useI18n` hook + `useFmtDate`
- `localStorage` يحفظ اللغة المختارة
- `<html dir="rtl|ltr">` يتحدث تلقائياً
- حقول `labelEn` في كل قسم/تخصص/نوع مستند

### الملفات
- `src/lib/i18n/ar.json`, `en.json`, `useI18n.tsx`
- `src/app/layout.tsx` — LanguageProvider يلف التطبيق
- `src/app/page.tsx` — زر 🇬🇧/🇸🇦 + ترجمة كل النصوص

### الحالة: ✅ مكتمل

---

## 3. tabs للأقسام الرئيسية في الـ Dashboard ✅

### الوصف
في صفحة الـ Dashboard، توجد tabs في الأعلى للتبديل بين الأقسام (الكل / ترانسميتال / MIR / تشيك ليست / RFI / كتب).

### الملفات
- `src/app/page.tsx` — `DashboardView` مع `activeTab` state

### الحالة: ✅ مكتمل

---

## 4. مسار الحفظ مع مجلد لكل ترانسميتال ✅

### الوصف
كل ترانسميتال له مجلد خاص به يُخزّن فيه كل ملفاته المرفوعة.

### كيفية العمل
- المسار: `storage/uploads/{transmittalId}/`
- عند رفع ملف: يُنشأ مجلد الترانسميتال تلقائياً إن لم يكن موجوداً
- عند حذف الترانسميتال: المجلد يُحذف معه (cascade)

### الملفات
- `src/app/api/transmittals/[id]/upload/route.ts` — رفع الملفات
- `src/app/api/transmittals/[id]/attachments/route.ts` — حذف المرفقات
- `src/app/api/files/[transmittalId]/[filename]/route.ts` — خدمة الملفات
- `src/lib/paths.ts` — `getUploadDir(transmittalId)`

### الحالة: ✅ مكتمل

---

## 5. التعديل على المستند (EditTransmittalDialog) ✅

### الوصف
تعديل كامل لبيانات الترانسميتال:
- المرجع (مع التحقق من التفرد)
- التخصص
- النوع
- العنوان المختصر (alternativeTitle)
- الوصف

### الملفات
- `src/app/page.tsx` — `EditTransmittalDialog`
- `src/app/api/transmittals/[id]/route.ts` — PATCH endpoint

### الحالة: ✅ مكتمل

---

## 6. حذف الترانسميتال (DeleteTransmittalDialog) ✅

### الوصف
حذف الترانسميتال مع تأكيد بكتابة المرجع بالضبط (مثل GitHub).

### الملفات
- `src/app/page.tsx` — `DeleteTransmittalDialog`
- `src/app/api/transmittals/[id]/route.ts` — DELETE endpoint

### الحالة: ✅ مكتمل

---

## 7. alternativeTitle في التقارير ✅

### الوصف
كل ترانسميتال له `alternativeTitle` (عنوان مختصر). في التقارير والقائمة الإنجليزية، يُستخدم هذا الحقل بدل الوصف الطويل.

### الملفات
- `prisma/schema.prisma` — `Transmittal.alternativeTitle`
- `src/lib/db.ts` — `ensureMigrations()` يضيف العمود
- `src/app/page.tsx` — استخدام alternativeTitle في ListView + EditDialog

### الحالة: ✅ مكتمل

---

## 8. حقول labelEn (عربي/إنجليزي) ✅

### الوصف
كل قسم رئيسي، تخصص فرعي، ونوع مستند له:
- `label` — الاسم بالعربية
- `labelEn` — الاسم بالإنجليزية

عند تبديل اللغة، تُستخدم الاسم المناسب تلقائياً.

### الملفات
- `prisma/schema.prisma` — `labelEn` في Category, Discipline, DocType
- `src/lib/db.ts` — `ensureMigrations()` + `ensureSeedData()` بـ labelEn
- `src/app/page.tsx` — استخدام labelEn ديناميكياً في كل القوائم

### الحالة: ✅ مكتمل

---

## 9. مسح البيانات محمي بكلمة مرور ✅

### الوصف
مسح كل الترانسميتالات + المراجعات + الردود + المرفقات. يتطلب كلمة مرور `0160`.

### الملفات
- `src/app/api/wipe-data/route.ts` — POST مع `{ password: '0160' }`
- يحذف أيضاً مجلد `storage/uploads/` كاملاً

### الحالة: ✅ مكتمل

---

## 10. رفع الملفات (صور + PDF + Word) ✅

### الوصف
رفع ملفات متعددة الأنواع وربطها بالترانسميتال:
- صور: PNG, JPG, GIF, WebP, BMP, SVG
- مستندات: PDF, DOC, DOCX

### الملفات
- `src/app/api/transmittals/[id]/upload/route.ts` — multipart/form-data + JSON (link)

### الحالة: ✅ مكتمل

---

## 11. تنزيل الملفات ببيانات نظيفة ✅

### الوصف
تنزيل الملفات بدون تلف باستخدام base64 data URL (الأكثر موثوقية).

### الملفات
- `src/app/api/file-data/[attId]/route.ts` — base64 data URL
- `src/app/api/files/[transmittalId]/[filename]/route.ts` — streaming file serving

### الحالة: ✅ مكتمل

---

## 12. تتبع المراجعات (REV.0 - REV.7) ✅

### الوصف
كل ترانسميتال له سجل مراجعات مرقم. كل مراجعة لها:
- تاريخ الإرسال
- تاريخ الرد (يُسجّل لاحقاً)
- الإجراء (approved / rejected / withdrawn)
- نوع القبول (A-E) عند الـ approved

### الملفات
- `src/app/api/transmittals/[id]/revisions/route.ts`
- `src/app/page.tsx` — `AddRevisionDialog`, `ConsultantReplyDialog`

### الحالة: ✅ مكتمل

---

## 13. سير عمل الاستشاري والوزارة (MOH) ✅

### الوصف
- تسجيل رد الاستشاري على آخر مراجعة (action + approvalType + replyDate)
- إرسال للوزارة (يتطلب اعتماد الاستشاري أولاً)
- تسجيل رد الوزارة (status + reviewDate)

### الملفات
- `src/app/api/transmittals/[id]/reviews/route.ts`
- `src/app/api/transmittals/[id]/send-to-moh/route.ts`
- `src/app/page.tsx` — `ConsultantReplyDialog`, `MohReplyDialog`, `SendToMohDialog`

### الحالة: ✅ مكتمل

---

## 14. التقارير والجدول الزمني ✅

### الوصف
- جدول زمني شامل: كل ترانسميتال صف، كل مراجعة عمود (تقديم/رد/إجراء)
- طباعة (window.open + A4 landscape)
- تصدير Excel (ExcelJS)
- فلترة بالقسم/التخصص/النوع/التاريخ

### الملفات
- `src/app/api/reports/timeline/route.ts`
- `src/app/api/reports/export/route.ts`
- `src/app/page.tsx` — `ReportsView`

### الحالة: ✅ مكتمل

---

## 15. شاشة إنشاء ريفجن خالية من الرد والإجراء ✅

### الوصف
عند إنشاء ريفجن جديد، الشاشة تعرض فقط "تاريخ التقديم". الرد والإجراء يُسجّلان لاحقاً عبر "تسجيل رد الاستشاري".

### الملفات
- `src/app/page.tsx` — `AddRevisionDialog`

### الحالة: ✅ مكتمل

---

## 16. ربط الكتب (صادر/وارد) ✅

### الوصف
كل ترانسميتال يمكن ربطه بترانسميتال آخر (parent). مفيد للكتب الواردة المرتبطة بكتب صادرة.

### الملفات
- `prisma/schema.prisma` — `Transmittal.parentTransmittalId` + relation
- `src/app/page.tsx` — `NewTransmittalView` حقل ربط بكتاب آخر

### الحالة: ✅ مكتمل

---

## 17. قوالب مخصصة لكل قسم ✅

### الوصف
كل قسم رئيسي يمكن أن يقالبه الخاص (Excel/Word/PDF). يُرفع من الإعدادات ويُستخدم عند توليد الملفات.

### الملفات
- `src/app/api/categories/route.ts` — POST مع FormData (template file)
- `src/app/api/templates/[code]/route.ts` — خدمة القالب
- `src/app/page.tsx` — `AddCategoryDialog`, `EditCategoryDialog` (رفع قالب)

### الحالة: ✅ مكتمل

---

## 18. نسخ الترانسميتال ✅

### الوصف
نسخ ترانسميتال بمرجع جديد تلقائي + إمكانية تعديل الوصف قبل النسخ.

### الملفات
- `src/app/api/transmittals/[id]/copy/route.ts`
- `src/app/page.tsx` — `CopyTransmittalDialog`

### الحالة: ✅ مكتمل

---

## 19. ترتيب حسب التاريخ (في التقارير) ✅

### الوصف
القائمة والتقارير مرتبة حسب آخر تاريخ إرسال (الأقدم أولاً).

### الملفات
- `src/app/api/transmittals/route.ts` — JS sort بـ `lastSubmitDate`
- `src/app/api/reports/timeline/route.ts` — نفس الفرز
- `src/app/api/reports/export/route.ts` — نفس الفرز

### الحالة: ✅ مكتمل

---

## 20. نسخة ويندوز (Electron + RUN.bat) ✅

### الوصف
نسخة ويندوز محمولة:
- `RUN.bat` — يشغل Electron (أو المتصفح كـ fallback)
- `electron-main.js` — Electron main process
- `preload.js` — contextBridge
- Next.js standalone server
- Prisma + قاعدة بيانات seed (5 أقسام + 22 تخصص + 10 أنواع)
- مجلد storage جاهز

### الملفات
- `RUN.bat` — مشغل ويندوز
- `electron-main.js` — Electron
- `preload.js` — preload script
- `README.md` — دليل الاستخدام
- `scripts/build_windows_zip.sh` — سكربت البناء

### الحالة: ✅ مكتمل

---

## 📊 ملخص الحالات

| # | الميزة | الحالة |
|---|--------|------|
| 1 | 22 تخصص فرعي لكل قسم | ✅ |
| 2 | نظام i18n كامل | ✅ |
| 3 | tabs للأقسام في Dashboard | ✅ |
| 4 | مجلد لكل ترانسميتال | ✅ |
| 5 | تعديل الترانسميتال | ✅ |
| 6 | حذف الترانسميتال | ✅ |
| 7 | alternativeTitle في التقارير | ✅ |
| 8 | حقول labelEn | ✅ |
| 9 | مسح البيانات بكلمة مرور | ✅ |
| 10 | رفع الملفات | ✅ |
| 11 | تنزيل الملفات | ✅ |
| 12 | تتبع المراجعات | ✅ |
| 13 | سير عمل الاستشاري/الوزارة | ✅ |
| 14 | التقارير والجدول الزمني | ✅ |
| 15 | شاشة ريفجن خالية | ✅ |
| 16 | ربط الكتب | ✅ |
| 17 | قوالب مخصصة | ✅ |
| 18 | نسخ الترانسميتال | ✅ |
| 19 | ترتيب حسب التاريخ | ✅ |
| 20 | نسخة ويندوز + RUN.bat | ✅ |

**كل الميزات مكتملة ✅**
