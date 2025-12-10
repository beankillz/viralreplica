import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Frame, ExtractionOptions } from '../../types/video-processing';

// Ensure FFmpeg path is set
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class FrameExtractorService {
    /**
     * Extract frames from a video file
     */
    async extractFrames(videoPath: string, options: ExtractionOptions = {}): Promise<Frame[]> {
        const fps = options.fps || 1;
        const workDir = await this.createTempDir();
        const outputPattern = path.join(workDir, 'frame_%04d.png');

        try {
            await new Promise<void>((resolve, reject) => {
                const command = ffmpeg(videoPath)
                    .outputOptions([
                        '-vf', `fps=${fps}`,
                        '-frame_pts', '1'
                    ])
                    .output(outputPattern);

                command.on('end', () => resolve());
                command.on('error', (err) => reject(err));
                command.run();
            });

            // Read extracted frames
            const files = await fs.readdir(workDir);
            const frameFiles = files
                .filter(f => f.startsWith('frame_') && f.endsWith('.png'))
                .sort();

            const frames: Frame[] = [];

            // Limit max frames if requested
            const processFiles = options.maxFrames
                ? frameFiles.slice(0, options.maxFrames)
                : frameFiles;

            for (let i = 0; i < processFiles.length; i++) {
                const framePath = path.join(workDir, processFiles[i]);
                const frameData = await fs.readFile(framePath);

                frames.push({
                    timestamp: i * (1000 / fps),
                    base64: `data:image/png;base64,${frameData.toString('base64')}`,
                    path: framePath
                });
            }

            return frames;

        } finally {
            await this.cleanup(workDir);
        }
    }

    private async createTempDir(): Promise<string> {
        const dir = path.join(os.tmpdir(), `viral-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(dir, { recursive: true });
        return dir;
    }

    private async cleanup(dir: string): Promise<void> {
        try {
            await fs.rm(dir, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to cleanup temp dir ${dir}:`, e);
        }
    }
}

export const frameExtractor = new FrameExtractorService();
