@echo off
echo Starting Backend...
cd /d "C:\Users\adity\Desktop\Sem II\Project\Backend"
start cmd /k python app.py

echo Starting Frontend...
cd /d "C:\Users\adity\Desktop\Sem II\Project\Frontend"
start cmd /k python -m http.server 5500

echo Opening Browser...
timeout /t 3 > nul
start http://127.0.0.1:5500