@echo off
cd /d "%~dp0"
python scripts\quiz_server.py --host 127.0.0.1 --port 8765
pause
