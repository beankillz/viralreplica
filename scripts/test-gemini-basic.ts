import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
    console.log('Listing Available Models...');
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('No API Key');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Obfuscated way to get model list as it's not directly exposed in the main class helper sometimes, 
        // but let's try assuming the user has access to standard endpoints.
        // Actually, the error message suggested calling ListModels.
        // The SDK doesn't have a direct `listModels` on genAI instance in some versions, 
        // but usually we can try to guess or just use a known older model like 'gemini-pro' to see if that works.

        // Let's try to just hit a known older model first as a fallback check
        const fallbackModel = "gemini-pro";
        console.log(`Trying fallback model: ${fallbackModel}`);
        const model = genAI.getGenerativeModel({ model: fallbackModel });
        const result = await model.generateContent("Hello?");
        console.log(`✅ ${fallbackModel} worked!`);

    } catch (e: any) {
        console.error('❌ Fallback failed:', e.message);
    }
}

test();
