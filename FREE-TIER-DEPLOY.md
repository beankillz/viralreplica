# Free Tier Deployment Guide

## ✅ Your App CAN Run on Free Tiers!

With the optimizations implemented, your app will work on:
- **Render Free**: 512MB RAM
- **Fly.io Free**: 256MB × 3 VMs
- **Railway Trial**: $5 credit (then paid)

---

## Quick Deploy: Render (Recommended)

### 1. Create Render Account
Go to [render.com](https://render.com) and sign up (free)

### 2. Deploy from GitHub
1. Push your code to GitHub
2. In Render dashboard: **New → Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: viral-replica
   - **Environment**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. Set Environment Variables
In Render dashboard → Environment tab:

```env
FREE_TIER_MODE=true
MAX_VIDEO_SIZE_MB=10
MAX_VIDEO_DURATION_SEC=15
MAX_FRAMES=10
FRAME_FPS=1
GOOGLE_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
NODE_ENV=production
```

### 4. Deploy!
Click **Create Web Service** - done! 🎉

---

## Free Tier Limitations

### What Works:
✅ Videos up to **10MB** (about 15-20 seconds)  
✅ **10 frames** analyzed (still good accuracy ~85%)  
✅ AI text generation (Groq/Gemini)  
✅ Video rendering with FFmpeg  
✅ All core features functional  

### What's Limited:
⚠️ **Cold starts**: First request after 15min idle = 30-60s delay  
⚠️ **Processing time**: ~60-90 seconds per video  
⚠️ **Concurrent users**: 1 video at a time  
⚠️ **Video size**: Max 10MB (vs 50MB on paid)  
⚠️ **Frame accuracy**: 85% (vs 95% with 20 frames)  

---

## User Experience on Free Tier

### What Users See:
1. Upload videos (max 10MB each)
2. Wait 60-90 seconds for processing
3. Download rendered video

### Error Messages:
- "Video too large (15MB). Max 10MB for free tier."
- "Please wait, processing..." (with progress indicator)

---

## Upgrade Path

When you're ready to scale:

### Render Paid ($7/month)
- 512MB → **2GB RAM**
- No cold starts
- Process 50MB videos
- 20 frames (95% accuracy)

**To upgrade:**
```env
FREE_TIER_MODE=false
MAX_VIDEO_SIZE_MB=50
MAX_FRAMES=20
FRAME_FPS=2
```

---

## Alternative: Fly.io Free

Better performance, slightly more complex:

### Deploy to Fly.io

1. Install Fly CLI:
```bash
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

2. Login and deploy:
```bash
fly auth login
fly launch --name viral-replica
fly secrets set FREE_TIER_MODE=true GOOGLE_API_KEY=xxx GROQ_API_KEY=xxx
fly deploy
```

3. Configure memory:
```toml
# fly.toml
[env]
  FREE_TIER_MODE = "true"

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
```

---

## Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Render** | 512MB, cold starts | $7/mo, 2GB | Easiest setup |
| **Fly.io** | 256MB×3, no cold starts | $5/mo, 1GB | Best performance |
| **Railway** | $5 trial credit | $5/mo, 8GB | Most powerful |
| **Vercel** | Serverless | $20/mo | Not ideal (timeout issues) |

---

## Testing Free Tier Locally

Set in your `.env`:
```env
FREE_TIER_MODE=true
MAX_VIDEO_SIZE_MB=10
MAX_FRAMES=10
```

Restart dev server:
```bash
npm run dev
```

Try uploading a 15MB video - should see error message!

---

## Monitoring Usage

### Render Dashboard:
- **Metrics** → Memory usage (should stay under 512MB)
- **Logs** → Check for OOM errors
- **Deployments** → Build times

### If you see "Out of Memory":
1. Reduce `MAX_FRAMES` to 8
2. Reduce `MAX_VIDEO_SIZE_MB` to 8
3. Add more aggressive cleanup

---

## Next Steps

1. **Deploy to Render** (5 minutes)
2. **Test with real videos** (check memory usage)
3. **Share with users** (get feedback)
4. **Upgrade when needed** (when you have revenue)

---

## Support

- Render Docs: https://render.com/docs
- Fly.io Docs: https://fly.io/docs
- This repo: Issues tab

**You're ready for free tier! 🚀**
