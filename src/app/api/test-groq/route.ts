import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function GET() {
    try {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'GROQ_API_KEY not set',
            });
        }

        console.log('Testing Groq with API key:', apiKey.substring(0, 10) + '...');

        const groq = new Groq({ apiKey });

        // Test with a simple text request first
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'user', content: 'Say "hello" in one word.' }
            ],
            max_tokens: 10,
        });

        const content = response.choices[0]?.message?.content;

        return NextResponse.json({
            success: true,
            message: 'Groq API working!',
            response: content,
            apiKeyPrefix: apiKey.substring(0, 15) + '...',
        });
    } catch (error) {
        console.error('Groq test error:', error);
        return NextResponse.json({
            success: false,
            error: String(error),
            errorDetails: error instanceof Error ? {
                name: error.name,
                message: error.message,
            } : null,
        });
    }
}
