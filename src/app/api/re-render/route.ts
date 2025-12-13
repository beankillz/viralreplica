
import { NextRequest, NextResponse } from 'next/server';
import { painterService } from '../../../lib/services/painter-puppeteer';
import { overlayMapper } from '../../../lib/services/overlay-mapper';
import { DesignSchema, ScriptSegment } from '../../../types/video-processing';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Increase max duration for rendering
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    let tempVideoPath: string | null = null;

    try {
        const formData = await request.formData();
        const videoFile = formData.get('video') as File | null;
        const dataJson = formData.get('data') as string | null;

        if (!videoFile || !dataJson) {
            return NextResponse.json(
                { error: 'Missing video file or data' },
                { status: 400 }
            );
        }

        const data: {
            segments: ScriptSegment[];
            schema: DesignSchema;
            topic: string
        } = JSON.parse(dataJson);

        // Save uploaded video strictly for processing
        const buffer = Buffer.from(await videoFile.arrayBuffer());
        const tempDir = tmpdir();
        // Use unique name to avoid conflicts
        tempVideoPath = join(tempDir, `rerender-input-${Date.now()}.mp4`);
        await writeFile(tempVideoPath, buffer);

        // Map segments to overlays using the shared service
        // We use the provided schema as the default style
        const overlays = overlayMapper.mapSegmentsToOverlays(data.segments, data.schema);

        try {
            // Render the video
            const renderedVideoBuffer = await painterService.renderVideo(tempVideoPath, overlays);

            return new NextResponse(new Blob([renderedVideoBuffer as any]), {
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="viral-rerender-${Date.now()}.mp4"`,
                },
            });

        } finally {
            // Cleanup input
            if (tempVideoPath) {
                try {
                    await unlink(tempVideoPath);
                } catch (e) {
                    console.error('Failed to cleanup temp file:', e);
                }
            }
        }

    } catch (error) {
        console.error('Re-render error:', error);
        return NextResponse.json(
            { error: 'Failed to render video', details: String(error) },
            { status: 500 }
        );
    }
}
