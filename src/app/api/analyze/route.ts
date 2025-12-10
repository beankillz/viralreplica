import { NextRequest, NextResponse } from 'next/server';
import { frameExtractor } from '../../../lib/services/frame-extractor';
import { visionService } from '../../../lib/services/vision';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

export const maxDuration = 60; // Allow 60 seconds for processing

export async function POST(request: NextRequest) {
    let tempVideoPath: string | null = null;

    try {
        const formData = await request.formData();
        const videoFile = formData.get('video') as File | null;

        if (!videoFile) {
            return NextResponse.json(
                { error: 'No video file provided' },
                { status: 400 }
            );
        }

        // 1. Save video to temp file
        const buffer = Buffer.from(await videoFile.arrayBuffer());
        const tempDir = os.tmpdir();
        tempVideoPath = path.join(tempDir, `upload-${Date.now()}.mp4`);
        await writeFile(tempVideoPath, buffer);

        // 2. Extract frames (limit to first 5 seconds or reasonable amount to avoid costs/time)
        // Extract 1 fps for up to 5 seconds = 5 frames max for now to be safe
        const frames = await frameExtractor.extractFrames(tempVideoPath, {
            fps: 1,
            maxFrames: 5
        });

        // 3. Analyze frames with Gemini
        const visionResults = await visionService.analyzeVideoFrames(frames);

        // 4. Cleanup temp video
        // (Frames are cleaned up by frameExtractor internally if using its temp dir logic, 
        // but frameExtractor.extractFrames implementation cleans up its own workDir? 
        // Checking implementation: extractFrames calls this.cleanup(workDir) strictly within a finally block?
        // Wait, looking at frame-extractor.ts:
        // try { ... return frames } finally { await this.cleanup(workDir); }
        // If it cleans up workDir, the frame images on disk are gone!
        // ERROR: If frameExtractor cleans up immediately, we can't read them?
        // Let's re-read frame-extractor.ts logic.
        // It reads files into base64 in memory: 
        // frames.push({ ..., base64: `data:image/png;base64,...` })
        // So we are good. The files on disk are deleted, but we have the base64 data.

        return NextResponse.json({
            success: true,
            results: visionResults
        });

    } catch (error) {
        console.error('Analysis failed:', error);
        return NextResponse.json(
            { error: 'Analysis failed', details: String(error) },
            { status: 500 }
        );
    } finally {
        if (tempVideoPath) {
            try {
                await unlink(tempVideoPath);
            } catch (e) {
                console.warn('Failed to delete temp video:', e);
            }
        }
    }
}
