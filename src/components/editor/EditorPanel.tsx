'use client';

import { useEditorStore } from '../../lib/stores/editorStore';
import { ColorPicker, NumberSlider, SelectDropdown, SpacingControl, TextInput, ToggleSwitch } from './PropertyControls';
import { VariationSelector } from './VariationSelector';
import { useState } from 'react';
import { DesignSchema } from '../../types/video-processing';

export function EditorPanel() {
    const {
        project,
        updateDesignSchema,
        updateSegmentText,
        selectSegment,
        selectedSegmentIndex,
        reRender,
        isReRendering,
        hasUnsavedChanges,
        exitEditor
    } = useEditorStore();

    const [activeTab, setActiveTab] = useState<'global' | 'segments'>('global');

    if (!project) return null;

    const { designSchema, variations, selectedVariationIndex } = project;
    const currentVariation = variations[selectedVariationIndex];
    const currentSegment = currentVariation?.segments[selectedSegmentIndex];

    const handleApply = async () => {
        try {
            await reRender();
        } catch (error) {
            console.error('Failed to re-render:', error);
        }
    };

    // Parse font size value (e.g., "40px" -> 40)
    const parseFontSize = (size?: string) => {
        if (!size) return 40;
        return parseInt(size) || 40;
    };

    // Parse font weight value
    const parseFontWeight = (weight?: string | number) => {
        if (!weight) return '700';
        return String(weight);
    };

    // Parse line height value
    const parseLineHeight = (height?: string) => {
        if (!height) return 1.5;
        const parsed = parseFloat(height);
        return isNaN(parsed) ? 1.5 : parsed;
    };

    // Parse position values
    const parsePosition = (pos?: { x: number; y: number }) => {
        return pos || { x: 50, y: 50 };
    };

    return (
        <div className="glass h-full flex flex-col overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl">
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                    <span>🎨</span> Design Editor
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={exitEditor}
                        className="text-xs font-medium px-4 py-2 rounded-xl hover:bg-white/10 text-zinc-400 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!hasUnsavedChanges || isReRendering}
                        className={`text-xs font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg
                            ${hasUnsavedChanges
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 hover:shadow-purple-500/25'
                                : 'bg-white/5 text-zinc-500 cursor-not-allowed'}
                        `}
                    >
                        {isReRendering ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Rendering...
                            </>
                        ) : 'Apply Changes'}
                    </button>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-white/5 bg-black/20 p-1">
                <button
                    onClick={() => setActiveTab('global')}
                    className={`flex-1 py-3 text-sm font-bold transition-all rounded-xl ${activeTab === 'global'
                        ? 'bg-white/10 text-white shadow-inner'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    Global Design
                </button>
                <button
                    onClick={() => setActiveTab('segments')}
                    className={`flex-1 py-3 text-sm font-bold transition-all rounded-xl ${activeTab === 'segments'
                        ? 'bg-white/10 text-white shadow-inner'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    Text Segments ({currentVariation?.segments.length || 0})
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Variation Selector - Always visible */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                    <VariationSelector />
                </div>

                {activeTab === 'global' ? (
                    <div className="space-y-8 animate-fade-in">
                        {/* 1. Typography */}
                        <section>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Typography
                            </h4>
                            <div className="space-y-4">
                                <SelectDropdown
                                    label="Font Family"
                                    value={designSchema.fontFamily}
                                    onChange={(val) => updateDesignSchema({ fontFamily: val })}
                                    options={[
                                        { value: 'Inter', label: 'Inter (Modern)' },
                                        { value: 'Roboto', label: 'Roboto (Clean)' },
                                        { value: 'Montserrat', label: 'Montserrat (Geometric)' },
                                        { value: 'Playfair Display', label: 'Playfair (Serif)' },
                                        { value: 'Oswald', label: 'Oswald (Bold)' },
                                        { value: 'Poppins', label: 'Poppins (Rounded)' },
                                        { value: 'Bebas Neue', label: 'Bebas Neue (Impact)' },
                                    ]}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <NumberSlider
                                        label="Size"
                                        value={parseFontSize(designSchema.fontSize)}
                                        onChange={(val: number) => updateDesignSchema({ fontSize: `${val}px` })}
                                        min={12}
                                        max={120}
                                        unit="px"
                                    />
                                    <NumberSlider
                                        label="Line Height"
                                        value={parseLineHeight(designSchema.lineHeight)}
                                        onChange={(val: number) => updateDesignSchema({ lineHeight: String(val) })}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                    />
                                </div>
                                <SelectDropdown
                                    label="Font Weight"
                                    value={parseFontWeight(designSchema.fontWeight)}
                                    onChange={(val) => updateDesignSchema({ fontWeight: val })}
                                    options={[
                                        { value: '300', label: 'Light (300)' },
                                        { value: '400', label: 'Regular (400)' },
                                        { value: '500', label: 'Medium (500)' },
                                        { value: '600', label: 'Semi-Bold (600)' },
                                        { value: '700', label: 'Bold (700)' },
                                        { value: '800', label: 'Extra-Bold (800)' },
                                        { value: '900', label: 'Black (900)' },
                                    ]}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <ColorPicker
                                        label="Text Color"
                                        value={designSchema.textColor}
                                        onChange={(val: string) => updateDesignSchema({ textColor: val })}
                                        presets={[
                                            designSchema.backgroundColor, // Contrast with bg
                                            '#FFFFFF', '#000000',
                                            '#A855F7', '#EC4899', '#F59E0B' // Viral accents
                                        ]}
                                    />
                                    <SelectDropdown
                                        label="Alignment"
                                        value={designSchema.textAlignment}
                                        onChange={(val) => updateDesignSchema({ textAlignment: val as DesignSchema['textAlignment'] })}
                                        options={[
                                            { value: 'left', label: 'Left' },
                                            { value: 'center', label: 'Center' },
                                            { value: 'right', label: 'Right' },
                                        ]}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <NumberSlider
                                        label="Tracking"
                                        value={parseFloat(designSchema.letterSpacing || '0')}
                                        onChange={(val: number) => updateDesignSchema({ letterSpacing: `${val}px` })}
                                        min={-5}
                                        max={20}
                                        unit="px"
                                        step={0.5}
                                    />
                                    <SelectDropdown
                                        label="Transform"
                                        value={designSchema.textTransform || 'none'}
                                        onChange={(val) => updateDesignSchema({ textTransform: val as DesignSchema['textTransform'] })}
                                        options={[
                                            { value: 'none', label: 'Normal' },
                                            { value: 'uppercase', label: 'Uppercase' },
                                            { value: 'lowercase', label: 'Lowercase' },
                                            { value: 'capitalize', label: 'Capitalize' },
                                        ]}
                                    />
                                </div>
                                <TextInput
                                    label="Text Shadow"
                                    value={designSchema.textShadow || ''}
                                    onChange={(val: string) => updateDesignSchema({ textShadow: val })}
                                    placeholder="e.g. 2px 2px 4px rgba(0,0,0,0.8)"
                                />
                            </div>
                        </section>

                        {/* 2. Background & Style */}
                        <section>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                                Background & Style
                            </h4>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <ColorPicker
                                        label="Background"
                                        value={designSchema.backgroundColor}
                                        onChange={(val: string) => updateDesignSchema({ backgroundColor: val })}
                                        presets={[
                                            designSchema.textColor, // Contrast with text
                                            '#000000', '#FFFFFF',
                                            '#18181B', '#27272A', // Zinc 900/800
                                            'rgba(0,0,0,0.5)'     // Transparent overlay
                                        ]}
                                    />
                                    <NumberSlider
                                        label="Radius"
                                        value={parseInt(designSchema.borderRadius || '0')}
                                        onChange={(val: number) => updateDesignSchema({ borderRadius: `${val}px` })}
                                        min={0}
                                        max={50}
                                        unit="px"
                                    />
                                </div>
                                <TextInput
                                    label="Box Shadow"
                                    value={designSchema.boxShadow || ''}
                                    onChange={(val: string) => updateDesignSchema({ boxShadow: val })}
                                    placeholder="e.g. 0 4px 6px rgba(0,0,0,0.1)"
                                />
                            </div>
                        </section>

                        {/* 3. Spacing */}
                        <section>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Spacing
                            </h4>
                            <div className="space-y-4">
                                <SpacingControl
                                    label="Padding"
                                    value={designSchema.padding}
                                    onChange={(val) => updateDesignSchema({ padding: val })}
                                />
                                <SpacingControl
                                    label="Margin"
                                    value={designSchema.margin || '0px'}
                                    onChange={(val) => updateDesignSchema({ margin: val })}
                                />
                            </div>
                        </section>

                        {/* 4. Dimensions */}
                        <section>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Dimensions
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <TextInput
                                    label="Width"
                                    value={designSchema.width || 'auto'}
                                    onChange={(val: string) => updateDesignSchema({ width: val })}
                                    placeholder="e.g. auto, 300px, 80%"
                                />
                                <TextInput
                                    label="Height"
                                    value={designSchema.height || 'auto'}
                                    onChange={(val: string) => updateDesignSchema({ height: val })}
                                    placeholder="e.g. auto, 100px"
                                />
                            </div>
                        </section>

                        {/* 5. Position */}
                        <section>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                Position
                            </h4>
                            <div className="space-y-4">
                                <NumberSlider
                                    label="X Position (%)"
                                    value={parsePosition(designSchema.position).x}
                                    onChange={(val: number) => updateDesignSchema({
                                        position: { ...parsePosition(designSchema.position), x: val }
                                    })}
                                    min={0}
                                    max={100}
                                    unit="%"
                                />
                                <NumberSlider
                                    label="Y Position (%)"
                                    value={parsePosition(designSchema.position).y}
                                    onChange={(val: number) => updateDesignSchema({
                                        position: { ...parsePosition(designSchema.position), y: val }
                                    })}
                                    min={0}
                                    max={100}
                                    unit="%"
                                />
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        {/* Segments Tab */}
                        <section>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                Text Segments
                            </h4>
                            <div className="space-y-3">
                                {currentVariation?.segments.map((segment, index) => (
                                    <div
                                        key={index}
                                        onClick={() => selectSegment(index)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer group relative overflow-hidden ${selectedSegmentIndex === index
                                            ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                            : 'border-white/5 bg-black/20 hover:border-white/20 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black tracking-wider ${segment.role === 'hook' ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                                                segment.role === 'body' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                                                    segment.role === 'cta' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                                                        'bg-zinc-500/20 text-zinc-400 border border-zinc-500/20'
                                                }`}>
                                                {segment.role}
                                            </span>
                                            <span className="text-xs text-zinc-500 font-mono ml-auto">
                                                {(segment.startTime / 1000).toFixed(1)}s - {(segment.endTime / 1000).toFixed(1)}s
                                            </span>
                                        </div>
                                        {selectedSegmentIndex === index ? (
                                            <textarea
                                                value={segment.text}
                                                onChange={(e) => updateSegmentText(index, e.target.value)}
                                                className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none text-white placeholder-zinc-600"
                                                rows={3}
                                                placeholder="Edit segment text..."
                                            />
                                        ) : (
                                            <p className="text-sm text-zinc-300 line-clamp-2 font-medium">{segment.text}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {currentSegment && (
                            <section>
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                    Timing Details
                                </h4>
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
                                        <div>
                                            <label className="text-[10px] text-zinc-500 block mb-1">Start</label>
                                            <span className="text-sm font-mono text-white">{(currentSegment.startTime / 1000).toFixed(2)}s</span>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 block mb-1">End</label>
                                            <span className="text-sm font-mono text-white">{(currentSegment.endTime / 1000).toFixed(2)}s</span>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 block mb-1">Dur</label>
                                            <span className="text-sm font-mono text-purple-400">{((currentSegment.endTime - currentSegment.startTime) / 1000).toFixed(2)}s</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
}
