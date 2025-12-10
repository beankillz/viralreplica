
import { NextRequest, NextResponse } from 'next/server';
import { frameExtractor } from '../../../lib/services/frame-extractor';
import { visionService } from '../../../lib/services/vision';
import { variationService } from '../../../lib/services/variation';
import { painterService } from '../../../lib/services/painter-puppeteer';
import { TextOverlay, VisionResult, ScriptVariation } from '../../../types/video-processing';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import config from '../../../lib/config';

export const maxDuration = 300;

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

        // --- STEP 1: THE EYE ---
        console.log('Running Eye...');
        // Dynamic frame settings based on tier (free tier: 10 frames @ 1fps, paid: 20 frames @ 2fps)
        const frameSettings = config.getFrameSettings();
        const frames = await frameExtractor.extractFrames(tempCompetitorPath, {
            fps: frameSettings.fps,
            maxFrames: frameSettings.maxFrames
        });
        const visionResults = await visionService.analyzeVideoFrames(frames);

        // Find dominant style (heuristic: last found style or first)
        const dominantStyle = visionResults.find(r => r.design)?.design || {
            // Fallback style
            backgroundColor: '#000000',
            textColor: '#FFFFFF',
            fontFamily: 'Inter',
            borderRadius: '12px',
            padding: '16px',
            textAlignment: 'center',
            icons: []
        };


        // --- STEP 2: THE BRAIN ---
        console.log('Running Brain...');
        const variations = await variationService.generateVariations(visionResults, topic);

        if (!variations || variations.length === 0) {
            console.warn('No variations generated. Vision Results:', JSON.stringify(visionResults, null, 2));
            return NextResponse.json({
                error: 'Could not generate variations. Possibly no text detected or AI service unavailable.',
                visionErrors: visionResults.map(r => r.error).filter(Boolean)
            }, { status: 422 });
        }

        // Select the first variation for rendering
        const selectedVariation = variations[0];
        console.log('Selected Variation:', selectedVariation.name);


        // --- STEP 3: THE PAINTER ---
        console.log('Running Painter...');

        // Map ScriptSegments + Style -> TextOverlay[]
        // Map ScriptSegments + Style -> TextOverlay[]
        const overlays: TextOverlay[] = selectedVariation.segments.map(seg => {
            // Calculate center from bounding box if available
            let position = { x: 50, y: 50 }; // Default center
            if (seg.boundingBox) {
                position = {
                    x: seg.boundingBox.x + (seg.boundingBox.width / 2),
                    y: seg.boundingBox.y + (seg.boundingBox.height / 2)
                };
            }

            // Merge dominant style with specific segment style
            const styleToUse = seg.style || dominantStyle;

            // Heuristic for font size: 80% of bounding box height in vh, or default 40px
            let fontSize = '40px';
            if (seg.boundingBox) {
                fontSize = `${seg.boundingBox.height * 0.8}vh`;
            }

            return {
                text: seg.text,
                startTime: seg.startTime,
                endTime: seg.endTime,
                style: {
                    fontSize: fontSize,
                    color: styleToUse.textColor || '#FFFFFF',
                    background: styleToUse.backgroundColor || 'rgba(0,0,0,0.7)',
                    position: position,
                    alignment: styleToUse.textAlignment || 'center',
                    fontWeight: 'bold',
                    fontFamily: styleToUse.fontFamily || 'Inter'
                },
                motionPath: seg.motionPath // Pass motion path
            } as any;
        });

        const renderedBuffer = await painterService.renderVideo(tempUserVideoPath, overlays);

        return new NextResponse(new Blob([renderedBuffer as any]), {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="clone-${Date.now()}.mp4"`,
                'X-Variations': JSON.stringify(variations) // Pass back variations in header? Or separate endpoint? 
                // For now, let's just return the video. Ideally we return JSON with video URL, but for V1 "One Click -> Download" is simplest.
            }
        });

    } catch (error) {
        console.error('Clone failed:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    } finally {
        // Cleanup all temps
        if (tempCompetitorPath) try { await unlink(tempCompetitorPath) } catch { }
        if (tempUserVideoPath) try { await unlink(tempUserVideoPath) } catch { }
    }
}
