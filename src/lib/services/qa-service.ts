import { PipelineResult } from '../../types/pipeline';
import { visionService } from './vision';
import { frameExtractor } from './frame-extractor';
import { Frame, DesignSchema, ScriptSegment } from '../../types/video-processing';

export interface QAReport {
    totalScore: number;
    scores: {
        layout: number;
        style: number;
        content: number;
    };
    improvements: string[];
    isPass: boolean;
}



export interface QAReport {
    totalScore: number;
    scores: {
        layout: number;
        style: number;
        content: number;
    };
    improvements: string[];
    isPass: boolean;
}

export class QualityAssuranceService {

    async evaluate(
        designSchema: DesignSchema,
        expectedSegments: ScriptSegment[],
        generatedVideoPath: string
    ): Promise<QAReport> {
        console.log('[QA] Starting evaluation...');

        // 1. Extract frames from the GENERATED video
        // We'll take a few samples to check consistency
        // Extract 3 uniformly distributed frames to get a good spread
        const generatedFrames = await frameExtractor.extractFrames(generatedVideoPath, {
            fps: 0, // unused when using maxFrames with some Extractors, but here we let the extractor handle it
            maxFrames: 3
        });

        if (generatedFrames.length === 0) {
            throw new Error("Could not extract frames from generated video for QA");
        }

        console.log(`[QA] Extracted ${generatedFrames.length} frames for analysis.`);

        // 2. Analyze generated frames with Vision AI (Qwen)
        // We analyze all 3 frames to check for consistency and capture different segments
        const analysisResults = await Promise.all(
            generatedFrames.map((frame, idx) => visionService.analyzeFrame(frame, idx))
        );

        // 3. Compare Logic
        const improvements: string[] = [];
        let layoutScore = 100;
        let styleScore = 100;
        let contentScore = 100; // Start high, deduct for errors

        // --- Style Check (Aggregated) ---
        const intendedFont = designSchema.fontFamily;
        const intendedColor = designSchema.textColor;

        let fontMatchCount = 0;
        let colorMatchCount = 0;
        let totalStyleChecks = 0;

        for (const analysis of analysisResults) {
            const visuals = analysis.visuals || { typography: {}, styling: {} };

            // Font Check
            if (visuals.typography?.fontFamily && intendedFont) {
                totalStyleChecks++;
                if (visuals.typography.fontFamily.toLowerCase().includes(intendedFont.toLowerCase()) ||
                    intendedFont.toLowerCase().includes(visuals.typography.fontFamily.toLowerCase())) {
                    fontMatchCount++;
                }
            }
        }

        // If we found text and checked fonts, but had mismatches
        if (totalStyleChecks > 0 && (fontMatchCount / totalStyleChecks) < 0.5) {
            styleScore -= 20;
            improvements.push(`Font inconsistency detected. Expected '${intendedFont}', but found other fonts.`);
        }


        // --- Content & Layout Check ---
        // We need to map *detected* text to *expected* segments based on time or content match.
        // Since we don't have perfect timestamps for the extracted frames relative to the script perfectly sync'd in this simple check,
        // we'll try to find "best match" for each detected text block.

        let matchedSegmentsCount = 0;
        let totalDetections = 0;
        let layoutMisalignments = 0;

        for (const analysis of analysisResults) {
            if (!analysis.detections || analysis.detections.length === 0) continue;

            for (const detection of analysis.detections) {
                totalDetections++;

                // Fuzzy match detection text to any expected segment
                const matchedSegment = expectedSegments.find(seg =>
                    this.calculateSimilarity(seg.text, detection.text) > 0.6 // 60% similarity threshold
                );

                if (matchedSegment) {
                    matchedSegmentsCount++;

                    // Check Layout for this match
                    // Expected position is in matchedSegment.style.position (top/center/bottom or x/y)
                    // Note: Schema stores absolute or relative, but `vision` returns boundingBox {x, y, w, h} in % (0-100)

                    // Simplified Center Check for now (assuming most viral look is centered)
                    // If segment.style.textAlignment is center, check if detection is roughly centered

                    const centerX = detection.boundingBox.x + (detection.boundingBox.width / 2);
                    // Standard center is 50%
                    if (Math.abs(centerX - 50) > 15) { // Allow 15% deviation
                        layoutMisalignments++;
                    }

                }
            }
        }

        if (totalDetections === 0 && expectedSegments.length > 0) {
            contentScore = 0;
            improvements.push("No text detected in the generated video.");
        } else if (matchedSegmentsCount === 0 && totalDetections > 0) {
            contentScore = 40;
            improvements.push("Detected text does not match the script. Check rendering or AI variations.");
        } else {
            // Calculate content score based on recall
            const recall = matchedSegmentsCount / Math.max(totalDetections, 1);
            if (recall < 0.8) {
                contentScore -= 20;
                improvements.push("Some text overlays are missing or incorrect.");
            }
        }

        if (layoutMisalignments > 0) {
            layoutScore -= (layoutMisalignments * 10);
            improvements.push("Text alignment looks off. Ensure text is centered or positioned correctly.");
        }

        // Clip scores
        layoutScore = Math.max(0, layoutScore);
        styleScore = Math.max(0, styleScore);
        contentScore = Math.max(0, contentScore);

        // --- Final Aggregation ---
        const totalScore = Math.round((layoutScore * 0.4) + (styleScore * 0.3) + (contentScore * 0.3));
        const isPass = totalScore >= 85;

        if (totalScore < 85 && improvements.length === 0) {
            improvements.push("General visual fidelity lower than expected.");
        }

        return {
            totalScore,
            scores: {
                layout: layoutScore,
                style: styleScore,
                content: contentScore
            },
            improvements: [...new Set(improvements)], // Dedup
            isPass
        };
    }

    // Helper: Levenshtein/Jaccard simplified
    private calculateSimilarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        if (longer.length === 0) {
            return 1.0;
        }
        return (longer.length - this.editDistance(longer, shorter)) / longer.length;
    }

    private editDistance(s1: string, s2: string): number {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        const costs = new Array();
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i == 0)
                    costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue),
                                costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0)
                costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
}

export const qaService = new QualityAssuranceService();
