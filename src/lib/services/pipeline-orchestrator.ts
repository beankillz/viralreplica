import {
    Frame,
    VisionResult // Keep for legacy compatibility if needed
} from '../../types/video-processing';
import {
    RawFrameAnalysis,
    ConsolidatedTextInstance,
    EnrichedOverlay,
    PipelineResult,
    BoundingBox,
    RawTextDetection
} from '../../types/pipeline';
import { visionService } from './vision';
import { structureAnalyzer } from './structure-analyzer';
import { v4 as uuidv4 } from 'uuid';

export class PipelineOrchestrator {

    async processVideo(frames: Frame[], fps: number = 30): Promise<PipelineResult> {
        console.log(`[Pipeline] Starting analysis for ${frames.length} frames...`);

        // 1. Vision Phase (Qwen)
        const rawAnalysis = await visionService.analyzeVideoFrames(frames);

        // 2. Temporal Aggregation (Code)
        const consolidated = this.aggregateDetections(rawAnalysis, fps);
        console.log(`[Pipeline] Aggregated into ${consolidated.length} text instances`);

        // 3. Structural Intelligence (Groq Parallel)
        const [layoutMap, roleMap, rawDesignSystem] = await Promise.all([
            structureAnalyzer.analyzeLayout(consolidated),
            structureAnalyzer.classifyRoles(consolidated),
            structureAnalyzer.generateDesignSystem(consolidated)
        ]);

        // Ensure DesignSystem has robust defaults
        const warnings: string[] = [];

        const primaryFont = rawDesignSystem?.fonts?.primary;
        if (!primaryFont) warnings.push("Could not detect font, using default 'Inter'");

        const designSystem = {
            fonts: {
                primary: primaryFont || 'Inter',
                secondary: rawDesignSystem?.fonts?.secondary || 'Inter',
            },
            colors: {
                primary: rawDesignSystem?.colors?.primary || '#ffffff',
                secondary: rawDesignSystem?.colors?.secondary || '#000000',
                accent: rawDesignSystem?.colors?.accent || '#FF0000',
                background: rawDesignSystem?.colors?.background || '#000000',
                text: rawDesignSystem?.colors?.text || '#ffffff',
            },
            spacing: {
                base: rawDesignSystem?.spacing?.base || 4,
                scale: rawDesignSystem?.spacing?.scale || [4, 8, 16, 24, 32],
            },
            timing: {
                avgDurationPerWord: rawDesignSystem?.timing?.avgDurationPerWord || 0.4,
                minDuration: rawDesignSystem?.timing?.minDuration || 1.0,
            }
        };

        // 4. Enrich Overlays
        const enrichedOverlays: EnrichedOverlay[] = consolidated.map(c => {
            const layout = layoutMap.get(c.id);
            const role = roleMap.get(c.id);

            return {
                ...c,
                role: role || 'BODY', // Default
                layout: layout || {
                    anchor: 'center', alignment: 'center', zIndex: 1,
                    padding: { top: 0, right: 0, bottom: 0, left: 0 },
                    margin: { top: 0, right: 0, bottom: 0, left: 0 }
                }
            };
        });

        // 5. Creative Generation (Variations for Hooks/CTAs)
        const hookAndCtas = enrichedOverlays
            .filter(o => o.role === 'HOOK' || o.role === 'CTA')
            .map(o => ({ id: o.id, text: o.text, role: o.role }));

        const variationMap = await structureAnalyzer.generateVariations(hookAndCtas);

        const variations = Array.from(variationMap.entries()).map(([segmentId, vars]) => ({
            segmentId,
            variations: vars
        }));

        console.log(`[Pipeline] Complete. Generated ${variations.length} sets of variations.`);

        return {
            projectId: uuidv4(),
            overlays: enrichedOverlays,
            designSystem,
            variations,
            warnings
        };
    }

    // --- Aggregation Logic ---

