
import fs from 'fs';
import path from 'path';

async function testClone() {
    console.log('Starting Clone Test...');

    const competitorPath = path.join(process.cwd(), 'test-video.mp4');
    const userPath = path.join(process.cwd(), 'test-video.mp4'); // Use same video for user video for now

    // Ensure test videos exist
    if (!fs.existsSync(competitorPath)) {
        console.error('test-video.mp4 missing. Please provide it.');
        return;
    }

    const formData = new FormData();
    // Load files
    const compBlob = new Blob([fs.readFileSync(competitorPath)], { type: 'video/mp4' });
    const userBlob = new Blob([fs.readFileSync(userPath)], { type: 'video/mp4' });

    formData.append('competitorVideo', compBlob, 'competitor.mp4');
    formData.append('userVideo', userBlob, 'user.mp4');
    formData.append('topic', 'Coding is fun');

    console.log('Sending request to /api/clone...');
    const startTime = Date.now();

    try {
        const res = await fetch('http://localhost:3000/api/clone', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            console.error('Clone Failed:', res.status, await res.text());
            return;
        }

        console.log('Response received!');
        console.log('Variations Header:', res.headers.get('X-Variations')); // Log for accuracy check

        const buffer = await res.arrayBuffer();

        fs.writeFileSync('clone-output.mp4', Buffer.from(buffer));
        console.log(`Success! Saved to clone-output.mp4 (${buffer.byteLength} bytes)`);
        console.log(`Total time: ${(Date.now() - startTime) / 1000}s`);

    } catch (e) {
        console.error('Error:', e);
    }
}

testClone();
