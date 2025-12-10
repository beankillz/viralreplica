
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load env manually
import fs from 'fs';
// dotenv = { config: () => { } }; // Mock

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

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error('No API key found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName: string) {
    console.log(`Testing model: ${modelName}`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Hello, are you working?');
        const response = await result.response;
        console.log(`[SUCCESS] ${modelName}:`, response.text());
        return true;
    } catch (error) {
        console.error(`[FAILED] ${modelName}:`, (error as any).message);
        return false;
    }
}

async function run() {
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-pro-vision', // Legacy
        'models/gemini-1.5-flash'
    ];

    for (const m of models) {
        await testModel(m);
    }
}

run();
