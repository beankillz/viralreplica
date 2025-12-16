
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env before imports
dotenv.config({ path: '.env.local' });

async function testPipeline() {
    console.log('--- Starting Local Pipeline Test ---');

    const videoPath = path.join(process.cwd(), 'test-video.mp4');
    if (!fs.existsSync(videoPath)) {
        console.error('test-video.mp4 not found.');
        return;
    }

    // Dynamically import services to ensure env vars are loaded first
    const { frameExtractor } = await import('../src/lib/services/frame-extractor');
    const { pipelineOrchestrator } = await import('../src/lib/services/pipeline-orchestrator');
    const { painterService } = await import('../src/lib/services/painter-puppeteer');

    try {
        // 1. Extraction
        console.log('1. Extracting frames...');
        const frames = await frameExtractor.extractFrames(videoPath, { fps: 1, maxFrames: 3 });
        console.log(`   Extracted ${frames.length} frames.`);

        // 2. Analysis (Vision + Structure)
        console.log('2. Running Pipeline Analysis...');
        const pipelineResult = await pipelineOrchestrator.processVideo(frames, 1);
        console.log('   Analysis complete.');
        console.log(`   Detected ${pipelineResult.overlays.length} overlays.`);

        if (pipelineResult.warnings.length > 0) {
            console.log('   Warnings:', pipelineResult.warnings);
        }

        // 3. Painter/Rendering
        console.log('3. Rendering video (Testing Chrome/Puppeteer)...');
        // Create dummy overlays based on result if empty or just use result
        const overlays = pipelineResult.overlays;

        // Mocking overlays if none found (to test painter regardless of vision success)
        if (overlays.length === 0) {
            console.log('   No overlays detected, adding dummy overlay to test Painter...');
            overlays.push({
                id: 'dummy',
                text: 'Test Overlay',
                startTime: 0,
                endTime: 3,
                startFrame: 0,
                endFrame: 90,
                duration: 3,
                boundingBox: { x: 10, y: 10, width: 200, height: 100 },
                motionPath: { keyframes: [], type: 'STATIC', variance: 0 },
                visuals: { typography: {}, styling: {} },
                detectionConfidence: 1,
                role: 'BODY',
                layout: { anchor: 'center', alignment: 'center', zIndex: 1, padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
                style: {
                    position: { x: 50, y: 50 },
                    fontSize: '48px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    background: '#000000',
                    alignment: 'center'
                }
            } as any);
        }

        // Mapping EnrichedOverlay to TextOverlay for Painter
        const painterOverlays = overlays.map(o => ({
            id: o.id,
            text: o.text,
            startTime: o.startTime * 1000 || 0, // s to ms
            endTime: o.endTime * 1000 || 3000,
            style: {
                position: { x: 50, y: 50 }, // simplify
                fontSize: '40px',
                color: 'white',
                background: 'rgba(0,0,0,0.5)',
                alignment: 'center',
                fontWeight: 'bold',
                fontFamily: o.visuals?.typography?.fontFamily || 'Inter'
            }
        }));

        const outputPath = path.join(process.cwd(), 'test-local-output.mp4');
        const buffer = await painterService.renderVideo(videoPath, painterOverlays as any);

        fs.writeFileSync(outputPath, buffer);
        console.log(`   Render success! Saved to ${outputPath} (${buffer.length} bytes)`);
        console.log('--- Test Passed ---');

    } catch (e: any) {
        console.error('--- Test Failed ---');
        console.error(e);
        process.exit(1);
    }
}

testPipeline();
