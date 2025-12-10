import { FONT_LIBRARY, FONT_CATEGORIES, FontInfo, FontCharacteristics } from '../fonts/font-library';

/**
 * FontDetectorService
 * Analyzes text characteristics to match against comprehensive font library
 */
export class FontDetectorService {

    /**
     * Detect font from Gemini's font family hint + visual characteristics
     */
    async detectFont(
        geminiHint: string,
        characteristics?: Partial<FontCharacteristics>
    ): Promise<FontInfo> {

        // Strategy 1: Direct match from Gemini hint
        const directMatch = this.findDirectMatch(geminiHint);
        if (directMatch && directMatch.confidence > 0.8) {
            return directMatch;
        }

        // Strategy 2: Fuzzy matching with characteristics
        const fuzzyMatch = this.fuzzyMatch(geminiHint, characteristics);
        if (fuzzyMatch && fuzzyMatch.confidence > 0.6) {
            return fuzzyMatch;
        }

        // Strategy 3: Category-based fallback
        return this.getCategoryFallback(characteristics);
    }

    /**
     * Find exact or close match in font library
     */
    private findDirectMatch(hint: string): FontInfo | null {
        const normalized = hint.toLowerCase().trim();

        // Exact match
        for (const font of FONT_LIBRARY) {
            if (font.toLowerCase() === normalized) {
                return {
                    family: font,
                    weight: 400,
                    style: 'normal',
                    category: this.getCategoryForFont(font),
                    confidence: 1.0
                };
            }
        }

        // Partial match (e.g., "Inter Bold" -> "Inter")
        for (const font of FONT_LIBRARY) {
            if (normalized.includes(font.toLowerCase()) || font.toLowerCase().includes(normalized)) {
                return {
                    family: font,
                    weight: this.extractWeight(hint),
                    style: this.extractStyle(hint),
                    category: this.getCategoryForFont(font),
                    confidence: 0.85
                };
            }
        }

        return null;
    }

    /**
     * Fuzzy matching using Levenshtein distance
     */
    private fuzzyMatch(
        hint: string,
        characteristics?: Partial<FontCharacteristics>
    ): FontInfo | null {
        let bestMatch: FontInfo | null = null;
        let bestScore = 0;

        for (const font of FONT_LIBRARY) {
            const similarity = this.calculateSimilarity(hint.toLowerCase(), font.toLowerCase());

            // Boost score if characteristics match
            let score = similarity;
            if (characteristics) {
                if (characteristics.hasSerifs && this.getCategoryForFont(font) === 'serif') {
                    score += 0.2;
                }
                if (characteristics.isMonospace && this.getCategoryForFont(font) === 'monospace') {
                    score += 0.3;
                }
                if (characteristics.isDecorative && this.getCategoryForFont(font) === 'display') {
                    score += 0.2;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    family: font,
                    weight: characteristics?.weight || 400,
                    style: characteristics?.slant && characteristics.slant > 0 ? 'italic' : 'normal',
                    category: this.getCategoryForFont(font),
                    confidence: Math.min(score, 1.0)
                };
            }
        }

        return bestMatch;
    }

    /**
     * Calculate string similarity (0-1)
     */
    private calculateSimilarity(a: string, b: string): number {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Levenshtein distance algorithm
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

    /**
     * Get category for a font
     */
    private getCategoryForFont(font: string): 'sans-serif' | 'serif' | 'display' | 'monospace' {
        for (const [category, fonts] of Object.entries(FONT_CATEGORIES)) {
            if (fonts.includes(font)) {
                return category as any;
            }
        }
        return 'sans-serif'; // Default
    }

    /**
     * Extract weight from hint (e.g., "Bold" -> 700)
     */
    private extractWeight(hint: string): number {
        const lower = hint.toLowerCase();
        if (lower.includes('thin') || lower.includes('100')) return 100;
        if (lower.includes('extra light') || lower.includes('200')) return 200;
        if (lower.includes('light') || lower.includes('300')) return 300;
        if (lower.includes('regular') || lower.includes('400')) return 400;
        if (lower.includes('medium') || lower.includes('500')) return 500;
        if (lower.includes('semi bold') || lower.includes('600')) return 600;
        if (lower.includes('bold') || lower.includes('700')) return 700;
        if (lower.includes('extra bold') || lower.includes('800')) return 800;
        if (lower.includes('black') || lower.includes('900')) return 900;
        return 400; // Default
    }

    /**
     * Extract style from hint
     */
    private extractStyle(hint: string): 'normal' | 'italic' {
        const lower = hint.toLowerCase();
        return lower.includes('italic') || lower.includes('oblique') ? 'italic' : 'normal';
    }

    /**
     * Get fallback based on characteristics
     */
    private getCategoryFallback(characteristics?: Partial<FontCharacteristics>): FontInfo {
        if (characteristics?.hasSerifs) {
            return {
                family: 'Merriweather',
                weight: characteristics.weight || 400,
                style: 'normal',
                category: 'serif',
                confidence: 0.5
            };
        }

        if (characteristics?.isMonospace) {
            return {
                family: 'Roboto Mono',
                weight: characteristics.weight || 400,
                style: 'normal',
                category: 'monospace',
                confidence: 0.5
            };
        }

        if (characteristics?.isDecorative) {
            return {
                family: 'Bebas Neue',
                weight: characteristics.weight || 400,
                style: 'normal',
                category: 'display',
                confidence: 0.5
            };
        }

        // Default: Inter (most versatile)
        return {
            family: 'Inter',
            weight: characteristics?.weight || 400,
            style: 'normal',
            category: 'sans-serif',
            confidence: 0.4
        };
    }
}

export const fontDetectorService = new FontDetectorService();
