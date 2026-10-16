@echo off
TITLE Serveur Projet Micro:bit
color 0A

REM Se placer dans le dossier du .bat. Sans cela, lance depuis un raccourci ou
REM une invite deja positionnee ailleurs, le serveur sert le mauvais dossier et
REM le navigateur affiche des erreurs 404 sur un.js, deux.js et trois.js.
cd /d "%~dp0"

echo ========================================================
echo   LANCEMENT DU SERVEUR LOCAL ET DE L'APPLICATION
echo ========================================================
echo.
echo Dossier servi : %CD%
echo.

if not exist "index.html" (
  echo ERREUR : index.html est introuvable dans ce dossier.
  echo Le .bat doit rester a cote des fichiers du projet.
  pause
  exit /b 1
)
if not exist "app.py" (
  echo ERREUR : app.py est introuvable.
  pause
  exit /b 1
)
if not exist "firmware.hex" (
  echo ATTENTION : firmware.hex est absent, le telechargement du .hex echouera.
  echo.
)

REM On passe par app.py plutot que par "python -m http.server" : il envoie des
REM en-tetes interdisant la mise en cache. Sans cela le navigateur ressert un
REM ancien index.html ou un.js apres modification, et on teste la version
REM precedente sans s'en apercevoir. app.py ouvre aussi le navigateur tout seul,
REM une fois le serveur pret.

echo Le serveur web tourne dans cette fenetre.
echo ATTENTION : Si vous fermez cette fenetre, le serveur s'arretera.
echo.
python app.py

echo.
echo Le serveur s'est arrete. Si le port 8000 etait deja occupe, fermez
echo l'autre fenetre de serveur puis relancez ce fichier.
pause
