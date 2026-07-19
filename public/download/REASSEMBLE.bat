@echo off
cd /d "%~dp0"
echo Reassembling...
copy /b part.zip.00 + part.zip.01 + part.zip.02 + part.zip.03 + part.zip.04 Site-Secretary-Windows.zip
echo Done! Site-Secretary-Windows.zip is ready.
pause
