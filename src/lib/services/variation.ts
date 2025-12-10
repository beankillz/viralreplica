
import Groq from 'groq-sdk';
import { VisionResult, ScriptSegment, ScriptVariation } from '../../types/video-processing';
import { motionTrackerService } from './motion-tracker';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export class VariationService {

    // 1. Analyze the raw OCR text to find the "Pattern" (not strict requirement if we just trust the flow, 
    // but useful if we want to label "Hook")
    // For now, we'll skip complex "categorization" and just treat the sequence of text as the pattern structure.

    // 2. Generate Variations
    async generateVariations(
        visionResults: VisionResult[],
        topic: string = "a generic viral video"
    ): Promise<ScriptVariation[]> {

        // Extract plain text segments with timing
        // Filter out empty detections
        let originalSegments: ScriptSegment[] = [];

        visionResults.forEach((frame, idx) => {
            if (frame.detections && frame.detections.length > 0) {
                const combinedText = frame.detections.map(d => d.text).join(' ');

                // Calculate frame duration based on assumption (or pass it in). 
                // Since we rely on consecutive frames, "end time" is essentially "next frame time".
                // If FPS is 2, diff is 500ms.
                const frameDuration = (visionResults[1]?.timestamp || 1000) - (visionResults[0]?.timestamp || 0);

                const last = originalSegments[originalSegments.length - 1];

                if (last && last.text === combinedText) {
                    // Extend end time
                    last.endTime = (frame.timestamp || 0) + frameDuration;
                } else {
                    originalSegments.push({
                        role: 'unknown',
                        text: combinedText,
                        originalText: combinedText,
                        startTime: frame.timestamp || 0,
                        endTime: (frame.timestamp || 0) + frameDuration,
                        style: frame.design,
                        boundingBox: frame.detections[0]?.boundingBox
                    });
                }
            }
        });

        // If no text found, return empty
        if (originalSegments.length === 0) return [];

        // Track motion paths for animated text
        const motionPaths = await motionTrackerService.trackTextMotion(visionResults);

        // Attach motion paths to segments
        for (const segment of originalSegments) {
            const motionPath = motionPaths.get(segment.text);
            if (motionPath) {
                segment.motionPath = motionPath;
            }
        }

        // Construct Prompt
        const scriptText = originalSegments.map((s, i) => `Segment ${i + 1}: "${s.text}"`).join('\n');

        const systemPrompt = `
        You are a viral script expert. You analyze existing successful video scripts and generate new variations based on a given topic, keeping the EXACT same structure and timing implications.
        
        Input Script:
        ${scriptText}
        
        Task: 
        Generate 3 distinct variations of this script for the topic: "${topic}".
        Each variation must have exactly ${originalSegments.length} segments, corresponding 1-to-1 with the input segments.
        Keep the text length similar to the original to fit the video timing.
        
        Output JSON format:
        {
            "variations": [
                {
                    "name": "Variation 1 (Direct)",
                    "segments": ["text 1", "text 2", ...]
                },
                 {
                    "name": "Variation 2 (Engaging)",
                    "segments": ["text 1", "text 2", ...]
                },
                 {
                    "name": "Variation 3 (Contrarian)",
                    "segments": ["text 1", "text 2", ...]
                }
            ]
        }
        Return ONLY valid JSON.
        `;

        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Topic: ${topic}` }
                ],
                model: 'llama-3.1-8b-instant', // Fast and good enough
                temperature: 0.7,
                response_format: { type: 'json_object' }
            });

            const responseContent = completion.choices[0]?.message?.content;
            if (!responseContent) throw new Error('No content from Groq');

            const parsed = JSON.parse(responseContent);

            // Map back to ScriptSegments
            return parsed.variations.map((v: any) => ({
                name: v.name,
                segments: v.segments.map((text: string, idx: number) => ({
                    role: 'unknown',
                    text: text,
                    originalText: originalSegments[idx]?.originalText || '',
                    startTime: originalSegments[idx]?.startTime || 0,
                    endTime: originalSegments[idx]?.endTime || 0,
                    style: originalSegments[idx]?.style,      // Propagate style
                    boundingBox: originalSegments[idx]?.boundingBox, // Propagate position
                    motionPath: originalSegments[idx]?.motionPath // Propagate motion
                }))
            }));

        } catch (error) {
            console.error('Variation generation failed:', error);
            // Fallback: Return original as a "variation"
            return [{
                name: "Original (Fallback)",
                segments: originalSegments
            }];
        }
    }
}

export const variationService = new VariationService();
