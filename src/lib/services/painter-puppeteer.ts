
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { TextOverlay } from '../../types/video-processing';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export class PainterService {

    private async getBrowser() {
        // Determine environment
        const isLocal = !process.env.AWS_LAMBDA_FUNCTION_VERSION;

        // Local Chrome paths (Windows & Linux)
        const localChromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
            '/run/current-system/sw/bin/chromium', // NixOS/Nixpacks default
            process.env.CHROME_EXECUTABLE_PATH // allow override
        ];

        let executablePath = isLocal
            ? localChromePaths.find(p => p && require('fs').existsSync(p))
            : await chromium.executablePath();

        if (isLocal && !executablePath) {
            throw new Error('Local Chrome not found. Please install Chrome or set CHROME_EXECUTABLE_PATH.');
        }

        return await puppeteer.launch({
            args: isLocal ? puppeteer.defaultArgs() : [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
            defaultViewport: (chromium as any).defaultViewport,
            executablePath: executablePath as string,
            headless: (chromium as any).headless,
        });
    }

    private generateHtml(overlays: TextOverlay[], width: number, height: number): string {
        // Generate CSS keyframes for animated overlays
        const keyframesCSS = overlays
            .filter(o => (o as any).motionPath) // Filter overlays with motion
            .map((o, idx) => {
                const motionPath = (o as any).motionPath;
                if (!motionPath || !motionPath.keyframes || motionPath.keyframes.length < 2) return '';

                const keyframeSteps = motionPath.keyframes.map((kf: any, i: number) => {
                    const percentage = (kf.time / motionPath.duration) * 100;
                    return `${percentage.toFixed(2)}% { left: ${kf.x}%; top: ${kf.y}%; }`;
                }).join('\n                ');

                return `
                @keyframes motion-${idx} {
                    ${keyframeSteps}
                }`;
            }).join('\n');

        const overlayDivs = overlays.map((o, idx) => {
            const motionPath = (o as any).motionPath;
            const hasMotion = motionPath && motionPath.keyframes && motionPath.keyframes.length >= 2;

            // Base style
            let style = `
                position: absolute;
                ${hasMotion ? '' : `left: ${o.style.position.x}%; top: ${o.style.position.y}%;`}
                transform: translate(-50%, -50%);
                font-size: ${o.style.fontSize};
                color: ${o.style.color};
                background-color: ${o.style.background};
                padding: 0.5em 1em;
                border-radius: 12px;
                font-family: ${(o.style as any).fontFamily || 'Inter'}, sans-serif;
                font-weight: ${o.style.fontWeight};
                white-space: pre-wrap;
                text-align: ${o.style.alignment};
                letter-spacing: ${o.style.letterSpacing || 'normal'};
                text-transform: ${o.style.textTransform || 'none'};
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                ${o.style.width ? `width: ${o.style.width};` : 'max-width: 80%;'}
                ${o.style.height ? `height: ${o.style.height};` : ''}
            `;

            // Add animation if motion path exists
            if (hasMotion) {
                const startKf = motionPath.keyframes[0];
                style += `
                left: ${startKf.x}%;
                top: ${startKf.y}%;
                animation: motion-${idx} ${motionPath.duration}ms ${motionPath.easing} forwards;
                `;
            }

            return `<div style="${style}">${o.text}</div>`;
        }).join('\n');

        // Collect unique fonts from overlays
        const fonts = new Set<string>();
        overlays.forEach(o => {
            const fontFamily = (o.style as any).fontFamily || 'Inter';
            fonts.add(fontFamily);
        });

        // Generate Google Fonts import URL
        const fontImports = Array.from(fonts)
            .map(f => f.replace(/\s+/g, '+'))
            .join('&family=');
        const fontsUrl = `https://fonts.googleapis.com/css2?family=${fontImports}:wght@300;400;500;600;700;900&display=swap`;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @import url('${fontsUrl}');
                    body {
                        margin: 0;
                        padding: 0;
                        width: ${width}px;
                        height: ${height}px;
                        background: transparent;
                        overflow: hidden;
                    }
                    ${keyframesCSS}
                </style>
            </head>
            <body>
                ${overlayDivs}
            </body>
            </html>
        `;
    }

    async renderVideo(videoPath: string, overlays: TextOverlay[]): Promise<Buffer> {
        const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'painter-'));
        const overlayImagePath = path.join(workDir, 'overlay.png');
        const outputPath = path.join(workDir, 'output.mp4');

        try {
            // 1. Get Video Metadata (Resolution)
            const metadata = await new Promise<any>((resolve, reject) => {
                ffmpeg.ffprobe(videoPath, (err, data) => err ? reject(err) : resolve(data));
            });
            const width = metadata.streams[0].width || 1080;
            const height = metadata.streams[0].height || 1920;

            // 2. Generate HTML
            // Note: For simplicity in this v1, we generate ONE static overlay image 
            // containing ALL text that appears. 
            // Limitation: This assumes all text appears at once or we don't handle timing "visually" in the HTML.
            // Wait, the overlays have `startTime` and `endTime`.
            // If we use ONE static image, the text will be visible for the whole video if we just overlay it.
            // We need to handle timing.
            // Optimization: Filter overlays that are "current" or group them?
            // Actually, the PainterService usually renders the *final* video.
            // For a complex video where text pops in/out, we might need multiple overlay images or 
            // simply render the *static* style if the user just wants "the pattern" applied to one text.
            // 
            // Current 'Eye' logic detected multiple text blocks.
            // The Viral Replica usually clones ONE visual style.
            // Let's assume for this "Painter" v1 we create ONE overlay image for the detected text
            // effectively creating a "Replica" of the *frame* style.
            // 
            // BUT the user input has timing. `overlays` array has startTime/endTime.
            // To do this correctly with FFmpeg and ONE image, we can't if they have different timings.
            // We would need multiple images or complex filters.
            // 
            // Alternative: Generate ONE image per unique Overlay Item, and apply them as separate inputs.
            // Or better: Use Puppeteer to screenshot *each unique text state*? Too slow.
            // 
            // Simplification: We will generate ONE image for EACH overlay item locally, 
            // and use FFmpeg to overlay them at their specific times.

            const browser = await this.getBrowser();
            const page = await browser.newPage();
            await page.setViewport({ width, height });

            const imagePaths: { path: string, start: number, end: number }[] = [];

            for (let i = 0; i < overlays.length; i++) {
                const o = overlays[i];
                const html = this.generateHtml([o], width, height); // Generate page with JUST this one overlay
                await page.setContent(html);
                const imgPath = path.join(workDir, `overlay_${i}.png`);
                await page.screenshot({ path: imgPath, omitBackground: true });
                imagePaths.push({ path: imgPath, start: o.startTime, end: o.endTime });
            }

            await browser.close();

            // 3. FFmpeg Composite
            return await new Promise<Buffer>((resolve, reject) => {
                let cmd = ffmpeg(videoPath);

                // Add all overlay images as inputs
                imagePaths.forEach(img => {
                    cmd = cmd.input(img.path);
                });

                // Build complex filter
                // [0:v][1:v] overlay=0:0:enable='between(t,s,e)' [tmp1]; [tmp1][2:v] ...
                const filterComplex: string[] = [];
                let lastOutput = '0:v';

                imagePaths.forEach((img, index) => {
                    const inputIdx = index + 1; // 0 is video
                    const outputName = index === imagePaths.length - 1 ? 'out' : `tmp${index}`;
                    const startSec = img.start / 1000;
                    const endSec = img.end / 1000;

                    filterComplex.push(
                        `[${lastOutput}][${inputIdx}:v] overlay=0:0:enable='between(t,${startSec},${endSec})' [${outputName}]`
                    );
                    lastOutput = outputName;
                });

                if (imagePaths.length > 0) {
                    cmd = cmd.complexFilter(filterComplex.map(f => f.replace('[out]', '')).join(';'));
                }

                cmd
                    .outputOptions([
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-pix_fmt', 'yuv420p', // Ensure compatibility
                        '-movflags', '+faststart'
                    ])
                    .output(outputPath)
                    .on('end', async () => {
                        const buf = await fs.readFile(outputPath);
                        resolve(buf);
                    })
                    .on('error', (err) => reject(err))
                    .run();
            });

        } finally {
            // Cleanup workDir
            try {
                //  await fs.rm(workDir, { recursive: true, force: true });
            } catch (e) { }
        }
    }
}

export const painterService = new PainterService();
