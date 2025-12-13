import Groq from 'groq-sdk';
import {
    EnrichedOverlay,
    DesignSystem,
    LayoutLogic,
    TextRole,
    ConsolidatedTextInstance
} from '../../types/pipeline';

const MODEL_NAME = 'llama3-70b-8192'; // High intelligence model for reasoning

// --- Prompts from User ---

const SYSTEM_PROMPT_LAYOUT = `You are a layout-reasoning AI that converts pixel positions into responsive design logic.`;
const USER_PROMPT_LAYOUT = `For each overlay, determine:
Anchor position (top, center, bottom)
Horizontal alignment (left, center, right)
Padding (top, right, bottom, left)
Margin from screen edges
Z-index / layering order
Normalize all values so they adapt to different video resolutions.
Output JSON only.`;

const SYSTEM_PROMPT_ROLE = `You are an AI that understands short-form video storytelling.`;
const USER_PROMPT_ROLE = `Classify each text overlay into one role:
HOOK
BODY
CTA

Rules:
Each overlay must have exactly one role
Base classification on timing, wording, and position
Output JSON only`;

const SYSTEM_PROMPT_DESIGN = `You are a design-system AI.`;
const USER_PROMPT_DESIGN = `From all extracted overlays, generate reusable design tokens:
Font tokens
Color palette
Spacing scale
Timing presets

Rules:
Tokens must be reusable across videos
No duplication
Output JSON only`;

const SYSTEM_PROMPT_VARIATION = `You generate text variations without altering design or timing.`;
const USER_PROMPT_VARIATION = `Given HOOK and CTA text, generate exactly 3 variations.
Rules:
Preserve original intent
Do not change length drastically
Return text only
Output JSON only`;

export class StructureAnalyzerService {
    private groq: Groq;

    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
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

        const results = JSON.parse(response);
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

        const results = JSON.parse(response);
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

        return JSON.parse(response) as DesignSystem;
    }

    async generateVariations(hooksAndCtas: { id: string, text: string, role: string }[]): Promise<Map<string, string[]>> {
        if (hooksAndCtas.length === 0) return new Map();

        const response = await this.callC(
            SYSTEM_PROMPT_VARIATION,
            USER_PROMPT_VARIATION + "\n\nInput Data:\n" + JSON.stringify(hooksAndCtas)
        );

        const results = JSON.parse(response);
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
            const completion = await this.groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                model: MODEL_NAME,
                temperature: 0.1, // Low temp for structured tasks
                response_format: { type: 'json_object' }
            });

            return completion.choices[0]?.message?.content || '{}';
        } catch (error) {
            console.error('Groq Analysis Failed:', error);
            throw error;
        }
    }
}

export const structureAnalyzer = new StructureAnalyzerService();
