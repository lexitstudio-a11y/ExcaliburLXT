@echo off
REM Double-cliquez ce fichier depuis le dossier ExcaliburLXT décompressé.
set DEST=%APPDATA%\Adobe\CEP\extensions\ExcaliburLXT
xcopy /E /I /Y "%~dp0" "%DEST%" >nul
for %%V in (9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo Installe dans %DEST%
echo Redemarrez Premiere Pro : Fenetre ^> Extensions ^> ExcaliburLXT
pause
