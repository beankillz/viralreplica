'use client';

import { useState, useRef, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useEditorStore } from '../lib/stores/editorStore';
import { EditorPanel } from '../components/editor/EditorPanel';
import { ScriptVariation } from '../types/video-processing';

type Step = 'idle' | 'cloning' | 'complete' | 'error';

interface ProcessingState {
  step: Step;
  progress: number;
  message: string;
  stage: number;
}

// Free tier: 10 frames, Paid tier: 20 frames
const MAX_VIDEO_SIZE_MB = parseInt(process.env.NEXT_PUBLIC_MAX_VIDEO_SIZE_MB || '10');
const FRAME_COUNT = parseInt(process.env.NEXT_PUBLIC_MAX_FRAMES || '10');

const PROCESSING_STAGES = [
  { name: 'Uploading videos...', duration: 5 },
  { name: `Extracting ${FRAME_COUNT} frames...`, duration: 10 },
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

  const { project, setProject, isEditing, exitEditor } = useEditorStore();
  // Access output URL safely from project state
  const editorOutputUrl = project?.outputVideoUrl;
  const activeVideoUrl = editorOutputUrl || outputVideoUrl;

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
    const maxSizeBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `Video must be under ${MAX_VIDEO_SIZE_MB}MB`;
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

      // Check for Variations and Schema Headers
      const variationsHeader = res.headers.get('X-Variations');
      const schemaHeader = res.headers.get('X-Schema');

      let parsedVariations: ScriptVariation[] = [];
      let parsedSchema: any = null;

      if (variationsHeader) {
        try {
          parsedVariations = JSON.parse(variationsHeader);
          setVariations(parsedVariations);
        } catch (e) {
          console.warn('Failed to parse variations header');
        }
      }

      if (schemaHeader) {
        try {
          parsedSchema = JSON.parse(schemaHeader);
        } catch (e) {
          console.warn('Failed to parse schema header');
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setOutputVideoUrl(url);
      setProcessing({ step: 'complete', progress: 100, message: 'Clone Ready!', stage: PROCESSING_STAGES.length });

      // Initialize Editor Store
      if (parsedSchema && parsedVariations.length > 0 && userVideo) {
        setProject({
          id: Date.now().toString(),
          createdAt: Date.now(),
          competitorVideoName: competitorVideo.name,
          userVideoName: userVideo.name,
          userVideoUrl: URL.createObjectURL(userVideo),
          userVideoFile: userVideo, // Pass file for re-rendering
          topic: topic,
          visionResults: [], // Not needed for editor
          variations: parsedVariations,
          selectedVariationIndex: 0,
          designSchema: parsedSchema,
        });
      }

      // Success feedback
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#A855F7', '#EC4899', '#ffffff']
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
    <div className="min-h-screen relative overflow-hidden font-['Inter'] noise-bg">
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }} />

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <main className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 max-w-5xl relative z-10 w-full xl:max-w-7xl">

        {/* Header */}
        <div className="text-center mb-16 sm:mb-24 animate-fade-in user-select-none">
          <h1 className="text-6xl sm:text-8xl font-black mb-6 tracking-tighter hover:scale-[1.02] transition-transform duration-500 cursor-default text-white">
            VIRAL <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent text-glow bg-[length:200%_auto] animate-liquid-bar">REPLICA</span>
          </h1>
          <p className="text-lg sm:text-2xl text-zinc-400 font-light max-w-2xl mx-auto leading-relaxed opacity-90">
            Steal the <span className="text-white font-medium border-b border-purple-500/50">pattern</span>. Keep the <span className="text-white font-medium border-b border-pink-500/50">vibe</span>.
          </p>
        </div>

        {/* Inputs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 animate-slide-up" style={{ animationDelay: '0.2s' }}>

          {/* Competitor Upload */}
          <div
            onClick={() => competitorInputRef.current?.click()}
            className={`glass glass-hover p-2 rounded-[2rem] cursor-pointer group relative overflow-hidden h-80
              ${competitorVideo ? 'border-purple-500/50 shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)]' : ''}
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
            <div className="bg-white/5 rounded-[1.5rem] h-full flex flex-col items-center justify-center p-8 text-center relative z-10 backdrop-blur-sm transition-all duration-500 group-hover:bg-white/10">
              <input
                ref={competitorInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleCompetitorChange(e.target.files?.[0] || null)}
              />
              {competitorPreview ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 animate-fade-in">
                  <div className="relative w-full flex-1 rounded-xl overflow-hidden shadow-2xl border border-white/10 group-hover:scale-[1.02] transition-transform duration-500">
                    <video src={competitorPreview} className="w-full h-full object-cover" muted loop autoPlay onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-white">{competitorVideo?.name}</p>
                    {competitorDuration && <p className="text-xs text-zinc-500 font-mono">{competitorDuration.toFixed(1)}s</p>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-zinc-800/50 border border-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-purple-500 group-hover:border-purple-400 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-500">
                    <span className="text-3xl filter drop-shadow-lg">🎯</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">Target Video</h3>
                  <p className="text-sm text-zinc-500 max-w-[200px] leading-relaxed group-hover:text-zinc-400">Upload the viral video you want to replicate</p>
                </>
              )}
            </div>
          </div>

          {/* User Upload */}
          <div
            onClick={() => userInputRef.current?.click()}
            className={`glass glass-hover p-2 rounded-[2rem] cursor-pointer group relative overflow-hidden h-80
              ${userVideo ? 'border-emerald-500/50 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]' : ''}
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
            <div className="bg-white/5 rounded-[1.5rem] h-full flex flex-col items-center justify-center p-8 text-center relative z-10 backdrop-blur-sm transition-all duration-500 group-hover:bg-white/10">
              <input
                ref={userInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleUserChange(e.target.files?.[0] || null)}
              />
              {userPreview ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 animate-fade-in">
                  <div className="relative w-full flex-1 rounded-xl overflow-hidden shadow-2xl border border-white/10 group-hover:scale-[1.02] transition-transform duration-500">
                    <video src={userPreview} className="w-full h-full object-cover" muted loop autoPlay onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-white">{userVideo?.name}</p>
                    {userDuration && <p className="text-xs text-zinc-500 font-mono">{userDuration.toFixed(1)}s</p>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-zinc-800/50 border border-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:border-emerald-400 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-500">
                    <span className="text-3xl filter drop-shadow-lg">🎥</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">Your Content</h3>
                  <p className="text-sm text-zinc-500 max-w-[200px] leading-relaxed group-hover:text-zinc-400">Upload your raw background footage</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Topic & Action */}
        <div className="glass p-8 rounded-[2rem] animate-slide-up mb-24 relative max-w-4xl mx-auto backdrop-blur-3xl" style={{ animationDelay: '0.4s' }}>
          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            <div className="flex-1 w-full space-y-3">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Topic / Niche</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Crypto, Health, Tech..."
                className="glass-input w-full rounded-2xl px-6 py-5 text-xl font-medium"
              />
            </div>
            <button
              onClick={handleProcess}
              disabled={!competitorVideo || !userVideo || processing.step === 'cloning'}
              className="w-full md:w-auto px-12 py-5 bg-white text-black rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.4)] mt-6 md:mt-0 flex items-center justify-center"
            >
              {processing.step === 'cloning' ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span className="tracking-wide">PROCESSING</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>✨</span>
                  <span className="tracking-wide">GENERATE</span>
                </div>
              )}
            </button>
          </div>

          {/* Detailed Progress Bar */}
          {processing.step === 'cloning' && (
            <div className="mt-10 animate-fade-in px-2">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-zinc-300 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                  {processing.message}
                </p>
                <p className="text-sm font-bold text-white tabular-nums">{Math.round(processing.progress)}%</p>
              </div>
              <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-liquid-bar rounded-full shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                  style={{ width: `${processing.progress}%` }}
                ></div>
              </div>
              <div className="flex gap-2 mt-4 opacity-50">
                {PROCESSING_STAGES.map((stage, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-1 rounded-full transition-all duration-500 ${idx < processing.stage ? 'bg-white' :
                      idx === processing.stage ? 'bg-white/50' :
                        'bg-white/10'
                      }`}
                  ></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-3xl mx-auto mb-12 animate-fade-in glass border-red-500/30 bg-red-500/10 p-6 rounded-3xl text-center backdrop-blur-md">
            <span className="text-3xl block mb-2">⚠️</span>
            <p className="text-red-300 font-medium text-lg">{error}</p>
          </div>
        )}

        {/* Results */}
        {processing.step === 'complete' && activeVideoUrl && (
          <div className="animate-slide-up space-y-16">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div className={`flex flex-col lg:flex-row gap-8 ${isEditing ? 'h-[85vh]' : ''}`}>

              {/* Editor Panel - Only show when editing */}
              {isEditing && (
                <div className="w-full lg:w-[450px] animate-fade-in flex-shrink-0">
                  <EditorPanel />
                </div>
              )}

              {/* Video Player */}
              <div className={`glass p-3 rounded-[2.5rem] mx-auto relative group transition-all duration-700
                    ${isEditing ? 'flex-1 bg-white/5 border-white/5' : 'max-w-6xl'}
                `}>
                {!isEditing && <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>}
                <div className={`relative rounded-[2rem] overflow-hidden bg-black shadow-2xl w-full flex items-center justify-center
                     ${isEditing ? 'h-full bg-[url("/grid-pattern.svg")]' : 'aspect-video'}
                  `}>
                  <video
                    key={activeVideoUrl} // Force reload on url change
                    src={activeVideoUrl}
                    controls
                    autoPlay
                    loop
                    className={`${isEditing ? 'max-h-full max-w-full' : 'w-full h-full'} object-contain drop-shadow-2xl`}
                  />
                </div>
              </div>
            </div>

            {!isEditing && (
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <a
                  href={activeVideoUrl}
                  download="viral-replica.mp4"
                  className="px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 hover:bg-zinc-100 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] transform active:scale-95"
                >
                  <span>⬇️</span> Download Replica
                </a>
                {/* Edit Button */}
                {project && (
                  <button
                    onClick={() => setProject({ ...project })}
                    className="px-10 py-4 glass bg-white/5 text-white border-white/20 rounded-full font-bold text-lg hover:scale-105 hover:bg-white/10 hover:border-white/40 transition-all flex items-center justify-center gap-3 backdrop-blur-md transform active:scale-95"
                  >
                    <span>🎨</span> Customize Design
                  </button>
                )}
              </div>
            )}

            {/* Variations */}
            {variations.length > 0 && (
              <div className="mt-32">
                <div className="flex items-center justify-center gap-4 mb-16 opacity-80">
                  <div className="h-px w-24 bg-gradient-to-r from-transparent to-white/20"></div>
                  <h3 className="text-2xl font-bold text-zinc-400">AI Generated Variations</h3>
                  <div className="h-px w-24 bg-gradient-to-l from-transparent to-white/20"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {variations.map((v, i) => (
                    <div key={i} className="glass group p-8 rounded-[2rem] hover:bg-white/5 transition-all duration-500 hover:-translate-y-2 border border-white/5 hover:border-purple-500/30">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white group-hover:bg-purple-500 group-hover:border-purple-400 transition-colors shadow-lg">
                          {i + 1}
                        </div>
                        <h4 className="font-bold text-zinc-200 text-lg group-hover:text-purple-300 transition-colors">{v.name}</h4>
                      </div>
                      <div className="space-y-6">
                        {v.segments.map((seg, j) => (
                          <div key={j} className="relative pl-6">
                            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-white/10 group-hover:bg-purple-500/30 transition-colors"></div>
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">{seg.role}</span>
                            <p className="text-sm text-zinc-300 leading-relaxed font-light">
                              {seg.text}
                            </p>
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

        <footer className="mt-40 text-center text-zinc-700 text-sm font-medium opacity-50 hover:opacity-100 transition-opacity">
          VIRAL REPLICA AI • {new Date().getFullYear()}
        </footer>

      </main>
    </div>
  );
}
