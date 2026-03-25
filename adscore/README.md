# AdScore — Creative Analyzer

AI-powered Meta Ads creative scoring tool. Built with Next.js + Anthropic API.

## Deploy to Vercel (5 minutes)

### Step 1 — Push to GitHub
1. Go to [github.com](https://github.com) → New repository → name it `adscore`
2. Upload all these files (drag & drop the folder)

### Step 2 — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. In **Environment Variables**, add:
   ```
   ANTHROPIC_API_KEY = your_key_here
   ```
4. Click **Deploy**

Done! Your tool is live in ~2 minutes.

---

## Run locally

```bash
npm install
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How it works

1. User uploads a creative image
2. Browser compresses the image and sends it to `/api/analyze` (Next.js Edge Function)
3. Server streams the Anthropic response back to the browser in real-time
4. Criteria appear one by one as they stream in
5. User selects which criteria to improve → 5 canvas variations generated instantly (no API call)
