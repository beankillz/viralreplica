export interface BoundingBox {
    x: number;      // 0-100
    y: number;      // 0-100
    width: number;  // 0-100
    height: number; // 0-100
}

// --- Phase 1: High-Fidelity Vision (Qwen VL) ---

export interface RawTextDetection {
    text: string;
    frameIndex: number;
    boundingBox: BoundingBox;
    confidence: number;
    language?: string;
}

export interface RawFrameAnalysis {
    frameIndex: number;
    timestamp: number;
    detections: RawTextDetection[];
    // Base visual inference from Vision model
    visuals: {
        typography: {
            fontFamily?: string;
            fontSize?: number; // relative scale 0-100
            fontWeight?: string | number;
            lineHeight?: number;
            letterSpacing?: number;
        };
        styling: {
            textColor?: string;
            strokeColor?: string;
            strokeWidth?: number;
            shadow?: {
                x: number;
                y: number;
                blur: number;
                opacity: number;
            };
            opacity?: number;
        };
    };
}

// --- Phase 2: Temporal Aggregation (Code) ---

// --- Motion Tracking ---

export interface MotionKeyframe {
    time: number;  // relative milliseconds from start of segment
    x: number;     // 0-100
    y: number;     // 0-100
}

export interface MotionPath {
    keyframes: MotionKeyframe[];
    type: 'STATIC' | 'LINEAR' | 'EASE_IN' | 'EASE_OUT' | 'POP_IN';
    variance: number; // Low variance = smooth motion, High = jittery
}

export interface ConsolidatedTextInstance {
    id: string;
    text: string;
    startFrame: number;
    endFrame: number;
    startTime: number;
    endTime: number;
    duration: number;
    // Averaged/Consensus values from multiple frames
    boundingBox: BoundingBox;
    motionPath?: MotionPath; // New field for motion tracking
    visuals: RawFrameAnalysis['visuals'];
    detectionConfidence: number;
}

// --- Phase 3: Structural Intelligence (Groq) ---

export type TextRole = 'HOOK' | 'BODY' | 'CTA';

export interface LayoutLogic {
    anchor: 'top' | 'center' | 'bottom';
    alignment: 'left' | 'center' | 'right';
    padding: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    margin: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    zIndex: number;
}

export interface EnrichedOverlay extends ConsolidatedTextInstance {
    role: TextRole;
    layout: LayoutLogic;
}

export interface DesignSystem {
    fonts: {
        primary: string;
        secondary?: string;
    };
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    spacing: {
        base: number;
        scale: number[];
    };
    timing: {
        avgDurationPerWord: number;
        minDuration: number;
    };
}

// --- Combined Result ---

export interface PipelineResult {
    projectId: string;
    overlays: EnrichedOverlay[];
    designSystem: DesignSystem;
    variations?: {
        segmentId: string;
        variations: string[];
    }[];
}
