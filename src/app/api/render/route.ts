import { NextRequest, NextResponse } from 'next/server';
import { painterService } from '../../../lib/services/painter-puppeteer';
import { TextOverlay } from '../../../types/video-processing';

// Increase max duration for rendering
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const videoFile = formData.get('video') as File | null;
        const overlaysJson = formData.get('overlays') as string | null;

        if (!videoFile || !overlaysJson) {
            return NextResponse.json(
                { error: 'Missing video file or overlays' },
                { status: 400 }
            );
        }

        const overlays: TextOverlay[] = JSON.parse(overlaysJson);

        // Save uploaded video strictly for processing
        // We use a temp file because FFmpeg needs a path
        const buffer = Buffer.from(await videoFile.arrayBuffer());
        const tempDir = require('os').tmpdir();
        const tempVideoPath = require('path').join(tempDir, `render-input-${Date.now()}.mp4`);
        await require('fs').promises.writeFile(tempVideoPath, buffer);

        try {
            // Use the Painter!
            const renderedVideoBuffer = await painterService.renderVideo(tempVideoPath, overlays);

            return new NextResponse(new Blob([renderedVideoBuffer as any]), {
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="viral-render-${Date.now()}.mp4"`,
                },
            });

        } finally {
            // Cleanup input
            try {
                await require('fs').promises.unlink(tempVideoPath);
            } catch (e) { }
        }

    } catch (error) {
        console.error('Render error:', error);
        return NextResponse.json(
            { error: 'Failed to render video', details: String(error) },
            { status: 500 }
        );
    }
}

