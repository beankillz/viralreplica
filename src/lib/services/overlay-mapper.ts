
import { DesignSchema, ScriptSegment, TextOverlay } from '../../types/video-processing';

export const overlayMapper = {
    mapSegmentsToOverlays(
        segments: ScriptSegment[],
        defaultSchema: DesignSchema
    ): TextOverlay[] {
        return segments.map(seg => {
            // Calculate center from bounding box if available
            let position = { x: 50, y: 50 }; // Default center
            if (seg.boundingBox) {
                position = {
                    x: seg.boundingBox.x + (seg.boundingBox.width / 2),
                    y: seg.boundingBox.y + (seg.boundingBox.height / 2)
                };
            }

            // Merge dominant style with specific segment style
            const styleToUse = seg.style || defaultSchema;

            // Heuristic for font size: 80% of bounding box height in vh, or default 40px
            // If the user has manually set a font size in the schema, we might want to respect it.
            // But for now, let's keep the bounding box logic as the default "smart" sizing 
            // unless we add specific "manual override" flags later. 
            // Actually, if 'fontSize' is present in styleToUse, we should probably prefer it if it looks like a manual setting.
            // For now, I'll stick to the original logic but check if styleToUse has a specific override.

            let fontSize = styleToUse.fontSize || '40px';
            if (!styleToUse.fontSize && seg.boundingBox) {
                fontSize = `${seg.boundingBox.height * 0.8}vh`;
            }

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
