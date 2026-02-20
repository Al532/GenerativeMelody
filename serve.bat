@echo off
setlocal

REM Port configurable (par défaut 8000)
set PORT=8000

REM Ouvre le navigateur
start "" http://localhost:%PORT%/

REM Lance le serveur dans le dossier courant
python -m http.server %PORT%
