import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import sharp from 'sharp';

function getGroqClient() {
    return new Groq({
        apiKey: process.env.GROQ_API_KEY,
    });
}

interface TextDetection {
    text: string;
    boundingBox: {
        x: number;      // Left position (0-100 percentage)
        y: number;      // Top position (0-100 percentage)
        width: number;  // Width (0-100 percentage)
        height: number; // Height (0-100 percentage)
    };
    confidence: number;
}

interface FrameOCRResult {
    frameIndex: number;
    timestamp?: number;
    detections: TextDetection[];
    error?: string;
}

const VISION_MODEL = 'llama-3.2-90b-vision-preview';

const OCR_PROMPT = `Analyze this image and extract all visible text. For each piece of text found, provide:
1. The exact text content
2. The bounding box position as percentages (0-100) of the image dimensions
3. Your confidence level (0-1)

Return your response as valid JSON in this exact format:
{
  "detections": [
    {
      "text": "extracted text here",
      "boundingBox": {
        "x": 10,
        "y": 20,
        "width": 30,
        "height": 5
      },
      "confidence": 0.95
    }
  ]
}

If no text is visible, return: {"detections": []}

Important: Return ONLY the JSON, no additional text or markdown.`;

// Resize image to reduce size for Groq API (max 4MB, but we'll aim for ~500KB)
async function resizeFrameForOCR(base64Image: string): Promise<string> {
    try {
        // Remove data URL prefix
        const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(imageData, 'base64');

        console.log(`Original image size: ${buffer.length} bytes`);

        // Resize to max 800px width while maintaining aspect ratio
        // Also convert to JPEG with quality 80 for smaller size
        const resizedBuffer = await sharp(buffer)
            .resize(800, null, {
                withoutEnlargement: true,
                fit: 'inside'
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        console.log(`Resized image size: ${resizedBuffer.length} bytes`);

        return resizedBuffer.toString('base64');
    } catch (error) {
        console.error('Error resizing image:', error);
        // Return original if resize fails
        return base64Image.replace(/^data:image\/\w+;base64,/, '');
    }
}

async function processFrameWithVision(base64Image: string, frameIndex: number): Promise<FrameOCRResult> {
    try {
        // Resize image for OCR
        const resizedImageData = await resizeFrameForOCR(base64Image);

        const response = await getGroqClient().chat.completions.create({
            model: VISION_MODEL,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: OCR_PROMPT,
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${resizedImageData}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 1024,
        });

        const content = response.choices[0]?.message?.content || '{"detections": []}';

        // Parse JSON response - handle potential markdown code blocks
        let jsonContent = content.trim();
        if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        const parsed = JSON.parse(jsonContent);

        return {
            frameIndex,
            detections: parsed.detections || [],
        };
    } catch (error) {
        console.error(`Vision model error for frame ${frameIndex}:`, error);

        // Return empty detections with error note
        return {
            frameIndex,
            detections: [],
            error: `Vision processing failed: ${String(error)}`,
        };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { frames } = body as { frames: Array<{ base64: string; timestamp?: number }> };

        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            return NextResponse.json(
                { error: 'No frames provided. Expected { frames: [{ base64: string, timestamp?: number }] }' },
                { status: 400 }
            );
        }

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json(
                { error: 'GROQ_API_KEY not configured' },
                { status: 500 }
            );
        }

        // Process frames one at a time to avoid rate limits
        // Groq vision has 30 req/min limit
        const results: FrameOCRResult[] = [];

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            console.log(`Processing frame ${i + 1}/${frames.length}...`);

            const result = await processFrameWithVision(frame.base64, i);
            results.push({
                ...result,
                timestamp: frame.timestamp,
            });

            // Small delay between requests to avoid rate limiting
            if (i < frames.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // Aggregate all unique text detections across frames
        const allDetections = results.flatMap(r =>
            r.detections.map(d => ({
                ...d,
                frameIndex: r.frameIndex,
                timestamp: r.timestamp,
            }))
        );

        return NextResponse.json({
            success: true,
            frameCount: frames.length,
            results,
            summary: {
                totalDetections: allDetections.length,
                framesWithText: results.filter(r => r.detections.length > 0).length,
                framesWithErrors: results.filter(r => r.error).length,
            },
        });
    } catch (error) {
        console.error('OCR processing error:', error);
        return NextResponse.json(
            { error: 'Failed to process frames', details: String(error) },
            { status: 500 }
        );
    }
}
