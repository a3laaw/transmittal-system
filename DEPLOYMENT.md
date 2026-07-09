# 🚀 دليل النشر: Supabase + GitHub + Vercel

## الخطوة 1: إنشاء قاعدة بيانات Supabase

1. اذهب إلى https://supabase.com وأنشئ حساب
2. اضغط **New Project**
3. اختر:
   - **Name**: `transmittal-db`
   - **Database Password**: احفظ كلمة المرور
   - **Region**: اختر الأقرب (مثلاً Frankfurt أو Singapore)
4. انتظر حتى يُنشأ المشروع (دقيقة تقريباً)
5. اذهب إلى **Settings → Database → Connection string**
6. انسخ الـ URL، سيكون شكله:
   ```
   postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres
   ```

## الخطوة 2: رفع المشروع على GitHub

```bash
# في مجلد المشروع
git add .
git commit -m "Prepare for deployment: Supabase + Vercel"
git push origin main
```

إذا لم يكن لديك repo:
1. اذهب إلى https://github.com → **New repository**
2. اسم: `transmittal-system`
3. **Private** (أفضل للخصوصية)
4. اضغط **Create repository**
5. اتبع التعليمات لربط المشروع المحلي

## الخطوة 3: إنشاء الجداول في Supabase

```bash
# ضع رابط Supabase في .env
# ثم شغّل:
cd /home/z/my-project
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" bun run db:push
```

## الخطوة 4: نقل البيانات من SQLite إلى Supabase

```bash
python3 scripts/migrate_to_supabase.py \
  /home/z/my-project/db/custom.db \
  "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
```

## الخطوة 5: النشر على Vercel

1. اذهب إلى https://vercel.com → سجّل بحساب GitHub
2. اضغط **Add New → Project**
3. اختر الـ repository الذي أنشأته
4. في **Environment Variables** أضف:
   ```
   DATABASE_URL = postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
5. اضغط **Deploy**
6. انتظر دقيقتين → الموقع جاهز! 🎉

## ملاحظات مهمة

### الملفات المرفوعة
- ملفات الرفع (uploads) تُخزن محلياً على Vercel
- Vercel نظام مؤقت — الملفات تُحذف عند كل deploy
- **للإنتاج**: استخدم Supabase Storage بدل التخزين المحلي

### Python scripts
- النظام يستخدم Python لـ: استيراد Excel، تصدير التقارير، توليد قوالب Excel
- Vercel لا يدعم Python في Next.js projects بشكل مباشر
- **الحل**: تحويل سكربتات Python إلى JavaScript (مستقبلاً)

### تحديثات مستقبلية مقترحة
1. استبدال openpyxl بمكتبة JavaScript (مثل exceljs)
2. استبدال سكربتات استيراد Python بـ JavaScript
3. استخدام Supabase Storage للملفات المرفوعة
