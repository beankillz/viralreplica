import sharp from 'sharp';
import { RawFrameAnalysis, RawTextDetection } from '../../types/pipeline';
import { fontDetectorService } from './font-detector';

const VISION_MODEL_NAME = 'nvidia/nemotron-nano-12b-v2-vl:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// User-provided System Prompt for Vision Phase
const SYSTEM_PROMPT = `
You are a vision-language AI specialized in reading and normalizing text from video frames.
STRICT JSON OUTPUT ONLY. DO NOT HALLUCINATE.
If no text is visible, return empty arrays.
`;

const USER_PROMPT_TEXT = `
Analyze this video frame.

Task 1: Text Extraction (OCR)
For each detected text instance, return:
- Exact text string (verbatim)
- Frame index
- Bounding box (x, y, width, height) normalized to frame size (0-100)
- Confidence score (0–1)
- Detected language (ISO code)

Task 2: Visual Analysis
For each text overlay, infer the visual properties:
- Typography: Font family, font size (relative), font weight, line height, letter spacing
- Styling: Text color (HEX), stroke, shadow, opacity

Rules:
- Treat identical text in different frames as separate instances
- Output valid JSON only
- If uncertain about style, return closest approximation

Return a JSON object with this structure:
{
  "detections": [
    {
      "text": "string",
      "boundingBox": { "x": number, "y": number, "width": number, "height": number },
      "confidence": number,
      "language": "code"
    }
  ],
  "visuals": {
    "typography": { ... },
    "styling": { ... }
  }
}
`;

export class VisionService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.error('OPENROUTER_API_KEY is not set');
        }
    }

    async analyzeVideoFrames(frames: { base64: string; timestamp: number }[]): Promise<RawFrameAnalysis[]> {
        const results: RawFrameAnalysis[] = [];
        const BATCH_SIZE = 3;

        for (let i = 0; i < frames.length; i += BATCH_SIZE) {
            const batch = frames.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (frame, batchIndex) => {
                const globalIndex = i + batchIndex;

                // Retry logic
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts) {
                    try {
                        return await this.analyzeFrame(frame, globalIndex);
                    } catch (error: any) {
                        attempts++;
                        console.warn(`Frame ${globalIndex} analysis failed (Attempt ${attempts}/${maxAttempts}):`, error.message);

                        if (attempts === maxAttempts) {
                            console.error(`Frame ${globalIndex} failed after ${maxAttempts} attempts.`);
                            // Return empty result on final failure
                            return {
                                frameIndex: globalIndex,
                                timestamp: frame.timestamp,
                                detections: [],
                                visuals: { typography: {}, styling: {} }
                            };
                        }

                        // Exponential backoff: 1s, 2s, 4s
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
                    }
                }
                // Should not be reached due to return in loop, but for type safety:
                return {
                    frameIndex: globalIndex,
                    timestamp: frame.timestamp,
                    detections: [],
                    visuals: { typography: {}, styling: {} }
                };
            });

            console.log(`Processing batch ${i / BATCH_SIZE + 1} (${batch.length} frames)...`);
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Small delay between batches to avoid completely hammering the API
            if (i + BATCH_SIZE < frames.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results.sort((a, b) => a.frameIndex - b.frameIndex);
    }

    async analyzeFrame(frame: { base64: string; timestamp: number }, index: number): Promise<RawFrameAnalysis> {
        let base64 = frame.base64;
        if (base64.startsWith('data:image')) {
            base64 = base64.split(',')[1];
        }

        const optimizedImage = await this.optimizeImage(base64);

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
                    'X-Title': 'Viral Replica'
                },
                body: JSON.stringify({
                    model: VISION_MODEL_NAME,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT + "\nIMPORTANT: RETURN JSON ONLY. NO MARKDOWN. NO EXPLANATIONS. MAX LENGTH 1000 CHARS." },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: USER_PROMPT_TEXT },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${optimizedImage}` } }
                            ]
                        }
                    ],
                    max_tokens: 2048, // Hard limit to prevent 130k+ char hallucinations
                    temperature: 0.1, // Low temp for precision
                    response_format: { type: 'json_object' },
                    provider: { sort: 'price' }
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error('No content');

            let parsed;
            try {
                // Sanitize content: remove ```json and ``` blocks if present
                let cleanContent = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

                // Try to repair common JSON errors
                // 1. Fix unterminated strings by closing them
                const openQuotes = (cleanContent.match(/"/g) || []).length;
                if (openQuotes % 2 !== 0) {
                    // Odd number of quotes = unterminated string
                    cleanContent += '"';
                }

                // 2. Fix missing closing braces/brackets
                const openBraces = (cleanContent.match(/\{/g) || []).length;
                const closeBraces = (cleanContent.match(/\}/g) || []).length;
                if (openBraces > closeBraces) {
                    cleanContent += '}'.repeat(openBraces - closeBraces);
                }

                const openBrackets = (cleanContent.match(/\[/g) || []).length;
                const closeBrackets = (cleanContent.match(/\]/g) || []).length;
                if (openBrackets > closeBrackets) {
                    cleanContent += ']'.repeat(openBrackets - closeBrackets);
                }

                parsed = JSON.parse(cleanContent);
            } catch (jsonError) {
                console.error("Invalid JSON received (first 300 chars):", content.substring(0, 300));
                console.error("JSON Error:", jsonError);
                // Return empty result instead of crashing
                return {
                    frameIndex: index,
                    timestamp: frame.timestamp,
                    detections: [],
                    visuals: { typography: {}, styling: {} }
                };
            }
            const detections: RawTextDetection[] = (parsed.detections || []).map((d: any) => ({
                text: d.text,
                frameIndex: index,
                boundingBox: d.boundingBox,
                confidence: d.confidence,
                language: d.language
            }));

            // Optional: Enhance font detection if family provided
            const visuals = parsed.visuals || { typography: {}, styling: {} };
            if (visuals.typography?.fontFamily) {
                // Use language from first detection (most likely dominant)
                const dominantLang = detections.find(d => d.language)?.language;

                const detectedFont = await fontDetectorService.detectFont(
                    visuals.typography.fontFamily,
                    {
                        weight: visuals.typography.fontWeight || 400,
                        hasSerifs: false,
                        isMonospace: false,
                        isDecorative: false,
                        slant: 0
                    },
                    dominantLang
                );

                if (detectedFont.confidence > 0.6 || (dominantLang && detectedFont.confidence > 0.4)) {
                    // Lower threshold if language matched
                    visuals.typography.fontFamily = detectedFont.family;
                }
            }

            return {
                frameIndex: index,
                timestamp: frame.timestamp,
                detections,
                visuals
            };

        } catch (e: any) {
            console.error(`Frame ${index} analysis failed:`, e.message);
            throw e; // Let orchestrator handle or return empty from loop
        }
    }

    private async optimizeImage(base64: string): Promise<string> {
        const buffer = Buffer.from(base64, 'base64');
        const resized = await sharp(buffer)
            .resize(1920, null, { withoutEnlargement: true })
            .jpeg({ quality: 95 })
            .toBuffer();
        return resized.toString('base64');
    }
}

export const visionService = new VisionService();

