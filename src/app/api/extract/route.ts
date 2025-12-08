import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, readdir, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(request: NextRequest) {
    const workDir = path.join(os.tmpdir(), `viral-extract-${Date.now()}`);

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No video file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith('video/')) {
            return NextResponse.json(
                { error: 'File must be a video' },
                { status: 400 }
            );
        }

        // Create work directory
        await mkdir(workDir, { recursive: true });

        // Save uploaded video
        const videoBytes = new Uint8Array(await file.arrayBuffer());
        const inputPath = path.join(workDir, 'input.mp4');
        await writeFile(inputPath, videoBytes);

        // Extract frames at 1 FPS using fluent-ffmpeg
        const outputPattern = path.join(workDir, 'frame_%04d.png');

        await new Promise<void>((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-vf', 'fps=1',
                    '-frame_pts', '1'
                ])
                .output(outputPattern)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });

        // Read extracted frames
        const files = await readdir(workDir);
        const frameFiles = files
            .filter(f => f.startsWith('frame_') && f.endsWith('.png'))
            .sort();

        const frames: { timestamp: number; base64: string }[] = [];

        for (let i = 0; i < frameFiles.length; i++) {
            const framePath = path.join(workDir, frameFiles[i]);
            const frameData = await readFile(framePath);
            const base64 = frameData.toString('base64');

            frames.push({
                timestamp: i * 1000, // 1 FPS = 1000ms per frame
                base64: `data:image/png;base64,${base64}`,
            });

            // Clean up frame file
            await unlink(framePath);
        }

        // Clean up input video
        await unlink(inputPath);

        return NextResponse.json({
            success: true,
            frameCount: frames.length,
            frames,
        });
    } catch (error) {
        console.error('Frame extraction error:', error);
        return NextResponse.json(
            { error: 'Failed to extract frames', details: String(error) },
            { status: 500 }
        );
    }
}
