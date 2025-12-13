// Comprehensive font library for detection
// Based on Google Fonts most popular + common system fonts

export const FONT_LIBRARY = [
    // Sans-Serif (Most Popular)
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway',
    'Nunito', 'Ubuntu', 'Mukta', 'Work Sans', 'Rubik', 'Noto Sans', 'PT Sans',
    'Source Sans Pro', 'Oswald', 'Quicksand', 'Barlow', 'Oxygen', 'Mulish',
    'Manrope', 'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk',

    // Serif
    'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Crimson Text',
    'Libre Baskerville', 'Bitter', 'Arvo', 'Cormorant', 'EB Garamond',

    // Display/Decorative
    'Bebas Neue', 'Righteous', 'Pacifico', 'Lobster', 'Dancing Script',
    'Permanent Marker', 'Fredoka One', 'Anton', 'Archivo Black', 'Bangers',

    // Monospace
    'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Inconsolata',

    // System Fonts (Fallbacks)
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New',
    'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Tahoma',

    // Global / Multi-Language Support
    'Noto Sans',
    'Noto Sans Arabic',
    'Noto Sans JP',        // Japanese
    'Noto Sans KR',        // Korean
    'Noto Sans SC',        // Simplified Chinese
    'Noto Sans TC',        // Traditional Chinese
    'Noto Sans Hebrew',
    'Noto Sans Thai'
];

export const FONT_CATEGORIES = {
    'sans-serif': [
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Nunito', 'Ubuntu',
        'Work Sans', 'Rubik', 'Noto Sans', 'PT Sans', 'Source Sans Pro', 'Oswald', 'Quicksand', 'Barlow',
        'Oxygen', 'Mulish', 'Manrope', 'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk',
        // Global
        'Noto Sans', 'Noto Sans Arabic', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Hebrew', 'Noto Sans Thai'
    ],
    'serif': ['Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Crimson Text', 'Libre Baskerville', 'Bitter', 'Arvo', 'Cormorant', 'EB Garamond'],
    'display': ['Bebas Neue', 'Righteous', 'Pacifico', 'Lobster', 'Dancing Script', 'Permanent Marker', 'Fredoka One', 'Anton', 'Archivo Black', 'Bangers'],
    'monospace': ['Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Inconsolata']
};

export interface FontInfo {
    family: string;
    weight: number;
    style: 'normal' | 'italic';
    category: 'sans-serif' | 'serif' | 'display' | 'monospace';
    confidence: number;
}

export interface FontCharacteristics {
    hasSerifs: boolean;
    isMonospace: boolean;
    isDecorative: boolean;
    weight: number; // 100-900
    slant: number; // 0 = normal, >0 = italic
}
