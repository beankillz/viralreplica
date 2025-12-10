'use client';

import { useState, useRef, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';

type Step = 'idle' | 'cloning' | 'complete' | 'error';

interface ProcessingState {
  step: Step;
  progress: number;
  message: string;
  stage: number;
}

interface ScriptVariation {
  name: string;
  segments: { role: string; text: string; }[];
}

const PROCESSING_STAGES = [
  { name: 'Uploading videos...', duration: 5 },
  { name: 'Extracting 20 frames...', duration: 10 },
  { name: 'Analyzing with AI (Gemini)...', duration: 40 },
  { name: 'Generating variations (Groq)...', duration: 8 },
  { name: 'Rendering final video...', duration: 15 },
];

const ERROR_MESSAGES: Record<string, string> = {
  'Could not generate variations': '⏳ AI service is overloaded. Try again in 1 minute.',
  'Failed to analyze': '🎬 Video analysis failed. Try a different video.',
  'ENOENT': '📁 File not found. Please re-upload your video.',
  'timeout': '⏱️ Processing took too long. Try a shorter video (under 30s).',
  'Rate Limit': '🚦 API rate limit hit. Wait 30 seconds and try again.',
};

function getUserFriendlyError(error: string): string {
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (error.includes(key)) return message;
  }
  return '❌ Something went wrong. Please try again or contact support.';
}

