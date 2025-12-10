import fs from 'fs';
import path from 'path';
import { VisionResult } from '../src/types/video-processing';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}
console.log('Env loaded. GROQ_KEY present:', !!process.env.GROQ_API_KEY);

async function testBrain() {
    // Dynamic import to ensure env is set
    const { variationService } = await import('../src/lib/services/variation');

    console.log('Testing Brain (VariationService)...');

    // Mock Vision Results (Simulate what the Eye would see)
    const mockVisionResults: VisionResult[] = [
        {
            frameIndex: 0,
            timestamp: 0,
            detections: [{ text: "Stop scrolling!", confidence: 0.9, boundingBox: { x: 0, y: 0, width: 0, height: 0 } }]
        },
        {
            frameIndex: 1,
            timestamp: 1000,
            detections: [{ text: "Here is a secret hack.", confidence: 0.9, boundingBox: { x: 0, y: 0, width: 0, height: 0 } }]
        },
        {
            frameIndex: 2,
            timestamp: 2000,
            detections: [{ text: "Follow for more.", confidence: 0.9, boundingBox: { x: 0, y: 0, width: 0, height: 0 } }]
        }
    ];

    try {
        const topic = "Healthy Eating";
        console.log(`Generating variations for topic: "${topic}"...`);

        const variations = await variationService.generateVariations(mockVisionResults, topic);

        console.log('Variations generated:', variations.length);
        console.log(JSON.stringify(variations, null, 2));

        if (variations.length > 0 && variations[0].name !== "Original (Fallback)") {
            console.log('SUCCESS: Groq generated new variations.');
        } else {
            console.log('WARNING: Fallback used (or empty). Check Groq key/response.');
        }

    } catch (e) {
        console.error('Brain Validation Failed:', e);
    }
}

testBrain();
