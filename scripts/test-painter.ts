
import { painterService } from '../src/lib/services/painter-puppeteer';
import { TextOverlay } from '../src/types/video-processing';
import path from 'path';
import fs from 'fs';

async function testPainter() {
    const videoPath = path.join(process.cwd(), 'test-video.mp4');
    if (!fs.existsSync(videoPath)) {
        console.error('test-video.mp4 not found');
        return;
    }

    const overlays: TextOverlay[] = [
        {
            text: "TEST OVERLAY\nWith Shadow & Rounded Corners",
            startTime: 0,
            endTime: 5000,
            style: {
                fontSize: "60px",
                color: "#FFFFFF",
                background: "#FF0000",
                position: { x: 50, y: 50 },
                alignment: "center",
                fontWeight: "900"
            }
        },
        {
            text: "Second Overlay",
            startTime: 2000,
            endTime: 4000,
            style: {
                fontSize: "40px",
                color: "#000000",
                background: "#00FF00",
                position: { x: 50, y: 80 },
                alignment: "center",
                fontWeight: "bold"
            }
        }
    ];

    console.log('Rendering video...');
    const start = Date.now();
    try {
        const buffer = await painterService.renderVideo(videoPath, overlays);
        console.log(`Render complete in ${(Date.now() - start) / 1000}s`);

        fs.writeFileSync('test-output.mp4', buffer);
        console.log('Saved to test-output.mp4');
    } catch (e) {
        console.error('Render failed:', e);
    }
}

testPainter();
