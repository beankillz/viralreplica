import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoading = false;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Load and initialize FFmpeg WASM
 * Uses singleton pattern to avoid multiple initializations
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg && ffmpeg.loaded) {
        return ffmpeg;
    }

    if (loadPromise) {
        return loadPromise;
    }

    if (isLoading) {
        // Wait for existing load to complete
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (ffmpeg) return ffmpeg;
    }

    isLoading = true;

    loadPromise = (async () => {
        const ff = new FFmpeg();

        // Load FFmpeg WASM from CDN
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        await ff.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpeg = ff;
        isLoading = false;
        return ff;
    })();

    return loadPromise;
}

/**
 * Get the loaded FFmpeg instance
 */
export function getFFmpeg(): FFmpeg | null {
    return ffmpeg;
}

export interface ExtractedFrame {
    timestamp: number; // in milliseconds
    filename: string;
    data: Uint8Array;
}

/**
 * Extract frames from a video at specified intervals
 * @param videoData - Video file as Uint8Array or File
 * @param intervalMs - Interval between frames in milliseconds
 * @param inputFilename - Name for the input file (optional)
 * @returns Array of extracted frames with timestamps
 */
export async function extractFrames(
    videoData: Uint8Array | File,
    intervalMs: number = 500,
    inputFilename: string = 'input.mp4'
): Promise<ExtractedFrame[]> {
    const ff = await loadFFmpeg();

    // Convert File to Uint8Array if needed
    let videoBytes: Uint8Array;
    if (videoData instanceof File) {
        videoBytes = new Uint8Array(await videoData.arrayBuffer());
    } else {
        videoBytes = videoData;
    }

    // Write input video to FFmpeg virtual filesystem
    await ff.writeFile(inputFilename, videoBytes);

    // Get video duration first
    // Run ffprobe-like command to get duration
    await ff.exec(['-i', inputFilename, '-f', 'null', '-']);

    // Calculate FPS from interval (intervalMs -> frames per second)
    // e.g., 500ms interval = 2 fps, 1000ms = 1 fps, 100ms = 10 fps
    const fps = 1000 / intervalMs;

    // Extract frames as images
    // Using fps filter to control frame rate
    await ff.exec([
        '-i', inputFilename,
        '-vf', `fps=${fps}`,
        '-frame_pts', '1',
        'frame_%04d.png'
    ]);

    // Read extracted frames from virtual filesystem
    const frames: ExtractedFrame[] = [];
    let frameIndex = 1;

    while (true) {
        const frameFilename = `frame_${frameIndex.toString().padStart(4, '0')}.png`;
        try {
            const frameData = await ff.readFile(frameFilename);
            if (frameData instanceof Uint8Array) {
                frames.push({
                    timestamp: (frameIndex - 1) * intervalMs,
                    filename: frameFilename,
                    data: frameData,
                });
                // Clean up frame file
                await ff.deleteFile(frameFilename);
            }
            frameIndex++;
        } catch {
            // No more frames
            break;
        }
    }

    // Clean up input file
    await ff.deleteFile(inputFilename);

    return frames;
}

/**
 * Extract a single frame at a specific timestamp
 * @param videoData - Video file as Uint8Array or File
 * @param timestampMs - Timestamp in milliseconds
 * @returns Frame data as Uint8Array
 */
export async function extractFrameAt(
    videoData: Uint8Array | File,
    timestampMs: number,
    inputFilename: string = 'input.mp4'
): Promise<Uint8Array> {
    const ff = await loadFFmpeg();

    // Convert File to Uint8Array if needed
    let videoBytes: Uint8Array;
    if (videoData instanceof File) {
        videoBytes = new Uint8Array(await videoData.arrayBuffer());
    } else {
        videoBytes = videoData;
    }

    await ff.writeFile(inputFilename, videoBytes);

    // Convert milliseconds to seconds for FFmpeg
    const timeSeconds = timestampMs / 1000;

    // Extract single frame
    await ff.exec([
        '-ss', timeSeconds.toString(),
        '-i', inputFilename,
        '-frames:v', '1',
        '-q:v', '2',
        'output_frame.png'
    ]);

    const frameData = await ff.readFile('output_frame.png');

    // Clean up
    await ff.deleteFile(inputFilename);
    await ff.deleteFile('output_frame.png');

    if (!(frameData instanceof Uint8Array)) {
        throw new Error('Failed to extract frame');
    }

    return frameData;
}
