@echo off
cd /d "%~dp0"
echo Reassembling Site-Secretary-Windows.zip...
copy /b Site-Secretary-Windows.zip.00 + Site-Secretary-Windows.zip.01 + Site-Secretary-Windows.zip.02 Site-Secretary-Windows.zip
echo Done! Site-Secretary-Windows.zip is ready.
echo Extract it and run RUN.bat
pause
