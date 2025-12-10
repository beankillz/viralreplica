# Viral Replica - AI Video Cloner

Clone viral video patterns with 95%+ accuracy using AI.

## Features

- 🎯 **20-Frame Analysis** - Precise timing extraction
- 🔤 **100+ Font Detection** - Accurate font matching
- 🎬 **Motion Tracking** - CSS-based animations
- 🎨 **Style Replication** - Colors, positioning, effects
- 🤖 **AI Variations** - Groq-powered script generation
- ✨ **Polished UI** - Modern, responsive interface

## Quick Start

### Prerequisites

- Node.js 18+
- Gemini API Key (paid tier)
- Groq API Key

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

```env
GOOGLE_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

## Deployment

### Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

**Requirements**:
- 2GB+ RAM (Hobby plan recommended)
- Chromium and FFmpeg (auto-installed via `nixpacks.toml`)

### Alternative Platforms

- **Render**: Supports Docker, requires custom Dockerfile
- **Vercel**: Not recommended (serverless limits)
- **Heroku**: Requires buildpacks for Chromium/FFmpeg

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Gemini 2.0 Flash (vision), Groq (variations)
- **Video**: FFmpeg, Puppeteer, Sharp
- **UI**: Tailwind CSS 4, React Hot Toast, Canvas Confetti

## Architecture

```
User Upload → Eye (Vision) → Brain (Variations) → Painter (Render) → Download
```

1. **Eye**: Extracts 20 frames, analyzes with Gemini
2. **Brain**: Generates 3 variations with Groq
3. **Painter**: Renders overlays with Puppeteer + FFmpeg

## Performance

- **Processing Time**: 60-90 seconds per video
- **Accuracy**: 95%+ clone fidelity
- **Frame Rate**: 2 FPS (0.5s resolution)
- **Max Video Length**: 30 seconds recommended

## Limitations

- **File Size**: 100MB max
- **Video Format**: MP4 recommended
- **API Costs**: ~$0.01 per video (Gemini)
- **Memory**: 2GB+ required for processing

## Contributing

This is an internal tool. For issues or feature requests, contact the development team.

## License

Proprietary - Internal Use Only

---

Built with ❤️ using AI
