import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface TextOverlay {
    text: string;
    startTime: number;  // milliseconds
    endTime: number;    // milliseconds
    style: {
        fontSize: string;
        color: string;
        background: string;
        position: { x: number; y: number };
        alignment: string;
        fontWeight: string;
    };
}

interface RenderRequest {
    videoBase64: string;
    overlays: TextOverlay[];
    outputFormat?: 'mp4' | 'webm';
}

function hexToFFmpegColor(hex: string): string {
    // Convert hex color to FFmpeg format
    const clean = hex.replace('#', '');
    return clean.length === 6 ? clean : 'FFFFFF';
}

function buildDrawtextFilters(overlays: TextOverlay[]): string[] {
    if (!overlays || overlays.length === 0) return [];

    return overlays.map((overlay) => {
        const { text, startTime, endTime, style } = overlay;

        // Parse font size
        const fontSize = parseInt(style.fontSize) || 24;

        // Convert times to seconds
        const start = startTime / 1000;
        const end = endTime / 1000;

        // Escape special characters in text for FFmpeg
        const escapedText = text
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "'\\\\\\''")
            .replace(/:/g, '\\:')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');

        // Position as percentage
        const x = `(w*${style.position.x}/100)`;
        const y = `(h*${style.position.y}/100)`;

        return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${hexToFFmpegColor(style.color)}:x=${x}:y=${y}:enable='between(t,${start},${end})'`;
    });
}

export async function POST(request: NextRequest) {
    const workDir = path.join(os.tmpdir(), `viral-render-${Date.now()}`);

    try {
        const body: RenderRequest = await request.json();
        const { videoBase64, overlays, outputFormat = 'mp4' } = body;

        if (!videoBase64) {
            return NextResponse.json(
                { error: 'No video provided' },
                { status: 400 }
            );
        }

        // Create work directory
        await mkdir(workDir, { recursive: true });

        // Decode base64 video and save
        const videoData = videoBase64.replace(/^data:video\/\w+;base64,/, '');
        const videoBytes = Buffer.from(videoData, 'base64');
        const inputPath = path.join(workDir, 'input.mp4');
        const outputPath = path.join(workDir, `output.${outputFormat}`);

        await writeFile(inputPath, videoBytes);

        // Build FFmpeg command
        const drawtextFilters = buildDrawtextFilters(overlays);

        await new Promise<void>((resolve, reject) => {
            let cmd = ffmpeg(inputPath);

            if (drawtextFilters.length > 0) {
                cmd = cmd.videoFilters(drawtextFilters);
            }

            cmd
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-c:a', 'copy',
                    '-y'
                ])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });

        // Read output video
        const outputData = await readFile(outputPath);
        const outputBase64 = outputData.toString('base64');
        const mimeType = outputFormat === 'webm' ? 'video/webm' : 'video/mp4';

        // Clean up
        await unlink(inputPath);
        await unlink(outputPath);

        return NextResponse.json({
            success: true,
            video: `data:${mimeType};base64,${outputBase64}`,
            format: outputFormat,
            overlayCount: overlays?.length || 0,
        });
    } catch (error) {
        console.error('Render error:', error);
        return NextResponse.json(
            { error: 'Failed to render video', details: String(error) },
            { status: 500 }
        );
    }
}
