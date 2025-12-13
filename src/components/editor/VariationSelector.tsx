'use client';

import { useEditorStore } from '../../lib/stores/editorStore';

export function VariationSelector() {
    const { project, setProject } = useEditorStore();

    if (!project || !project.variations || project.variations.length <= 1) {
        return null;
    }

    const handleVariationChange = (index: number) => {
        setProject({
            ...project,
            selectedVariationIndex: index
        });
    };

    return (
        <div className="glass p-4 rounded-2xl border border-white/10 mb-6">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Select Variation
            </label>
            <div className="grid grid-cols-3 gap-2">
                {project.variations.map((variation, index) => (
                    <button
                        key={index}
                        onClick={() => handleVariationChange(index)}
                        className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${project.selectedVariationIndex === index
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-black/30 text-zinc-400 hover:bg-black/50 hover:text-zinc-200'
                            }`}
                    >
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs opacity-70">Variation</span>
                            <span className="text-lg font-bold">{index + 1}</span>
                        </div>
                    </button>
                ))}
            </div>
            <div className="mt-3 p-3 bg-black/30 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Current: {project.variations[project.selectedVariationIndex].name}</p>
                <p className="text-xs text-zinc-400">
                    {project.variations[project.selectedVariationIndex].segments.length} segments
                </p>
            </div>
        </div>
    );
}
