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
        width?: string;
        height?: string;
        letterSpacing?: string;
        textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
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
    // Text Properties
    fontFamily: string;      // e.g. "Inter", "Arial"
    fontSize?: string;       // e.g. "40px", "2rem"
    fontWeight?: string | number; // e.g. "bold", 700
    fontStyle?: 'normal' | 'italic';
    textColor: string;       // hex code
    lineHeight?: string;     // e.g. "1.5", "24px"
    letterSpacing?: string;  // e.g. "2px", "0.05em"
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    textAlignment: 'left' | 'center' | 'right';

    // Container Properties
    backgroundColor: string; // hex code
    borderRadius: string;    // e.g. "10px"
    padding: string | {      // Simplified or detailed
        top: string;
        right: string;
        bottom: string;
        left: string;
    };
    margin?: string | {
        top: string;
        right: string;
        bottom: string;
        left: string;
    };

    // Dimensions
    width?: string;          // e.g. "auto", "300px", "80%"
    height?: string;         // e.g. "auto", "100px"

    // Effects
    boxShadow?: string;      // e.g. "0 4px 6px rgba(0,0,0,0.1)"
    textShadow?: string;     // e.g. "2px 2px 4px rgba(0,0,0,0.5)"

    // Icons
    icons: Array<{
        description: string;
        enabled?: boolean;
        url?: string;
    }> | string[];           // Support both formats for backward compatibility

    // Position (percentage-based for responsive rendering)
    position?: {
        x: number;           // 0-100
        y: number;           // 0-100
    };
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

// New interfaces for inline editing system
export interface EditableProject {
    id: string;
    createdAt: number;
    competitorVideoName: string;
    userVideoName: string;
    userVideoUrl: string;
    topic: string;
    visionResults: VisionResult[];
    variations: ScriptVariation[];
    selectedVariationIndex: number;
    designSchema: DesignSchema;
    outputVideoUrl?: string;
    userVideoFile?: File; // For re-rendering
}

export interface TextOverlayEditable extends TextOverlay {
    id: string;
    schema?: DesignSchema;
}

