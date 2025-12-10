import { VisionResult, MotionPath, MotionKeyframe } from '../../types/video-processing';

/**
 * MotionTrackerService
 * Tracks text movement across frames using position deltas
 */
export class MotionTrackerService {

    /**
     * Track text motion across frames
     * Groups similar text blocks and calculates their movement paths
     */
    async trackTextMotion(visionResults: VisionResult[]): Promise<Map<string, MotionPath>> {
        const motionPaths = new Map<string, MotionPath>();

        // Group detections by text similarity
        const textGroups = this.groupSimilarText(visionResults);

        // Calculate motion path for each group
        for (const [text, detections] of textGroups.entries()) {
            if (detections.length < 2) {
                // Static text - no motion
                continue;
            }

            const motionPath = this.calculateMotionPath(detections);
            if (motionPath) {
                motionPaths.set(text, motionPath);
            }
        }

        return motionPaths;
    }

    /**
     * Group similar text across frames
     */
    private groupSimilarText(visionResults: VisionResult[]): Map<string, Array<{
        text: string;
        timestamp: number;
        x: number;
        y: number;
    }>> {
        const groups = new Map<string, Array<any>>();

        for (const frame of visionResults) {
            if (!frame.detections || frame.detections.length === 0) continue;

            for (const detection of frame.detections) {
                const normalizedText = this.normalizeText(detection.text);

                // Find matching group or create new one
                let matchedKey: string | null = null;
                for (const key of groups.keys()) {
                    if (this.textSimilarity(key, normalizedText) > 0.8) {
                        matchedKey = key;
                        break;
                    }
                }

                const groupKey = matchedKey || normalizedText;
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, []);
                }

                groups.get(groupKey)!.push({
                    text: detection.text,
                    timestamp: frame.timestamp || 0,
                    x: detection.boundingBox.x + (detection.boundingBox.width / 2), // Center X
                    y: detection.boundingBox.y + (detection.boundingBox.height / 2) // Center Y
                });
            }
        }

        return groups;
    }

    /**
     * Calculate motion path from detections
     */
    private calculateMotionPath(detections: Array<{
        text: string;
        timestamp: number;
        x: number;
        y: number;
    }>): MotionPath | null {
        if (detections.length < 2) return null;

        // Sort by timestamp
        detections.sort((a, b) => a.timestamp - b.timestamp);

        // Calculate total displacement
        const startPos = detections[0];
        const endPos = detections[detections.length - 1];
        const totalDisplacement = Math.sqrt(
            Math.pow(endPos.x - startPos.x, 2) +
            Math.pow(endPos.y - startPos.y, 2)
        );

        // If displacement is too small, consider it static
        if (totalDisplacement < 5) { // Less than 5% movement
            return null;
        }

        // Create keyframes
        const keyframes: MotionKeyframe[] = detections.map(d => ({
            time: d.timestamp,
            x: d.x,
            y: d.y
        }));

        // Determine easing based on velocity profile
        const easing = this.determineEasing(keyframes);

        return {
            keyframes,
            easing,
            duration: endPos.timestamp - startPos.timestamp
        };
    }

    /**
     * Determine easing function based on velocity changes
     */
    private determineEasing(keyframes: MotionKeyframe[]): 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' {
        if (keyframes.length < 3) return 'linear';

        // Calculate velocities
        const velocities: number[] = [];
        for (let i = 1; i < keyframes.length; i++) {
            const dt = keyframes[i].time - keyframes[i - 1].time;
            const dx = keyframes[i].x - keyframes[i - 1].x;
            const dy = keyframes[i].y - keyframes[i - 1].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            velocities.push(distance / dt);
        }

        // Analyze velocity profile
        const firstHalfAvg = velocities.slice(0, Math.floor(velocities.length / 2))
            .reduce((a, b) => a + b, 0) / Math.floor(velocities.length / 2);
        const secondHalfAvg = velocities.slice(Math.floor(velocities.length / 2))
            .reduce((a, b) => a + b, 0) / (velocities.length - Math.floor(velocities.length / 2));

        if (firstHalfAvg < secondHalfAvg * 0.7) return 'ease-in';
        if (secondHalfAvg < firstHalfAvg * 0.7) return 'ease-out';
        if (Math.abs(firstHalfAvg - secondHalfAvg) < firstHalfAvg * 0.3) return 'linear';

        return 'ease-in-out';
    }

    /**
     * Normalize text for comparison
     */
    private normalizeText(text: string): string {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * Calculate text similarity (0-1)
     */
    private textSimilarity(a: string, b: string): number {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Levenshtein distance
     */
    private levenshteinDistance(a: string, b: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}

export const motionTrackerService = new MotionTrackerService();
