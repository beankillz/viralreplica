'use client';

import { HexColorPicker } from 'react-colorful';
import { useState, useRef, useEffect } from 'react';

// Common Styles
const LABEL_STYLE = "block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5 ml-1";
const INPUT_BASE_STYLE = "w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:bg-black/60 transition-all shadow-inner";

interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (color: string) => void;
    className?: string;
    presets?: string[];
}

export function ColorPicker({ label, value, onChange, className = '', presets = [] }: ColorPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    return (
        <div className={`relative ${className}`}>
            <label className={LABEL_STYLE}>
                {label}
            </label>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-12 h-11 rounded-xl border border-white/10 hover:border-white/20 transition-all shadow-lg active:scale-95"
                    style={{ backgroundColor: value }}
                    aria-label={`Pick ${label}`}
                />
                <div className="flex-1 flex flex-col gap-2">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={`${INPUT_BASE_STYLE} font-mono`}
                        placeholder="#000000"
                    />
                    {presets.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                            {presets.map((preset, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onChange(preset)}
                                    className="w-5 h-5 rounded-full border border-white/10 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: preset }}
                                    title={preset}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isOpen && (
                <div ref={pickerRef} className="absolute z-50 mt-3 p-3 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl animate-fade-in backdrop-blur-xl">
                    <HexColorPicker color={value} onChange={onChange} />
                </div>
            )}
        </div>
    );
}

interface NumberSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    className?: string;
}

export function NumberSlider({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    unit = '',
    className = ''
}: NumberSliderProps) {
    return (
        <div className={className}>
            <div className="flex justify-between items-center mb-2.5 ml-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {label}
                </label>
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">{value}{unit}</span>
            </div>
            <div className="flex gap-3 items-center bg-black/40 p-2 rounded-xl border border-white/5">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
            </div>
        </div>
    );
}

interface TextInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function TextInput({ label, value, onChange, placeholder, className = '' }: TextInputProps) {
    return (
        <div className={className}>
            <label className={LABEL_STYLE}>
                {label}
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={INPUT_BASE_STYLE}
            />
        </div>
    );
}

interface SelectDropdownProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    className?: string;
}

export function SelectDropdown({ label, value, onChange, options, className = '' }: SelectDropdownProps) {
    return (
        <div className={className}>
            <label className={LABEL_STYLE}>
                {label}
            </label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${INPUT_BASE_STYLE} appearance-none cursor-pointer pr-10`}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value} className="bg-zinc-900 text-zinc-300 py-2">
                            {option.label}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
            </div>
        </div>
    );
}

interface SpacingControlProps {
    label: string;
    value: string | { top: string; right: string; bottom: string; left: string };
    onChange: (value: { top: string; right: string; bottom: string; left: string }) => void;
    className?: string;
}

export function SpacingControl({ label, value, onChange, className = '' }: SpacingControlProps) {
    const spacing = typeof value === 'string'
        ? { top: value, right: value, bottom: value, left: value }
        : value;

    const parseValue = (val: string) => parseInt(val) || 0;

    const updateSide = (side: 'top' | 'right' | 'bottom' | 'left', newValue: string) => {
        onChange({
            ...spacing,
            [side]: `${newValue}px`
        });
    };

    const MINI_INPUT_STYLE = "w-full bg-black/40 border border-white/5 rounded-lg px-2 py-2 text-xs text-center text-white focus:outline-none focus:border-purple-500/50 transition-colors";

    return (
        <div className={className}>
            <label className={LABEL_STYLE}>
                {label}
            </label>
            <div className="grid grid-cols-2 gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block text-center uppercase">Top</label>
                    <input
                        type="number"
                        value={parseValue(spacing.top)}
                        onChange={(e) => updateSide('top', e.target.value)}
                        className={MINI_INPUT_STYLE}
                    />
                </div>
                <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block text-center uppercase">Right</label>
                    <input
                        type="number"
                        value={parseValue(spacing.right)}
                        onChange={(e) => updateSide('right', e.target.value)}
                        className={MINI_INPUT_STYLE}
                    />
                </div>
                <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block text-center uppercase">Bottom</label>
                    <input
                        type="number"
                        value={parseValue(spacing.bottom)}
                        onChange={(e) => updateSide('bottom', e.target.value)}
                        className={MINI_INPUT_STYLE}
                    />
                </div>
                <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block text-center uppercase">Left</label>
                    <input
                        type="number"
                        value={parseValue(spacing.left)}
                        onChange={(e) => updateSide('left', e.target.value)}
                        className={MINI_INPUT_STYLE}
                    />
                </div>
            </div>
        </div>
    );
}

interface ToggleSwitchProps {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    className?: string;
}

export function ToggleSwitch({ label, value, onChange, className = '' }: ToggleSwitchProps) {
    return (
        <div className={`flex items-center justify-between ${className} bg-black/20 p-3 rounded-xl border border-white/5`}>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">
                {label}
            </label>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${value ? 'bg-purple-500' : 'bg-zinc-700'
                    }`}
            >
                <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${value ? 'translate-x-5' : 'translate-x-0'
                        }`}
                />
            </button>
        </div>
    );
}
