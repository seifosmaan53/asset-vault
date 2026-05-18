# How to Start InvoiceMe

## 🚀 Easiest Way (Mac) - Double-Click to Start!

**Just double-click `Start InvoiceMe.command`** in Finder!

This will:
1. ✅ Open Terminal automatically
2. ✅ Check if Node.js is installed (and install it via Homebrew if needed)
3. ✅ Check if npm is installed
4. ✅ Check if PostgreSQL is installed (and offer to install it)
5. ✅ Install all dependencies automatically
6. ✅ Set up the database
7. ✅ Start the application

**That's it!** No terminal commands needed - just double-click and follow the prompts.

---

## Alternative: Run from Terminal

If double-clicking doesn't work, or you're on Windows/Linux:

```bash
# Navigate to project directory
cd "/Users/seifosman/Desktop/invoice maker : inventory management"

# Run the startup script
node first-time-startup.js
```

---

## What Gets Installed Automatically

The script will automatically:

- **Node.js** (if missing and Homebrew is available)
- **PostgreSQL** (if missing and Homebrew is available, or via Docker)
- **All npm packages** for backend and frontend
- **Database setup** (migrations and optional demo data)

---

## Manual Setup (If Script Fails)

If the automated script doesn't work, see [FIRST_TIME_STARTUP.md](FIRST_TIME_STARTUP.md) for manual setup instructions.

---

## After First Setup

Once everything is set up, you can start the app normally:

**Development Mode:**
```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

**Production Mode:**
```bash
cd backend
npm run start:prod
```

---

## Troubleshooting

### "Start InvoiceMe.command" doesn't open Terminal
- Right-click the file → Open With → Terminal
- Or run: `chmod +x "Start InvoiceMe.command"` in Terminal first

### Script says Node.js is missing
- The script will try to install it via Homebrew
- If that fails, it will open the Node.js download page
- Install Node.js manually and run the script again

### Script says PostgreSQL is missing
- The script will offer to install it via Homebrew (Mac)
- Or you can use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14`
- Or install manually from https://www.postgresql.org/

---

**Need more help?** See [FIRST_TIME_STARTUP.md](FIRST_TIME_STARTUP.md) for detailed troubleshooting.

