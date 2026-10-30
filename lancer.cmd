@echo off
title LoL Draft Coach
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js est introuvable : installe-le depuis https://nodejs.org puis relance. & pause & exit /b 1)
where git >nul 2>nul && (git pull --ff-only --quiet 2>nul & call npm install --silent)
if not exist node_modules (echo Premiere installation... & call npm install --silent)
node companion\index.mjs
pause
