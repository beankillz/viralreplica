
import { DesignSchema, ScriptSegment, TextOverlay } from '../../types/video-processing';

export const overlayMapper = {
    mapSegmentsToOverlays(
        segments: ScriptSegment[],
        defaultSchema: DesignSchema
    ): TextOverlay[] {
        return segments.map(seg => {
            // Smart center-based positioning based on role
            // Competitor's bounding box doesn't apply to user's video
            let position = { x: 50, y: 50 }; // Default: center

            // Role-based smart positioning
            if (seg.role) {
                switch (seg.role.toLowerCase()) {
                    case 'hook':
                        position = { x: 50, y: 20 }; // Top-center
                        break;
                    case 'cta':
                        position = { x: 50, y: 80 }; // Bottom-center
                        break;
                    case 'body':
                    default:
                        position = { x: 50, y: 50 }; // Center
                        break;
                }
            }

            // Merge dominant style with specific segment style
            const styleToUse = seg.style || defaultSchema;

            // Use safe, visible font size
            // Default to 48px (good visibility), or respect manual override
            let fontSize = styleToUse.fontSize || '48px';

            return {
                text: seg.text,
                startTime: seg.startTime,
                endTime: seg.endTime,
                style: {
                    fontSize: fontSize,
                    color: styleToUse.textColor || '#FFFFFF',
                    background: styleToUse.backgroundColor || 'rgba(0,0,0,0.7)',
                    position: position,
                    alignment: styleToUse.textAlignment || 'center',
                    fontWeight: String(styleToUse.fontWeight || '700'),
                    fontFamily: styleToUse.fontFamily || 'Inter',
                    width: styleToUse.width,
                    height: styleToUse.height,
                    letterSpacing: styleToUse.letterSpacing,
                    textTransform: styleToUse.textTransform
                },
                motionPath: seg.motionPath
            };
        });
    }
};
