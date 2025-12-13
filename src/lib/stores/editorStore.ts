import { create } from 'zustand';
import { EditableProject, DesignSchema, ScriptSegment } from '../../types/video-processing';

interface EditorState {
    // Current project being edited
    project: EditableProject | null;

    // Currently selected segment for editing
    selectedSegmentIndex: number;

    // Editor state
    isEditing: boolean;
    hasUnsavedChanges: boolean;
    isReRendering: boolean;

    // Video playback state
    currentTime: number;
    isPlaying: boolean;

    // Actions
    setProject: (project: EditableProject) => void;
    updateDesignSchema: (updates: Partial<DesignSchema>) => void;
    updateSegmentText: (index: number, text: string) => void;
    updateSegmentSchema: (index: number, schema: Partial<DesignSchema>) => void;
    selectSegment: (index: number) => void;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    saveChanges: () => Promise<void>;
    reRender: () => Promise<Blob>;
    resetChanges: () => void;
    exitEditor: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    project: null,
    selectedSegmentIndex: 0,
    isEditing: false,
    hasUnsavedChanges: false,
    isReRendering: false,
    currentTime: 0,
    isPlaying: false,

    setProject: (project) => {
        set({
            project,
            isEditing: true,
            selectedSegmentIndex: 0,
            hasUnsavedChanges: false,
            currentTime: 0
        });
    },

    updateDesignSchema: (updates) => {
        const { project } = get();
        if (!project) return;

        set({
            project: {
                ...project,
                designSchema: {
                    ...project.designSchema,
                    ...updates
                }
            },
            hasUnsavedChanges: true
        });
    },

    updateSegmentText: (index, text) => {
        const { project } = get();
        if (!project) return;

        const updatedVariations = [...project.variations];
        const selectedVariation = updatedVariations[project.selectedVariationIndex];

        if (selectedVariation && selectedVariation.segments[index]) {
            selectedVariation.segments[index] = {
                ...selectedVariation.segments[index],
                text
            };

            set({
                project: {
                    ...project,
                    variations: updatedVariations
                },
                hasUnsavedChanges: true
            });
        }
    },

    updateSegmentSchema: (index, schemaUpdates) => {
        const { project } = get();
        if (!project) return;

        const updatedVariations = [...project.variations];
        const selectedVariation = updatedVariations[project.selectedVariationIndex];

        if (selectedVariation && selectedVariation.segments[index]) {
            const currentStyle = selectedVariation.segments[index].style || project.designSchema;

            selectedVariation.segments[index] = {
                ...selectedVariation.segments[index],
                style: {
                    ...currentStyle,
                    ...schemaUpdates
                } as DesignSchema
            };

            set({
                project: {
                    ...project,
                    variations: updatedVariations
                },
                hasUnsavedChanges: true
            });
        }
    },

    selectSegment: (index) => {
        const { project } = get();
        if (!project) return;

        const selectedVariation = project.variations[project.selectedVariationIndex];
        if (selectedVariation && selectedVariation.segments[index]) {
            const segment = selectedVariation.segments[index];
            set({
                selectedSegmentIndex: index,
                currentTime: segment.startTime / 1000 // Convert to seconds
            });
        }
    },

    setCurrentTime: (time) => {
        set({ currentTime: time });
    },

    setIsPlaying: (playing) => {
        set({ isPlaying: playing });
    },

    saveChanges: async () => {
        const { project } = get();
        if (!project) return;

        try {
            const response = await fetch('/api/update-schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    schema: project.designSchema,
                    variations: project.variations
                })
            });

            if (response.ok) {
                set({ hasUnsavedChanges: false });
            }
        } catch (error) {
            console.error('Failed to save changes:', error);
            throw error;
        }
    },

    reRender: async () => {
        const { project } = get();
        if (!project) throw new Error('No project loaded');
        if (!project.userVideoFile) throw new Error('No user video file available');

        set({ isReRendering: true });

        try {
            const formData = new FormData();
            formData.append('video', project.userVideoFile);
            formData.append('data', JSON.stringify({
                segments: project.variations[project.selectedVariationIndex].segments,
                schema: project.designSchema,
                topic: project.topic
            }));

            const response = await fetch('/api/re-render', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Re-render failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            set({
                project: {
                    ...project,
                    outputVideoUrl: url
                },
                hasUnsavedChanges: false,
                isReRendering: false
            });

            return blob;
        } catch (error) {
            console.error(error);
            set({ isReRendering: false });
            throw error;
        }
    },

    resetChanges: () => {
        // This would reload the original project data
        // For now, just clear unsaved changes flag
        set({ hasUnsavedChanges: false });
    },

    exitEditor: () => {
        set({
            project: null,
            isEditing: false,
            selectedSegmentIndex: 0,
            hasUnsavedChanges: false,
            currentTime: 0,
            isPlaying: false
        });
    }
}));
