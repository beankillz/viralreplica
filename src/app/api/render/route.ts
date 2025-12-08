import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface TextOverlay {
    text: string;
    startTime: number;
    endTime: number;
    style: {
        fontSize: string;
        color: string;
        background: string;
        position: { x: number; y: number };
        alignment: string;
        fontWeight: string;
    };
}

function hexToFFmpegColor(hex: string): string {
    const clean = hex.replace('#', '');
    return clean.length === 6 ? clean : 'FFFFFF';
}

function buildDrawtextFilters(overlays: TextOverlay[]): string[] {
    if (!overlays || overlays.length === 0) return [];

    return overlays.map((overlay) => {
        const { text, startTime, endTime, style } = overlay;
        const fontSize = parseInt(style.fontSize) || 24;
        const start = startTime / 1000;
        const end = endTime / 1000;

        const escapedText = text
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "'\\\\\\''")
            .replace(/:/g, '\\:')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');

        const x = `(w*${style.position.x}/100)`;
        const y = `(h*${style.position.y}/100)`;

        return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${hexToFFmpegColor(style.color)}:x=${x}:y=${y}:enable='between(t,${start},${end})'`;
    });
}

export async function POST(request: NextRequest) {
    const timestamp = Date.now();
    const workDir = path.join(os.tmpdir(), `viral-render-${timestamp}`);
    const inputPath = path.join(workDir, 'input.mp4');
    const outputPath = path.join(workDir, 'output.mp4');

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

        // Create work directory
        await mkdir(workDir, { recursive: true });

        // Stream video file to disk instead of buffering entire file
        const videoStream = videoFile.stream();
        const reader = videoStream.getReader();
        const FILE_generated_content = Buffer.alloc(0); // Not used, just placeholders

        // Write file using standard node streams or buffer if small enough, 
        // but for Next.js File objects, usually arrayBuffer() is safe for reasonable sizes.
        // For true streaming we'd use pipe, but File interface gives arrayBuffer.e
        // To be safe against OOM on input, we write the buffer.
        // Note: request.formData() already consumed memory to parse the body. 
        // For true streaming uploads, receiving straight to disk is preferred but complex in Next API routes.
        // We'll proceed with arrayBuffer() for now as it's better than JSON+Base64.
        const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
        await writeFile(inputPath, videoBuffer);

        // Resolve font path
        const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf').replace(/\\/g, '/');

        // Build FFmpeg command
        const drawtextFilters = buildDrawtextFilters(overlays, fontPath);

        await new Promise<void>((resolve, reject) => {
            let cmd = ffmpeg(inputPath);

            if (drawtextFilters.length > 0) {
                cmd = cmd.videoFilters(drawtextFilters);
            }

            cmd
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast', // Use ultrafast for speed/lower mem
                    '-c:a', 'copy',
                    '-y'
                ])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });

        // Read the output file
        const fileBuffer = await readFile(outputPath);

        // Cleanup immediately
        await unlink(inputPath);
        await unlink(outputPath);
        // Try to remove dir, ignore if not empty (though it should be)
        // rmdir(workDir).catch(() => {}); 

        // Return output as a blob/file response
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="rendered-${timestamp}.mp4"`,
            },
        });

    } catch (error) {
        console.error('Render error:', error);
        return NextResponse.json(
            { error: 'Failed to render video', details: String(error) },
            { status: 500 }
        );
    }
}
