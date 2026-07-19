
---
Task ID: final-fix
Agent: Main (Super Z)
Task: إصلاح نهائي شامل + بناء نسخة ويندوز

Work Log:
- اكتشفت أن ملف page.tsx رجع لحالة قديمة بدون كل التحسينات السابقة
- اكتشفت أن مجلد i18n بالكامل مفقود
- اكتشفت أن upload route و wipe-data route مفقودان
- اكتشفت أن Prisma schema لا يحتوي على labelEn / alternativeTitle

الإصلاحات:
1. إعادة إنشاء src/lib/i18n/ (ar.json + en.json + useI18n.tsx)
2. إضافة LanguageProvider إلى layout.tsx
3. إضافة useI18n import + زر تبديل اللغة 🇬🇧/🇸🇦 في الـ header
4. إضافة tabs للأقسام الرئيسية في الـ Dashboard
5. ترجمة ListView بالكامل (filters + table headers + dropdown menu)
6. إضافة EditTransmittalDialog (تعديل المرجع + التخصص + النوع + alternativeTitle + الوصف)
7. إضافة DeleteTransmittalDialog (مع تأكيد بكتابة المرجع)
8. إنشاء upload route مع مجلد لكل ترانسميتال (storage/uploads/{transmittalId}/)
9. إنشاء wipe-data route (مسح البيانات بكلمة مرور 0160)
10. تحديث Prisma schema بإضافة:
    - Category.labelEn
    - Discipline.labelEn
    - DocType.labelEn + categoryCode + relation
    - Transmittal.alternativeTitle
11. تحديث ensureSeedData() لتضمين:
    - 5 أقسام رئيسية (TRANSMITTAL, MIR, CHECK_LIST, RFI, BOOKS) مع labelEn
    - 22 تخصص فرعي موزعة على الأقسام (6 TRANSMITTAL + 5 MIR + 3 CHECK_LIST + 6 RFI + 2 BOOKS)
    - 10 أنواع مستندات مع labelEn
12. تحديث ensureMigrations() لإضافة الأعمدة المفقودة في DBs القديمة
13. تحديث PATCH /api/transmittals/[id] لدعم reference + alternativeTitle
14. تحديث POST /api/transmittals لدعم alternativeTitle
15. تحديث GET /api/transmittals لإرجاع alternativeTitle
16. إضافة package.json "main": "electron-main.js"
17. إنشاء preload.js (contextBridge for Electron)
18. إنشاء scripts/build_windows_zip.sh

الاختبار:
- ✅ next build نجح
- ✅ TypeScript: لا أخطاء
- ✅ 22 تخصص مع labelEn موزعة على 5 أقسام
- ✅ تعديل الترانسميتال (PATCH) يعمل مع reference + alternativeTitle
- ✅ رفع الملفات مع مجلد لكل ترانسميتال
- ✅ حذف الترانسميتال يعمل
- ✅ wipe-data route يعمل مع كلمة المرور

نسخة ويندوز:
- /home/z/my-project/download/Site-Secretary-Windows.zip (261 MB)
- تحتوي على: Next.js standalone + Electron + Prisma + DB + templates + storage

Stage Summary:
- جميع الميزات المطلوبة مُنفّذة ومُختبَرة
- نسخة ويندوز جاهزة للتحميل

---
Task ID: final-clean-build
Agent: Main (Super Z)
Task: إصلاح مشكلة zip بداخل zip + بناء نسخة ويندوز نظيفة

Work Log:
- اكتشفت أن النسخة السابقة (261 MB) كانت تحتوي على:
  * download/Site-Secretary-Windows.zip (نسخة قديمة بداخلها!)
  * download/transmittal-system.zip (نسخة قديمة أخرى)
  * مجلد skills/ كامل (100+ MB غير ضروري)
  * لا يوجد RUN.bat

الإصلاحات:
1. إنشاء FEATURE_LOG.md شامل لكل 20 ميزة
2. إنشاء RUN.bat (مشغل ويندوز مع fallback للمتصفح)
3. إنشاء README.md شامل (دليل الاستخدام + استكشاف الأخطاء)
4. إعادة كتابة scripts/build_windows_zip.sh:
   * حذف download/, skills/, scripts/, .git, examples/, mini-services/ من النسخة
   * حذف ملفات log غير ضرورية
   * إضافة RUN.bat + README.md + electron-main.js + preload.js في الجذر
   * فحص تلقائي للـ nested zips وحذفها
   * نسخ Prisma Windows engine
5. تنظيف storage/uploads/ من بيانات الاختبار

النتيجة:
- الحجم: 70 MB (بدلاً من 261 MB — تقليل 73%)
- لا توجد أي ملفات zip بداخلها ✅
- RUN.bat موجود في الجذر ✅
- electron-main.js + preload.js موجودان ✅
- README.md موجود ✅
- 5 أقسام + 22 تخصص + 10 أنواع مستندات (مع labelEn) ✅

اختبار شامل:
- ✅ الصفحة تُحمّل (200)
- ✅ 5 categories, 22 disciplines, 10 doc types
- ✅ Create + Edit (reference + alternativeTitle) + Delete transmittal
- ✅ Upload file → مجلد منفصل لكل ترانسميتال
- ✅ Wipe-data route مع كلمة المرور

النسخة النهائية:
- /home/z/my-project/download/Site-Secretary-Windows.zip (70 MB)
- نظيفة تماماً بدون zip بداخل zip
- جاهزة للاستخدام على ويندوز
