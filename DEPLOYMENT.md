# Railway Deployment Guide

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

## Prerequisites

1. **Railway Account** (free tier available)
2. **API Keys**:
   - Gemini API Key (paid tier recommended)
   - Groq API Key

## Deployment Steps

### 1. Connect Repository
```bash
# Option A: Deploy from GitHub
1. Push your code to GitHub
2. Go to Railway.app
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository

# Option B: Deploy via CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

### 2. Set Environment Variables

In Railway dashboard → Variables tab, add:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
NODE_ENV=production
```

### 3. Configure Build

Railway will automatically detect `nixpacks.toml` and install:
- ✅ Chromium (for Puppeteer)
- ✅ FFmpeg (for video processing)
- ✅ Node.js dependencies

### 4. Deploy

Railway will automatically:
1. Install system dependencies (Chromium, FFmpeg)
2. Run `npm ci` to install Node packages
3. Run `npm run build` to build Next.js
4. Start the app with `npm start`

## Important Notes

### Memory Requirements
- **Minimum**: 2GB RAM
- **Recommended**: 4GB RAM (for processing 20 frames)
- Railway free tier: 512MB (may struggle with large videos)
- **Upgrade to Hobby plan** ($5/month) for 8GB RAM

### Disk Space
- Temporary files are stored in `/tmp`
- Railway provides ephemeral storage
- Files are cleaned up after processing

### Processing Time
- Expect 60-90 seconds per video
- Railway has 10-minute timeout (sufficient)

### Cost Estimate (Hobby Plan)
- Railway: $5/month (8GB RAM)
- Gemini API: ~$0.01 per video (20 frames)
- Groq API: Free tier sufficient
- **Total**: ~$5-10/month for moderate usage

## Troubleshooting

### Issue: "Chromium not found"
**Solution**: Verify `nixpacks.toml` exists in root directory

### Issue: "Out of memory"
**Solution**: Upgrade to Hobby plan or reduce `maxFrames` to 10

### Issue: "FFmpeg command not found"
**Solution**: Check `nixpacks.toml` includes `ffmpeg` in nixPkgs

### Issue: "Timeout after 10 minutes"
**Solution**: Process shorter videos (under 30 seconds)

## Monitoring

Railway provides:
- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Network usage
- **Deployments**: Version history and rollback

Access via: Railway Dashboard → Your Project → Deployments

## Scaling

For high traffic:
1. Upgrade to Pro plan ($20/month)
2. Add horizontal scaling (multiple instances)
3. Consider adding Redis for caching

## Alternative: Render

If Railway doesn't work, try Render.com:
```bash
# render.yaml
services:
  - type: web
    name: viral-replica
    env: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: GOOGLE_API_KEY
        sync: false
      - key: GROQ_API_KEY
        sync: false
```

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- This project uses: Next.js 16, Puppeteer, FFmpeg
