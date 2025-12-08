import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith('video/')) {
            return NextResponse.json(
                { error: 'File must be a video' },
                { status: 400 }
            );
        }

        // Use /tmp directory (cross-platform via os.tmpdir())
        const uploadsDir = path.join(os.tmpdir(), 'viral-replica-uploads');
        await mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${timestamp}-${sanitizedName}`;
        const filepath = path.join(uploadsDir, filename);

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        return NextResponse.json({
            success: true,
            filename,
            filepath,
            size: file.size,
            type: file.type,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}
