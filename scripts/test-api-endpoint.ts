
import fs from 'fs';
import path from 'path';

async function testApi() {
    const videoPath = path.join(process.cwd(), 'test-video.mp4');

    if (!fs.existsSync(videoPath)) {
        console.error('Test video not found at:', videoPath);
        return;
    }

    console.log('Reading video file...');
    const videoBuffer = fs.readFileSync(videoPath);
    const blob = new Blob([videoBuffer], { type: 'video/mp4' }); // Node 18+ Blob

    const formData = new FormData();
    formData.append('video', blob, 'test-video.mp4');

    console.log('Sending request to http://localhost:3000/api/analyze...');
    try {
        const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            const text = await response.text();
            console.error('Body:', text);
            return;
        }

        const data = await response.json();
        console.log('Success!');
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Fetch failed:', error);
    }
}

testApi();
