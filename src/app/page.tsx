'use client';

import { useState, useRef } from 'react';

type Step = 'idle' | 'uploading' | 'extracting' | 'ocr' | 'styling' | 'rendering' | 'complete' | 'error';

interface ProcessingState {
  step: Step;
  progress: number;
  message: string;
}

interface OCRDetection {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence?: number;
}

interface StyleResult {
  fontSize: string;
  color: string;
  fontFamily: string;
  background: string;
  padding: string;
  alignment: string;
  fontWeight: string;
  textTransform: string;
  position: { x: number; y: number };
}

const STEPS = [
  { id: 'uploading', label: 'Upload Videos', icon: '📤' },
  { id: 'extracting', label: 'Extract Frames', icon: '🎞️' },
  { id: 'ocr', label: 'Detect Text', icon: '👁️' },
  { id: 'styling', label: 'Analyze Style', icon: '🎨' },
  { id: 'rendering', label: 'Render Video', icon: '🎬' },
  { id: 'complete', label: 'Complete', icon: '✅' },
];

export default function Home() {
  const [competitorVideo, setCompetitorVideo] = useState<File | null>(null);
  const [userVideo, setUserVideo] = useState<File | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    step: 'idle',
    progress: 0,
    message: '',
  });
  const [extractedText, setExtractedText] = useState<OCRDetection[]>([]);
  const [detectedStyle, setDetectedStyle] = useState<StyleResult | null>(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const competitorInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

  const updateProgress = (step: Step, progress: number, message: string) => {
    setProcessing({ step, progress, message });
  };

  const handleProcess = async () => {
    if (!competitorVideo || !userVideo) {
      setError('Please upload both videos');
      return;
    }

    setError(null);
    setOutputVideoUrl(null);

    try {
      // Step 1: Upload competitor video
      updateProgress('uploading', 10, 'Uploading competitor video...');
      const uploadFormData = new FormData();
      uploadFormData.append('file', competitorVideo);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) throw new Error('Failed to upload competitor video');
      updateProgress('uploading', 30, 'Competitor video uploaded');

      // Step 2: Extract frames
      updateProgress('extracting', 40, 'Extracting frames at 1 FPS...');
      const extractFormData = new FormData();
      extractFormData.append('file', competitorVideo);

      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        body: extractFormData,
      });

      if (!extractRes.ok) throw new Error('Failed to extract frames');
      const extractData = await extractRes.json();
      updateProgress('extracting', 50, `Extracted ${extractData.frameCount} frames`);

      // Step 3: OCR - detect text in frames
      updateProgress('ocr', 55, 'Detecting text in frames...');
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames: extractData.frames }),
      });

      if (!ocrRes.ok) throw new Error('Failed to detect text');
      const ocrData = await ocrRes.json();

      const allDetections = ocrData.results.flatMap((r: { detections: OCRDetection[] }) => r.detections);
      setExtractedText(allDetections);
      updateProgress('ocr', 65, `Found ${allDetections.length} text elements`);

      // Step 4: Analyze style
      updateProgress('styling', 70, 'Analyzing text styles...');
      const framesWithDetections = extractData.frames.map((frame: { base64: string; timestamp: number }, i: number) => ({
        ...frame,
        detections: ocrData.results[i]?.detections || [],
      }));

      const styleRes = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames: framesWithDetections }),
      });

      if (!styleRes.ok) throw new Error('Failed to analyze style');
      const styleData = await styleRes.json();
      setDetectedStyle(styleData.dominantStyle);
      updateProgress('styling', 80, 'Style analysis complete');

      // Step 5: Render video with text overlays
      updateProgress('rendering', 85, 'Rendering video with overlays...');

      // Build overlays from OCR detections
      const overlays = ocrData.results.flatMap((frameResult: { frameIndex: number; timestamp?: number; detections: OCRDetection[] }) =>
        frameResult.detections.map((det: OCRDetection) => ({
          text: det.text,
          startTime: frameResult.timestamp || frameResult.frameIndex * 1000,
          endTime: (frameResult.timestamp || frameResult.frameIndex * 1000) + 2000, // Show for 2 seconds
          style: {
            fontSize: styleData.dominantStyle?.fontSize || '24px',
            color: styleData.dominantStyle?.color || '#FFFFFF',
            background: styleData.dominantStyle?.background || 'rgba(0,0,0,0.7)',
            position: det.boundingBox,
            alignment: styleData.dominantStyle?.alignment || 'center',
            fontWeight: styleData.dominantStyle?.fontWeight || 'bold',
          },
        }))
      );

      // Create FormData for minimal memory usage on client side
      const renderFormData = new FormData();
      renderFormData.append('video', userVideo);
      renderFormData.append('overlays', JSON.stringify(overlays));

      const renderRes = await fetch('/api/render', {
        method: 'POST',
        body: renderFormData,
      });

      if (!renderRes.ok) {
        // Fallback to showing user video if render fails
        console.warn('Render failed, showing original user video');
        const userVideoUrl = URL.createObjectURL(userVideo);
        setOutputVideoUrl(userVideoUrl);
      } else {
        const renderBlob = await renderRes.blob();
        const renderUrl = URL.createObjectURL(renderBlob);
        setOutputVideoUrl(renderUrl);
      }

      updateProgress('complete', 100, 'Processing complete!');

    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
      setProcessing({ step: 'error', progress: 0, message: 'Error occurred' });
    }
  };

  const getStepStatus = (stepId: string): 'pending' | 'active' | 'complete' | 'error' => {
    const stepOrder = STEPS.map(s => s.id);
    const currentIndex = stepOrder.indexOf(processing.step);
    const stepIndex = stepOrder.indexOf(stepId);

    if (processing.step === 'error') return 'error';
    if (processing.step === 'idle') return 'pending';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white">
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
            Viral Replica
          </h1>
          <p className="text-xl text-zinc-400">
            Clone viral video patterns with AI
          </p>
        </div>

        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Competitor Video */}
          <div
            onClick={() => competitorInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${competitorVideo
              ? 'border-green-500 bg-green-500/10'
              : 'border-zinc-700 hover:border-purple-500'
              }`}
          >
            <input
              ref={competitorInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setCompetitorVideo(e.target.files?.[0] || null)}
            />
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold mb-1">Competitor Video</h3>
            <p className="text-sm text-zinc-500">
              {competitorVideo ? competitorVideo.name : 'Upload the viral video to analyze'}
            </p>
          </div>

          {/* User Video */}
          <div
            onClick={() => userInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${userVideo
              ? 'border-green-500 bg-green-500/10'
              : 'border-zinc-700 hover:border-purple-500'
              }`}
          >
            <input
              ref={userInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setUserVideo(e.target.files?.[0] || null)}
            />
            <div className="text-4xl mb-3">🎬</div>
            <h3 className="font-semibold mb-1">Your Video</h3>
            <p className="text-sm text-zinc-500">
              {userVideo ? userVideo.name : 'Upload your video to apply the style'}
            </p>
          </div>
        </div>

        {/* Process Button */}
        <div className="text-center mb-12">
          <button
            onClick={handleProcess}
            disabled={!competitorVideo || !userVideo || (processing.step !== 'idle' && processing.step !== 'complete' && processing.step !== 'error')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {processing.step === 'idle' || processing.step === 'complete' || processing.step === 'error'
              ? '🚀 Start Processing'
              : '⏳ Processing...'}
          </button>
        </div>

        {/* Progress Steps */}
        {processing.step !== 'idle' && (
          <div className="bg-zinc-800/50 rounded-2xl p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              {STEPS.map((step, i) => {
                const status = getStepStatus(step.id);
                return (
                  <div key={step.id} className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2 transition-all ${status === 'complete' ? 'bg-green-500' :
                      status === 'active' ? 'bg-purple-500 animate-pulse' :
                        status === 'error' ? 'bg-red-500' :
                          'bg-zinc-700'
                      }`}>
                      {status === 'complete' ? '✓' : step.icon}
                    </div>
                    <span className={`text-xs text-center ${status === 'active' ? 'text-purple-400' :
                      status === 'complete' ? 'text-green-400' :
                        'text-zinc-500'
                      }`}>
                      {step.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className="hidden md:block absolute w-full h-0.5 bg-zinc-700 top-5 left-1/2 -z-10" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${processing.progress}%` }}
              />
            </div>
            <p className="text-sm text-zinc-400 mt-2 text-center">{processing.message}</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {processing.step === 'complete' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Detected Text */}
            <div className="bg-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span>👁️</span> Detected Text
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {extractedText.length > 0 ? (
                  extractedText.map((det, i) => (
                    <div key={i} className="bg-zinc-700/50 rounded-lg p-3">
                      <p className="font-mono text-sm">{det.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500">No text detected</p>
                )}
              </div>
            </div>

            {/* Detected Style */}
            <div className="bg-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span>🎨</span> Detected Style
              </h3>
              {detectedStyle ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Font Size</span>
                    <span>{detectedStyle.fontSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Color</span>
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: detectedStyle.color }} />
                      {detectedStyle.color}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Background</span>
                    <span>{detectedStyle.background}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Alignment</span>
                    <span>{detectedStyle.alignment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Font Weight</span>
                    <span>{detectedStyle.fontWeight}</span>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500">No style detected</p>
              )}
            </div>
          </div>
        )}

        {/* Output Video */}
        {outputVideoUrl && (
          <div className="mt-8 bg-zinc-800/50 rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>🎬</span> Output Video
            </h3>
            <video
              src={outputVideoUrl}
              controls
              className="w-full rounded-xl mb-4"
            />
            <div className="text-center">
              <a
                href={outputVideoUrl}
                download="viral-replica-output.mp4"
                className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full font-semibold hover:scale-105 transition-transform"
              >
                ⬇️ Download Video
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
