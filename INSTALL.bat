@echo off
REM INSTALL.bat — تنصيب سهل جداً (ديسك توب / ويندوز)
echo جاري التنصيب...
if not exist .env (
  echo DATABASE_URL=file:./db/custom.db > .env
  echo تم إنشاء .env
)
echo 1) npm install
echo 2) npm run build
echo 3) npm run build:exe (لو عاوز .exe)
echo بعد ما يخلص، افتح مجلد dist -> هتلاقي .exe
pause
