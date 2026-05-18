# Port Management Guide

## Problem: Port Already in Use

If you see an error like:
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
```

This means another process is already using port 3000 (usually another instance of your backend server).

## Quick Fix

### Mac/Linux

1. **Find processes using port 3000:**
   ```bash
   lsof -ti:3000
   ```

2. **Kill all processes on port 3000:**
   ```bash
   kill -9 $(lsof -ti:3000)
   ```

   Or manually kill specific PIDs:
   ```bash
   kill -9 <PID1> <PID2>
   ```

### Windows

1. **Find process using port 3000:**
   ```cmd
   netstat -ano | findstr :3000
   ```

2. **Kill the process:**
   ```cmd
   taskkill /PID <PID> /F
   ```

## Prevention

### Option 1: Always Stop Previous Server

Before starting a new server:
- Press `Ctrl+C` in the terminal where the server is running
- Wait for it to fully stop
- Then start a new instance

### Option 2: Use a Different Port

Edit `backend/.env` and change:
```env
PORT=3001
```

Then update `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

### Option 3: Create a Stop Script

**Mac/Linux:** Create `backend/scripts/stop.sh`:
```bash
#!/bin/bash
echo "Stopping servers on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
echo "Port 3000 is now free"
```

**Windows:** Create `backend/scripts/stop.bat`:
```batch
@echo off
echo Stopping servers on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F
echo Port 3000 is now free
```

## Common Ports

- **Backend:** 3000 (default)
- **Frontend (Dev):** 5173 (Vite default)
- **Frontend (Prod):** Served by backend on port 3000
- **Database:** 5432 (PostgreSQL default)

## Check What's Running

### Mac/Linux
```bash
# Check backend port
lsof -i:3000

# Check frontend port  
lsof -i:5173

# Check database port
lsof -i:5432
```

### Windows
```cmd
# Check all ports
netstat -ano | findstr LISTENING
```

## Troubleshooting

### Port won't free up?

1. Wait a few seconds - sometimes processes take time to fully stop
2. Restart your terminal/command prompt
3. Restart your computer (if nothing else works)

### Multiple backend instances?

Make sure you only have ONE terminal running the backend. Check all terminal windows and tabs.

### Port changed but frontend can't connect?

1. Make sure `frontend/.env` has the correct port:
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api/v1
   ```
2. Restart the frontend dev server after changing `.env`

---

**Need Help?** Check the main `README.md` or `QUICK_START.md` for more details.

