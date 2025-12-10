/**
 * Free Tier Configuration
 * Optimizes app for 512MB RAM hosting (Render, Railway free tier)
 */

export const config = {
    // Free tier mode (reduces memory usage)
    freeTierMode: process.env.FREE_TIER_MODE === 'true',

    // Video processing limits
    maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '10'),
    maxVideoDurationSec: parseInt(process.env.MAX_VIDEO_DURATION_SEC || '15'),

    // Frame extraction settings
    maxFrames: parseInt(process.env.MAX_FRAMES || '10'),
    frameFPS: parseInt(process.env.FRAME_FPS || '1'),

    // Memory limits
    maxConcurrentProcessing: 1, // Process one video at a time

    // Cleanup settings
    aggressiveCleanup: true,

    // Get recommended settings based on tier
    getFrameSettings() {
        if (this.freeTierMode) {
            return {
                fps: 1,
                maxFrames: 10,
                quality: 'medium'
            };
        }
        return {
            fps: 2,
            maxFrames: 20,
            quality: 'high'
        };
    },

    // Validate video size
    validateVideoSize(sizeInBytes: number): { valid: boolean; error?: string } {
        const sizeMB = sizeInBytes / (1024 * 1024);
        const maxSize = this.maxVideoSizeMB;

        if (sizeMB > maxSize) {
            return {
                valid: false,
                error: `Video size (${sizeMB.toFixed(1)}MB) exceeds limit of ${maxSize}MB for free tier. Please upload a smaller video.`
            };
        }

        return { valid: true };
    }
};

export default config;
