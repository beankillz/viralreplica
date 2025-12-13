import { NextRequest, NextResponse } from 'next/server';
import { qaService } from '@/lib/services/qa-service';
import { PipelineResult } from '@/types/pipeline';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
    try {
        const { videoUrl, designSchema, segments } = await req.json();

        if (!videoUrl || !designSchema || !segments) {
            return NextResponse.json(
                { error: 'Missing videoUrl, designSchema, or segments' },
                { status: 400 }
            );
        }

        console.log('[API/QA] Received request for:', videoUrl);

        // Convert URL to local path if possible, or use URL directly
        // If it's a relative URL like "/uploads/...", map it to local file system
        let videoPath = videoUrl;

        // Handle local temp files (if the app serves them from a specific dir)
        // For this prototype, assuming standard flow where we might need to fetch it if it's a blob
        // OR if it's a data URL (base64).

        let tempFilePath = '';

        if (videoUrl.startsWith('data:')) {
            // Write base64 to temp file
            const base64Data = videoUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            tempFilePath = path.join(os.tmpdir(), `qa_upload_${Date.now()}.mp4`);
            await fs.writeFile(tempFilePath, buffer);
            videoPath = tempFilePath;
        }
        // If it's a relative public URL
        else if (videoUrl.startsWith('/')) {
            // Try to resolve to public/ dir?
            // Or if it's a mocked URL from the previous step. 
            // Ideally, the previous step returned a path or the frontend holds the blob.
            // If frontend holds blob, it sends base64 (handled above).

            // If it is an absolute URL (http), ffmpeg handles it.
        }

        const report = await qaService.evaluate(designSchema, segments, videoPath);

        // Cleanup
        if (tempFilePath) {
            await fs.unlink(tempFilePath).catch(e => console.error('Failed to cleanup QA temp:', e));
        }

        return NextResponse.json(report);

    } catch (error: any) {
        console.error('[API/QA] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
