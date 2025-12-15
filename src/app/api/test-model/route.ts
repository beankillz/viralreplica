import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'OPENROUTER_API_KEY not set',
            });
        }

        console.log('Testing Model (OpenRouter) with API key:', apiKey.substring(0, 10) + '...');

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Viral Replica Test'
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-nano-12b-v2-vl:free', // Using the user-requested model
                messages: [
                    { role: 'user', content: 'Say "hello" in one word.' }
                ],
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        return NextResponse.json({
            success: true,
            message: 'Model (OpenRouter) API working!',
            response: content,
            model: data.model
        });

    } catch (error) {
        console.error('Model test error:', error);
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
