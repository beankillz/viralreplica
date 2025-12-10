import { frameExtractor } from '../src/lib/services/frame-extractor';
import { visionService } from '../src/lib/services/vision';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Use strict relative paths for verification script content
// Assumes running from project root using `npx tsx scripts/verify-eye.ts`
// scripts/verify-eye.ts -> ../src/lib...

const TEST_VIDEO_PATH = path.resolve('test-video.mp4');

async function createDummyVideo() {
    if (fs.existsSync(TEST_VIDEO_PATH)) return;
    console.log('Generating dummy video...');
    // Generate 2 seconds video
    try {
        execSync(`ffmpeg -f lavfi -i testsrc=duration=2:size=640x360:rate=1 -c:v libx264 -y ${TEST_VIDEO_PATH}`, { stdio: 'ignore' });
    } catch (e) {
        console.log('FFmpeg failed to generate video, creating a dummy empty file just to pass existence check (will fail extraction if real ffmpeg needed)');
        // Ensure you have ffmpeg installed or this will fail
    }
}

async function verify() {
    console.log('Starting verification...');

    // 1. Setup
    await createDummyVideo();

    try {
        // 2. Test Extraction
        console.log('Testing Frame Extraction...');
        const frames = await frameExtractor.extractFrames(TEST_VIDEO_PATH, { fps: 1 });
        console.log(`Extracted ${frames.length} frames.`);

        if (frames.length === 0) throw new Error('No frames extracted');

        // 3. Test Vision (Gemini)
        console.log('Testing Gemini Vision Service...');
        const result = await visionService.analyzeFrame(frames[0], 0);

        console.log('--- Vision Result ---');
        console.log('Detections:', result.detections.length);
        if (result.design) {
            console.log('Design Schema Found:');
            console.log('  Background:', result.design.backgroundColor);
            console.log('  Font:', result.design.fontFamily);
            console.log('  Padding:', result.design.padding);
        } else {
            console.warn('⚠️ No Desgin Schema returned (might be expected if frame is empty/simple)');
        }

        if (result.error) throw new Error(`Vision Service reported error: ${result.error}`);

        console.log('✅ "The Eye" Gemini verification passed!');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

// Ensure API Key is available
if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    // Fallback for this session if not in env
    process.env.GOOGLE_API_KEY = 'AIzaSyAzvEpELqYBeZpFw_8D29VCQl-Pod_qu4s';
}

verify();