export default function Home() {
  const [competitorVideo, setCompetitorVideo] = useState<File | null>(null);
  const [userVideo, setUserVideo] = useState<File | null>(null);
  const [topic, setTopic] = useState<string>('');

  const [competitorPreview, setCompetitorPreview] = useState<string | null>(null);
  const [userPreview, setUserPreview] = useState<string | null>(null);
  const [competitorDuration, setCompetitorDuration] = useState<number | null>(null);
  const [userDuration, setUserDuration] = useState<number | null>(null);

  const [processing, setProcessing] = useState<ProcessingState>({
    step: 'idle',
    progress: 0,
    message: '',
    stage: 0
  });

  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [variations, setVariations] = useState<ScriptVariation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const competitorInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

  // Load font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Keyboard shortcut: Ctrl+Enter to generate
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter' && competitorVideo && userVideo) {
        handleProcess();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [competitorVideo, userVideo, topic]);

  const validateVideo = (file: File): string | null => {
    if (file.size > 100 * 1024 * 1024) {
      return 'Video must be under 100MB';
    }
    if (!file.type.includes('video')) {
      return 'Please upload a video file (MP4, MOV, etc.)';
    }
    return null;
  };

  const handleCompetitorChange = (file: File | null) => {
    if (!file) return;

    const validationError = validateVideo(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setCompetitorVideo(file);
    const url = URL.createObjectURL(file);
    setCompetitorPreview(url);

    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setCompetitorDuration(video.duration);
    };
  };

  const handleUserChange = (file: File | null) => {
    if (!file) return;

    const validationError = validateVideo(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUserVideo(file);
    const url = URL.createObjectURL(file);
    setUserPreview(url);

    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setUserDuration(video.duration);
    };
  };

  const handleProcess = async () => {
    if (!competitorVideo || !userVideo) {
      toast.error('Please upload both videos to begin.');
      return;
    }

    setError(null);
    setOutputVideoUrl(null);
    setVariations([]);

    setProcessing({ step: 'cloning', progress: 0, message: PROCESSING_STAGES[0].name, stage: 0 });

    try {
      const formData = new FormData();
      formData.append('competitorVideo', competitorVideo);
      formData.append('userVideo', userVideo);
      formData.append('topic', topic || 'viral content');

      // Simulate stage progression
      let currentStage = 0;
      let currentProgress = 0;

      const progressInterval = setInterval(() => {
        setProcessing(prev => {
          if (prev.step !== 'cloning') return prev;

          const stage = PROCESSING_STAGES[currentStage];
          const stageProgress = Math.min(currentProgress + 1, stage.duration);

          if (stageProgress >= stage.duration && currentStage < PROCESSING_STAGES.length - 1) {
            currentStage++;
            currentProgress = 0;
          } else {
            currentProgress = stageProgress;
          }

          const totalDuration = PROCESSING_STAGES.reduce((sum, s) => sum + s.duration, 0);
          const completedDuration = PROCESSING_STAGES.slice(0, currentStage).reduce((sum, s) => sum + s.duration, 0);
          const overallProgress = Math.min(((completedDuration + currentProgress) / totalDuration) * 100, 95);

          return {
            ...prev,
            progress: overallProgress,
            message: PROCESSING_STAGES[currentStage].name,
            stage: currentStage
          };
        });
      }, 1000);

      const res = await fetch('/api/clone', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: res.statusText }));
        throw errJson;
      }

      // Check for Variations Header
      const variationsHeader = res.headers.get('X-Variations');
      if (variationsHeader) {
        try {
          setVariations(JSON.parse(variationsHeader));
        } catch (e) {
          console.warn('Failed to parse variations header');
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setOutputVideoUrl(url);
      setProcessing({ step: 'complete', progress: 100, message: 'Clone Ready!', stage: PROCESSING_STAGES.length });

      // Success feedback
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success('🎉 Clone ready! Your viral replica is complete.', { duration: 4000 });

    } catch (err: any) {
      console.error('Processing error:', err);
      const friendlyError = getUserFriendlyError(err.error || JSON.stringify(err));
      setError(friendlyError);
      toast.error(friendlyError, { duration: 5000 });
      setProcessing({ step: 'error', progress: 0, message: 'Process Failed', stage: 0 });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-['Inter']">
      <Toaster position="top-right" />

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <main className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 max-w-5xl">

        {/* Header */}
        <div className="text-center mb-16 sm:mb-24 animate-fade-in">
          <h1 className="text-5xl sm:text-7xl font-black mb-4 sm:mb-6 tracking-tight">
            VIRAL <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent text-glow">REPLICA</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 font-light max-w-2xl mx-auto leading-relaxed">
            The world's most advanced AI cloner. <br className="hidden sm:block" />
            Steal the <span className="text-white font-medium">pattern</span>. Keep the <span className="text-white font-medium">vibe</span>.
          </p>
          <p className="text-xs text-zinc-600 mt-4">💡 Tip: Press <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Ctrl+Enter</kbd> to generate</p>
        </div>

        {/* Inputs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>

          {/* Competitor Upload */}
          <div
            onClick={() => competitorInputRef.current?.click()}
            className={`glass glass-hover p-1 rounded-3xl cursor-pointer group relative overflow-hidden transition-all duration-500
              ${competitorVideo ? 'border-purple-500/50 shadow-purple-500/20' : 'border-white/5'}
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="bg-black/40 rounded-[20px] h-64 flex flex-col items-center justify-center p-6 sm:p-8 text-center relative z-10">
              <input
                ref={competitorInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleCompetitorChange(e.target.files?.[0] || null)}
              />
              {competitorPreview ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <video src={competitorPreview} className="max-h-32 rounded-lg mb-2" />
                  <p className="text-sm text-zinc-400">{competitorVideo?.name}</p>
                  {competitorDuration && <p className="text-xs text-zinc-600">{competitorDuration.toFixed(1)}s</p>}
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-purple-500 transition-all duration-300 shadow-lg">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Target Video</h3>
                  <p className="text-xs sm:text-sm text-zinc-500">Upload the viral video to replicate</p>
                </>
              )}
            </div>
          </div>

          {/* User Upload */}
          <div
            onClick={() => userInputRef.current?.click()}
            className={`glass glass-hover p-1 rounded-3xl cursor-pointer group relative overflow-hidden transition-all duration-500
              ${userVideo ? 'border-emerald-500/50 shadow-emerald-500/20' : 'border-white/5'}
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="bg-black/40 rounded-[20px] h-64 flex flex-col items-center justify-center p-6 sm:p-8 text-center relative z-10">
              <input
                ref={userInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleUserChange(e.target.files?.[0] || null)}
              />
              {userPreview ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <video src={userPreview} className="max-h-32 rounded-lg mb-2" />
                  <p className="text-sm text-zinc-400">{userVideo?.name}</p>
                  {userDuration && <p className="text-xs text-zinc-600">{userDuration.toFixed(1)}s</p>}
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-300 shadow-lg">
                    <span className="text-2xl">🎥</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Your Content</h3>
                  <p className="text-xs sm:text-sm text-zinc-500">Upload your background footage</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Topic & Action */}
        <div className="glass p-6 sm:p-8 rounded-3xl animate-slide-up mb-20 relative max-w-3xl mx-auto" style={{ animationDelay: '0.4s' }}>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-2">Topic / Niche</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Crypto, Health, Tech..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg focus:outline-none focus:border-purple-500/50 focus:bg-black/70 transition-all placeholder:text-zinc-700"
              />
            </div>
            <button
              onClick={handleProcess}
              disabled={!competitorVideo || !userVideo || processing.step === 'cloning'}
              className="w-full md:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-white text-black rounded-xl font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] mt-6 md:mt-0"
            >
              {processing.step === 'cloning' ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>PROCESSING</span>
                </div>
              ) : 'GENERATE'}
            </button>
          </div>

          {/* Detailed Progress Bar */}
          {processing.step === 'cloning' && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-zinc-400 font-mono">{processing.message}</p>
                <p className="text-xs text-zinc-600">{Math.round(processing.progress)}%</p>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${processing.progress}%` }}
                ></div>
              </div>
              <div className="flex gap-2 mt-4">
                {PROCESSING_STAGES.map((stage, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-1 rounded-full transition-all ${idx < processing.stage ? 'bg-purple-500' :
                        idx === processing.stage ? 'bg-purple-500/50' :
                          'bg-zinc-800'
                      }`}
                  ></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-3xl mx-auto mb-12 animate-fade-in glass border-red-500/30 bg-red-500/5 p-6 rounded-2xl text-center">
            <p className="text-red-400 font-medium text-base sm:text-lg">{error}</p>
          </div>
        )}

        {/* Results */}
        {processing.step === 'complete' && outputVideoUrl && (
          <div className="animate-slide-up space-y-12">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-8">Ready to <span className="text-purple-400">Viral</span></h2>

            <div className="glass p-2 rounded-[32px] max-w-5xl mx-auto relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-[32px] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative rounded-[30px] overflow-hidden bg-black aspect-video shadow-2xl">
                <video src={outputVideoUrl} controls autoPlay muted className="w-full h-full object-contain" />
              </div>
            </div>

            <div className="flex justify-center">
              <a
                href={outputVideoUrl}
                download="viral-replica.mp4"
                className="px-8 sm:px-12 py-3 sm:py-4 bg-white text-black rounded-full font-bold text-base sm:text-lg hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all flex items-center gap-3"
              >
                <span>⬇️</span> Download Replica
              </a>
            </div>

            {/* Variations */}
            {variations.length > 0 && (
              <div className="mt-24">
                <h3 className="text-xl sm:text-2xl font-bold text-center mb-10 text-zinc-500">Generated Variations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {variations.map((v, i) => (
                    <div key={i} className="glass p-6 sm:p-8 rounded-3xl hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">{i + 1}</div>
                        <h4 className="font-bold text-purple-300 text-sm sm:text-base">{v.name}</h4>
                      </div>
                      <div className="space-y-4">
                        {v.segments.map((seg, j) => (
                          <div key={j} className="text-xs sm:text-sm text-zinc-400 leading-relaxed border-l-2 border-white/5 pl-4">
                            {seg.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="mt-32 text-center text-zinc-700 text-xs sm:text-sm">
          Viral Replica AI • {new Date().getFullYear()}
        </footer>

      </main>
    </div>
  );
}
