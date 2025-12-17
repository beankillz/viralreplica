import {
    EnrichedOverlay,
    DesignSystem,
    LayoutLogic,
    TextRole,
    ConsolidatedTextInstance
} from '../../types/pipeline';

const MODEL_NAME = 'nvidia/nemotron-nano-12b-v2-vl:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// --- Prompts from User ---

const SYSTEM_PROMPT_LAYOUT = `You are a layout-reasoning AI. STRICT JSON ONLY. NO HALLUCINATIONS.`;
const USER_PROMPT_LAYOUT = `For each overlay, determine:
Anchor position (top, center, bottom)
Horizontal alignment (left, center, right)
Padding (top, right, bottom, left)
Margin from screen edges
Z-index / layering order
Normalize all values.
Output JSON only.`;

const SYSTEM_PROMPT_ROLE = `You are a video storytelling AI. STRICT JSON ONLY. NO HALLUCINATIONS.`;
const USER_PROMPT_ROLE = `Classify each text overlay into one role:
HOOK
BODY
CTA

Rules:
Each overlay must have exactly one role
Output JSON only`;

const SYSTEM_PROMPT_DESIGN = `You are a design-system AI. STRICT JSON ONLY.`;
const USER_PROMPT_DESIGN = `From all extracted overlays, generate reusable design tokens:
Font tokens
Color palette
Spacing scale
Timing presets

Rules:
Output JSON only`;

const SYSTEM_PROMPT_VARIATION = `You generate text variations without altering design or timing.`;
const USER_PROMPT_VARIATION = `Given HOOK and CTA text, generate exactly 3 variations.
Rules:
Preserve original intent
Do not change length drastically
Return text only
Output JSON only`;

export class StructureAnalyzerService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('OPENROUTER_API_KEY is not set in StructureAnalyzerService');
        }
    }

    async analyzeLayout(overlays: ConsolidatedTextInstance[]): Promise<Map<string, LayoutLogic>> {
        const input = overlays.map(o => ({
            id: o.id,
            text: o.text,
            boundingBox: o.boundingBox
        }));

        const response = await this.callC(
            SYSTEM_PROMPT_LAYOUT,
            USER_PROMPT_LAYOUT + "\n\nInput Data:\n" + JSON.stringify(input)
        );

        let results;
        try {
            results = JSON.parse(response);
        } catch (err) {
            console.error("Failed to parse layout response, using empty map:", err);
            return new Map<string, LayoutLogic>();
        }

        const layoutMap = new Map<string, LayoutLogic>();

        // Handle input as array or object with array
        const items = Array.isArray(results) ? results : (results.overlays || []);

        items.forEach((item: any) => {
            if (item.id && item.anchor) { // Minimal validation
                layoutMap.set(item.id, {
                    anchor: item.anchor,
                    alignment: item.alignment,
                    padding: item.padding || { top: 0, right: 0, bottom: 0, left: 0 },
                    margin: item.margin || { top: 0, right: 0, bottom: 0, left: 0 },
                    zIndex: item.zIndex || 1
                });
            }
        });

        return layoutMap;
    }

    async classifyRoles(overlays: ConsolidatedTextInstance[]): Promise<Map<string, TextRole>> {
        const input = overlays.map(o => ({
            id: o.id,
            text: o.text,
            startTime: o.startTime,
            duration: o.duration,
            boundingBox: o.boundingBox
        }));

        const response = await this.callC(
            SYSTEM_PROMPT_ROLE,
            USER_PROMPT_ROLE + "\n\nInput Data:\n" + JSON.stringify(input)
        );

        let results;
        try {
            results = JSON.parse(response);
        } catch (err) {
            console.error("Failed to parse role classification response, using empty map:", err);
            return new Map<string, TextRole>();
        }

        const roleMap = new Map<string, TextRole>();

        const items = Array.isArray(results) ? results : (results.classifications || []);

        items.forEach((item: any) => {
            if (item.id && item.role) {
                roleMap.set(item.id, item.role as TextRole);
            }
        });

        return roleMap;
    }

    async generateDesignSystem(overlays: ConsolidatedTextInstance[]): Promise<DesignSystem> {
        const input = overlays.map(o => ({
            text: o.text,
            visuals: o.visuals
        }));

        const response = await this.callC(
            SYSTEM_PROMPT_DESIGN,
            USER_PROMPT_DESIGN + "\n\nInput Data:\n" + JSON.stringify(input)
        );

        try {
            return JSON.parse(response) as DesignSystem;
        } catch (err) {
            console.error("Failed to parse design system response, using defaults:", err);
            // Return sensible defaults matching DesignSystem interface
            return {
                fonts: { primary: 'Inter', secondary: 'Arial' },
                colors: {
                    primary: '#ffffff',
                    secondary: '#cccccc',
                    accent: '#0080ff',
                    background: '#000000',
                    text: '#ffffff'
                },
                spacing: { base: 8, scale: [8, 16, 24, 32, 48] },
                timing: { avgDurationPerWord: 500, minDuration: 1000 }
            };
        }
    }

    async generateVariations(hooksAndCtas: { id: string, text: string, role: string }[]): Promise<Map<string, string[]>> {
        if (hooksAndCtas.length === 0) return new Map();

        const response = await this.callC(
            SYSTEM_PROMPT_VARIATION,
            USER_PROMPT_VARIATION + "\n\nInput Data:\n" + JSON.stringify(hooksAndCtas)
        );

        let results;
        try {
            results = JSON.parse(response);
        } catch (err) {
            console.error("Failed to parse variation response, using empty map:", err);
            return new Map<string, string[]>();
        }

        const variationMap = new Map<string, string[]>();

        const items = Array.isArray(results) ? results : (results.variations || []);

        items.forEach((item: any) => {
            if (item.id && Array.isArray(item.variations)) {
                variationMap.set(item.id, item.variations);
            }
        });

        return variationMap;
    }

    private async callC(systemPrompt: string, userContent: string): Promise<string> {
        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
                    'X-Title': 'Viral Replica structure-analyzer'
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ],
                    max_tokens: 2048, // Prevent massive hallucinations
                    temperature: 0.1, // Low temp for structured tasks
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '{}';

            // Sanitize content: remove ```json and ``` blocks if present
            const cleanContent = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
            return cleanContent;

        } catch (error) {
            console.error('OpenRouter Analysis Failed:', error);
            throw error;
        }
    }
}

export const structureAnalyzer = new StructureAnalyzerService();