    private aggregateDetections(frames: RawFrameAnalysis[], fps: number): ConsolidatedTextInstance[] {
        // Flatten all detections
        const allDetections: RawTextDetection[] = frames.flatMap(f => f.detections);

        // Group by normalized text (simple cleaning)
        const groups = new Map<string, RawTextDetection[]>();

        allDetections.forEach(d => {
            const key = this.normalizeText(d.text);
            if (!key) return;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(d);
        });

        const instances: ConsolidatedTextInstance[] = [];

        for (const [key, group] of groups.entries()) {
            if (group.length < 2) continue; // Noise filter: ignore single frame flashes

            // Sort by frame index
            group.sort((a, b) => a.frameIndex - b.frameIndex);

            // Determine timing
            const startFrame = group[0].frameIndex;
            const endFrame = group[group.length - 1].frameIndex;
            const startTime = startFrame / fps; // Estimate
            const endTime = endFrame / fps;
            const duration = endTime - startTime;

            // Motion Tracking Analysis
            const motionPath = this.calculateMotionPath(group, fps, startTime);

            // Average Bounding Box (or Dynamic based on motion)
            // If static, use average. If moving, use the bounds at the midpoint?
            // Actually, for the global ConsolidatedInstance, we often want the "resting" position or average for layout.
            // But having the motion path allows re-rendering the movement.
            const bbox = this.averageBoundingBox(group.map(g => g.boundingBox));

            // Best Confidence logic
            const bestDetection = group.reduce((prev, current) =>
                (current.confidence > prev.confidence) ? current : prev
            );

            // Find representative visual style (from frame analysis)
            // We look up the frame analysis for the best detection to get visuals
            const representativeFrame = frames.find(f => f.frameIndex === bestDetection.frameIndex);
            // Default visuals if missing
            const visuals = representativeFrame?.visuals || { typography: {}, styling: {} };

            instances.push({
                id: uuidv4(),
                text: bestDetection.text, // Use the verbatim text from best confidence
                startFrame,
                endFrame,
                startTime,
                endTime,
                duration: duration || 1, // Minimum 1s if single frame?
                boundingBox: bbox,
                motionPath,
                visuals,
                detectionConfidence: bestDetection.confidence
            });
        }

        return instances;
    }

    private normalizeText(text: string): string {
        return text.trim().toLowerCase().replace(/[^\w\s]/gi, '');
    }

    private averageBoundingBox(boxes: BoundingBox[]): BoundingBox {
        const sum = boxes.reduce((acc, box) => ({
            x: acc.x + box.x,
            y: acc.y + box.y,
            width: acc.width + box.width,
            height: acc.height + box.height
        }), { x: 0, y: 0, width: 0, height: 0 });

        return {
            x: sum.x / boxes.length,
            y: sum.y / boxes.length,
            width: sum.width / boxes.length,
            height: sum.height / boxes.length
        };
    }

    private calculateMotionPath(
        detections: RawTextDetection[],
        fps: number,
        baseStartTime: number
    ): import('../../types/pipeline').MotionPath {
        if (detections.length < 2) {
            return {
                keyframes: [],
                type: 'STATIC',
                variance: 0
            };
        }

        // Calculate keyframes (relative time)
        const keyframes = detections.map(d => ({
            time: (d.frameIndex / fps) - baseStartTime,
            x: d.boundingBox.x,
            y: d.boundingBox.y
        })).sort((a, b) => a.time - b.time);

        // Analyze variance to determine motion type
        const xValues = keyframes.map(k => k.x);
        const yValues = keyframes.map(k => k.y);

        const xVariance = this.calculateVariance(xValues);
        const yVariance = this.calculateVariance(yValues);
        const totalVariance = xVariance + yVariance;

        let type: import('../../types/pipeline').MotionPath['type'] = 'STATIC';

        // Thresholds for movement (in % of screen space)
        // If variance is very low, it's static (jitter from OCR)
        // If variance is significant, checking for linearity
        if (totalVariance > 2) { // >2% variance implies movement
            // Check linearity correlation
            // For now, simple heuristic: huge Y change = slide up/down?
            type = 'LINEAR'; // Default to linear motion if moving
        }

        return {
            keyframes,
            type,
            variance: totalVariance
        };
    }

    private calculateVariance(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
    }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
