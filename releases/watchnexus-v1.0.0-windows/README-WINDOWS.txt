WatchNexus v1.0.0 - Windows Release
====================================

PREREQUISITES:
1. Python 3.11+ (https://www.python.org/downloads/)
   - IMPORTANT: Check "Add Python to PATH" during installation
   
2. MongoDB 7.0 (https://www.mongodb.com/try/download/community)
   - Install as a Windows Service

QUICK START:
1. Install prerequisites above
2. Double-click START-WATCHNEXUS.bat
3. Wait for setup to complete (first run only)
4. Open http://localhost:8001 in your browser

MANUAL START:
1. Open Command Prompt in this folder
2. cd backend
3. python -m venv venv (first time only)
4. venv\Scripts\activate
5. pip install -r requirements.txt (first time only)
6. python -m uvicorn server:app --host 127.0.0.1 --port 8001

TROUBLESHOOTING:
- "python not found": Reinstall Python with "Add to PATH" checked
- "MongoDB connection failed": Ensure MongoDB service is running
- Port 8001 in use: Change port in the uvicorn command

For detailed instructions: docs/BUILD_GUIDE.md
