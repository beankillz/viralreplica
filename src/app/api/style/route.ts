import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

interface BoundingBox {
    x: number;      // percentage 0-100
    y: number;      // percentage 0-100
    width: number;  // percentage 0-100
    height: number; // percentage 0-100
}

interface TextDetection {
    text: string;
    boundingBox: BoundingBox;
    confidence?: number;
}

interface FrameData {
    base64: string;
    timestamp?: number;
    detections: TextDetection[];
}

interface TextStyle {
    fontSize: string;
    color: string;
    fontFamily: string;
    background: string;
    padding: string;
    alignment: 'left' | 'center' | 'right';
    fontWeight: 'normal' | 'bold';
    textTransform: 'none' | 'uppercase' | 'lowercase';
    position: {
        x: number;
        y: number;
    };
}

interface ColorSample {
    r: number;
    g: number;
    b: number;
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function getContrastColor(bgColor: ColorSample): string {
    // Calculate relative luminance
    const luminance = (0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function estimateFontSize(boundingBox: BoundingBox, imageHeight: number): string {
    // Estimate font size based on bounding box height
    const heightPx = (boundingBox.height / 100) * imageHeight;
    // Font size is roughly 70-80% of the bounding box height
    const fontSize = Math.round(heightPx * 0.75);
    return `${Math.max(12, Math.min(72, fontSize))}px`;
}

function estimateAlignment(boundingBox: BoundingBox): 'left' | 'center' | 'right' {
    const centerX = boundingBox.x + boundingBox.width / 2;
    if (centerX < 35) return 'left';
    if (centerX > 65) return 'right';
    return 'center';
}

function estimateFontWeight(text: string): 'normal' | 'bold' {
    // Heuristic: short text or ALL CAPS often indicates bold/emphasis
    if (text === text.toUpperCase() && text.length < 20) return 'bold';
    return 'normal';
}

function estimateTextTransform(text: string): 'none' | 'uppercase' | 'lowercase' {
    if (text === text.toUpperCase() && /[A-Z]/.test(text)) return 'uppercase';
    if (text === text.toLowerCase() && /[a-z]/.test(text)) return 'lowercase';
    return 'none';
}

async function sampleColorsFromRegion(
    imageBuffer: Buffer,
    boundingBox: BoundingBox
): Promise<{ textColor: string; backgroundColor: string }> {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            return { textColor: '#FFFFFF', backgroundColor: 'rgba(0, 0, 0, 0.7)' };
        }

        // Convert percentage to pixels
        const left = Math.floor((boundingBox.x / 100) * metadata.width);
        const top = Math.floor((boundingBox.y / 100) * metadata.height);
        const width = Math.max(1, Math.floor((boundingBox.width / 100) * metadata.width));
        const height = Math.max(1, Math.floor((boundingBox.height / 100) * metadata.height));

        // Extract the region with padding for background sampling
        const padX = Math.floor(width * 0.1);
        const padY = Math.floor(height * 0.2);

        // Sample background (area around the text)
        const bgLeft = Math.max(0, left - padX);
        const bgTop = Math.max(0, top - padY);
        const bgWidth = Math.min(width + padX * 2, metadata.width - bgLeft);
        const bgHeight = Math.min(height + padY * 2, metadata.height - bgTop);

        // Get average color of the region (background)
        const regionBuffer = await image
            .extract({ left: bgLeft, top: bgTop, width: bgWidth, height: bgHeight })
            .resize(1, 1, { fit: 'cover' })
            .raw()
            .toBuffer();

        const bgColor: ColorSample = {
            r: regionBuffer[0],
            g: regionBuffer[1],
            b: regionBuffer[2],
        };

        // Sample text region (center of bounding box)
        const textLeft = Math.max(0, left + Math.floor(width * 0.2));
        const textTop = Math.max(0, top + Math.floor(height * 0.3));
        const textWidth = Math.max(1, Math.floor(width * 0.6));
        const textHeight = Math.max(1, Math.floor(height * 0.4));

        const textBuffer = await image
            .extract({
                left: Math.min(textLeft, metadata.width - 1),
                top: Math.min(textTop, metadata.height - 1),
                width: Math.min(textWidth, metadata.width - textLeft),
                height: Math.min(textHeight, metadata.height - textTop)
            })
            .resize(1, 1, { fit: 'cover' })
            .raw()
            .toBuffer();

        const textSample: ColorSample = {
            r: textBuffer[0],
            g: textBuffer[1],
            b: textBuffer[2],
        };

        // Determine if there's a background box or just video
        const bgHex = rgbToHex(bgColor.r, bgColor.g, bgColor.b);
        const textHex = rgbToHex(textSample.r, textSample.g, textSample.b);

        // Check if background is relatively uniform (indicates a text overlay box)
        const bgLuminance = (0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b) / 255;

        // If background is dark, assume dark overlay; if light, assume light overlay
        let backgroundColor: string;
        if (bgLuminance < 0.3) {
            backgroundColor = `rgba(0, 0, 0, 0.7)`;
        } else if (bgLuminance > 0.7) {
            backgroundColor = `rgba(255, 255, 255, 0.8)`;
        } else {
            backgroundColor = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0.7)`;
        }

        // Text color: use contrast against detected background
        const textColor = getContrastColor(bgColor);

        return { textColor, backgroundColor };
    } catch (error) {
        console.error('Color sampling error:', error);
        return { textColor: '#FFFFFF', backgroundColor: 'rgba(0, 0, 0, 0.7)' };
    }
}

async function analyzeFrameStyle(frame: FrameData): Promise<TextStyle[]> {
    const styles: TextStyle[] = [];

    if (!frame.detections || frame.detections.length === 0) {
        return styles;
    }

    // Decode base64 image
    const base64Data = frame.base64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const imageHeight = metadata.height || 1080;

    for (const detection of frame.detections) {
        const { textColor, backgroundColor } = await sampleColorsFromRegion(
            imageBuffer,
            detection.boundingBox
        );

        const style: TextStyle = {
            fontSize: estimateFontSize(detection.boundingBox, imageHeight),
            color: textColor,
            fontFamily: 'Inter, system-ui, sans-serif', // Default modern font
            background: backgroundColor,
            padding: '8px 16px',
            alignment: estimateAlignment(detection.boundingBox),
            fontWeight: estimateFontWeight(detection.text),
            textTransform: estimateTextTransform(detection.text),
            position: {
                x: detection.boundingBox.x,
                y: detection.boundingBox.y,
            },
        };

        styles.push(style);
    }

    return styles;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { frames } = body as { frames: FrameData[] };

        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            return NextResponse.json(
                { error: 'No frames provided. Expected { frames: [{ base64, detections }] }' },
                { status: 400 }
            );
        }

        // Analyze styles from all frames
        const allStyles: Array<{
            frameIndex: number;
            timestamp?: number;
            styles: TextStyle[];
        }> = [];

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const styles = await analyzeFrameStyle(frame);
            allStyles.push({
                frameIndex: i,
                timestamp: frame.timestamp,
                styles,
            });
        }

        // Aggregate common style (most frequent values)
        const allFlatStyles = allStyles.flatMap(f => f.styles);

        // Calculate dominant style
        const dominantStyle: TextStyle = {
            fontSize: getMostFrequent(allFlatStyles.map(s => s.fontSize)) || '24px',
            color: getMostFrequent(allFlatStyles.map(s => s.color)) || '#FFFFFF',
            fontFamily: 'Inter, system-ui, sans-serif',
            background: getMostFrequent(allFlatStyles.map(s => s.background)) || 'rgba(0, 0, 0, 0.7)',
            padding: '8px 16px',
            alignment: getMostFrequent(allFlatStyles.map(s => s.alignment)) as 'left' | 'center' | 'right' || 'center',
            fontWeight: getMostFrequent(allFlatStyles.map(s => s.fontWeight)) as 'normal' | 'bold' || 'bold',
            textTransform: getMostFrequent(allFlatStyles.map(s => s.textTransform)) as 'none' | 'uppercase' | 'lowercase' || 'none',
            position: {
                x: average(allFlatStyles.map(s => s.position.x)),
                y: average(allFlatStyles.map(s => s.position.y)),
            },
        };

        return NextResponse.json({
            success: true,
            frameCount: frames.length,
            frameStyles: allStyles,
            dominantStyle,
        });
    } catch (error) {
        console.error('Style analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze styles', details: String(error) },
            { status: 500 }
        );
    }
}

function getMostFrequent<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    const counts = new Map<T, number>();
    for (const item of arr) {
        counts.set(item, (counts.get(item) || 0) + 1);
    }
    let maxCount = 0;
    let maxItem: T | undefined;
    for (const [item, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            maxItem = item;
        }
    }
    return maxItem;
}

function average(arr: number[]): number {
    if (arr.length === 0) return 50;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
