# 🌐 Test Social Sharing with ngrok

## Problem
Facebook/WhatsApp can't access `localhost:5173` because it's on your local machine.

## Solution: Use ngrok
ngrok creates a public URL that tunnels to your localhost.

---

## 📥 Step 1: Install ngrok

### Windows:
1. Download from: https://ngrok.com/download
2. Extract `ngrok.exe` to a folder
3. Or install via chocolatey:
   ```powershell
   choco install ngrok
   ```

### Or use npm:
```bash
npm install -g ngrok
```

---

## 🚀 Step 2: Run ngrok

Open a **new terminal** (keep `npm run dev` running in the other one):

```bash
ngrok http 5173
```

You'll see output like:
```
ngrok                                                                    

Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:5173

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

---

## 🎯 Step 3: Use the ngrok URL

Copy the **Forwarding URL** (e.g., `https://abc123.ngrok.io`)

Now you can:
1. Open invitation: `https://abc123.ngrok.io/invitation/xyz`
2. Share this URL on Facebook
3. Facebook will show the preview! ✅

---

## 🧪 Step 4: Test on Facebook

1. Go to: https://developers.facebook.com/tools/debug/
2. Paste your ngrok URL: `https://abc123.ngrok.io/invitation/xyz`
3. Click "Scrape Again"
4. See the preview! 🎉

---

## ⚠️ Important Notes

### Free ngrok limitations:
- ✅ URL changes every time you restart ngrok
- ✅ Session expires after 2 hours
- ✅ Limited requests per minute
- ✅ Perfect for testing!

### For production:
- Deploy to Vercel/Netlify (permanent URL)
- Then social sharing will work permanently

---

## 🎬 Quick Start

```bash
# Terminal 1: Run your app
npm run dev

# Terminal 2: Run ngrok
ngrok http 5173
```

Then use the ngrok URL for testing!

---

## 🔗 Alternative: Deploy to Vercel

For permanent solution:
```bash
npm run build
vercel --prod
```

Then use your Vercel URL for sharing!
