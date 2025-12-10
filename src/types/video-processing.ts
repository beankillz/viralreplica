export interface Frame {
    timestamp: number; // in milliseconds
    base64: string;    // data:image/png;base64,...
    path?: string;     // path to temporary file if saved to disk
}

export interface TextOverlay {
    text: string;
    startTime: number;
    endTime: number;
    style: {
        fontSize: string;
        color: string;
        background: string;
        position: { x: number; y: number };
        alignment: string;
        fontWeight: string;
    };
}

export interface ExtractionOptions {
    fps?: number;           // Frames per second to extract
    maxFrames?: number;     // Max frames to prevent memory overflow
    format?: 'png' | 'jpg'; // Output format
    quality?: number;       // JPEG quality (1-100) if format is jpg
}

export interface BoundingBox {
    x: number;      // Left position (0-100 percentage)
    y: number;      // Top position (0-100 percentage)
    width: number;  // Width (0-100 percentage)
    height: number; // Height (0-100 percentage)
}

export interface TextDetection {
    text: string;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence: number;
}

export interface DesignSchema {
    backgroundColor: string; // hex code
    borderRadius: string;    // e.g. "10px"
    padding: string;         // e.g. "16px"
    fontFamily: string;      // e.g. "Inter", "Arial"
    textAlignment: 'left' | 'center' | 'right';
    textColor: string;       // hex code
    icons: string[];         // description of icons found
}

export interface VisionResult {
    frameIndex: number;
    timestamp?: number;
    detections: TextDetection[];
    design?: DesignSchema;
    error?: string;
    rawResponse?: unknown;
}

export interface ScriptSegment {
    role: 'hook' | 'body' | 'cta' | 'unknown';
    text: string;
    originalText: string;
    startTime: number;
    endTime: number;
    // New fields for accuracy
    style?: DesignSchema;
    boundingBox?: BoundingBox;
    motionPath?: MotionPath; // For animated text
}

export interface ScriptVariation {
    name: string;
    segments: ScriptSegment[];
}

export interface MotionKeyframe {
    time: number;      // milliseconds
    x: number;         // percentage (0-100)
    y: number;         // percentage (0-100)
}

export interface MotionPath {
    keyframes: MotionKeyframe[];
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    duration: number;  // milliseconds
}
