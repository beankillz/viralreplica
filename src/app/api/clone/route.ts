
import { NextRequest, NextResponse } from 'next/server';
import { frameExtractor } from '../../../lib/services/frame-extractor';
import { pipelineOrchestrator } from '../../../lib/services/pipeline-orchestrator';
import { painterService } from '../../../lib/services/painter-puppeteer';
import { overlayMapper } from '../../../lib/services/overlay-mapper';
import { TextOverlay, ScriptVariation, DesignSchema, ScriptSegment } from '../../../types/video-processing';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import config from '../../../lib/config';

export const maxDuration = 900; // 15 minutes

export async function POST(request: NextRequest) {
    let tempCompetitorPath: string | null = null;
    let tempUserVideoPath: string | null = null;

    try {
        const formData = await request.formData();
        const competitorVideo = formData.get('competitorVideo') as File | null;
        const userVideo = formData.get('userVideo') as File | null; // The background video
        const topic = formData.get('topic') as string || 'viral content';

        if (!competitorVideo || !userVideo) {
            return NextResponse.json({ error: 'Missing videos' }, { status: 400 });
        }

        // FREE TIER: Validate video sizes
        const compValidation = config.validateVideoSize(competitorVideo.size);
        if (!compValidation.valid) {
            return NextResponse.json({ error: compValidation.error }, { status: 413 });
        }

        const userValidation = config.validateVideoSize(userVideo.size);
        if (!userValidation.valid) {
            return NextResponse.json({ error: userValidation.error }, { status: 413 });
        }

        const tempDir = tmpdir();

        // 1. Save Competitor Video
        tempCompetitorPath = join(tempDir, `comp-${Date.now()}.mp4`);
        await writeFile(tempCompetitorPath, Buffer.from(await competitorVideo.arrayBuffer()));

        // 2. Save User Video (Backgound)
        tempUserVideoPath = join(tempDir, `user-${Date.now()}.mp4`);
        await writeFile(tempUserVideoPath, Buffer.from(await userVideo.arrayBuffer()));

        // --- STEP 1: FRAME EXTRACTION ---
        console.log('Extracting frames...');
        const frameSettings = config.getFrameSettings();
        const frames = await frameExtractor.extractFrames(tempCompetitorPath, {
            fps: frameSettings.fps,
            maxFrames: frameSettings.maxFrames
        });

        // --- STEP 2: EFFICIENT PIPELINE (Vision + Aggregation + Intelligence) ---
        console.log('Running Efficient AI Pipeline...');
        const pipelineResult = await pipelineOrchestrator.processVideo(frames, frameSettings.fps);

        // --- STEP 3: DATA MAPPING (Pipeline Result -> Legacy Types) ---

        // 1. Map Design System -> Design Schema
        const dominantStyle: DesignSchema = {
            fontFamily: pipelineResult.designSystem.fonts.primary,
            textColor: pipelineResult.designSystem.colors.text,
            backgroundColor: pipelineResult.designSystem.colors.background,
            borderRadius: '12px', // Default or derived
            padding: `${pipelineResult.designSystem.spacing.base * 2}px`,
            textAlignment: 'center',
            icons: []
        };

        // 2. Map Consolidated Overlays -> Script Segments (Base)
        const baseSegments: ScriptSegment[] = pipelineResult.overlays.map(o => ({
            role: o.role.toLowerCase() as 'hook' | 'body' | 'cta',
            text: o.text,
            originalText: o.text,
            startTime: o.startTime,
            endTime: o.endTime,
            style: {
                ...dominantStyle,
                // Apply specific layout overrides based on actual detection
                // Using normalized coordinates (0-100)
                position: {
                    x: o.boundingBox.x + (o.boundingBox.width / 2), // Center X
                    y: o.boundingBox.y + (o.boundingBox.height / 2) // Center Y
                },
                width: `${o.boundingBox.width}%`, // Use explicit width
                height: `${o.boundingBox.height}%`
            },
            boundingBox: o.boundingBox,
            motionPath: o.motionPath ? {
                keyframes: o.motionPath.keyframes.map(k => ({
                    time: k.time * 1000, // Convert seconds to ms
                    x: k.x,
                    y: k.y
                })),
                duration: (o.endTime - o.startTime) * 1000,
                easing: o.motionPath.type === 'EASE_IN' ? 'ease-in' :
                    o.motionPath.type === 'EASE_OUT' || o.motionPath.type === 'POP_IN' ? 'ease-out' : 'linear'
            } : undefined // Pass motion data to frontend/renderer
        }));

        // 3. Construct Variations
        // Create 3 variations (plus the original as one)
        const variations: ScriptVariation[] = [];

        // Variation 1: Original
        variations.push({ name: 'Original', segments: baseSegments });

        // Generate other variations from the pipeline map
        // We assume 3 variations were requested. pipelineResult.variations has structure: { segmentId, variations: [str1, str2, str3] }

        const numVariations = 3;
        for (let i = 0; i < numVariations; i++) {
            const newSegments = baseSegments.map(seg => {
                // Check if this segment has a variation
                // Find the overlay ID that generated this segment (index matching is risky, using ID is better but we lost ID in map above)
                // We need to match pipelineResult.overlays[index] to pipelineResult.variations
                const overlay = pipelineResult.overlays.find(o => o.text === seg.originalText && Math.abs(o.startTime - seg.startTime) < 0.1);

                if (overlay) {
                    const vars = pipelineResult.variations?.find(v => v.segmentId === overlay.id);
                    if (vars && vars.variations[i]) {
                        return { ...seg, text: vars.variations[i] };
                    }
                }
                return seg;
            });

            variations.push({ name: `Variation ${i + 1}`, segments: newSegments });
        }

        // Select Variation 1 (AI Generated) or Original if none
        const selectedVariation = variations.length > 1 ? variations[1] : variations[0];

        // --- STEP 4: RENDER ---
        console.log('Rendering video...');
        const overlays = overlayMapper.mapSegmentsToOverlays(selectedVariation.segments, dominantStyle);
        const renderedBuffer = await painterService.renderVideo(tempUserVideoPath, overlays);

        return new NextResponse(new Blob([renderedBuffer as any]), {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="clone-${Date.now()}.mp4"`,
                'X-Variations': JSON.stringify(variations),
                'X-Schema': JSON.stringify(dominantStyle),
                'X-Warnings': pipelineResult.warnings ? JSON.stringify(pipelineResult.warnings) : '[]'
            }
        });

    } catch (error) {
        console.error('Clone failed:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    } finally {
        if (tempCompetitorPath) try { await unlink(tempCompetitorPath) } catch { }
        if (tempUserVideoPath) try { await unlink(tempUserVideoPath) } catch { }
    }
}
