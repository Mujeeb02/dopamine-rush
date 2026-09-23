export class ColorTheory {
    private history: Set<string> = new Set();
    private maxHistorySize = 10;

    generatePalette(count: number, difficulty: number): string[] {
        // Difficulty 0-100
        // Low difficulty: High contrast, distinct hues
        // High difficulty: Low contrast, similar hues (analogous colors)

        let palette: string[] = [];
        let paletteKey = '';
        let attempts = 0;

        do {
            palette = this.createPalette(count, difficulty);
            paletteKey = palette.join('|');
            attempts++;
        } while (this.history.has(paletteKey) && attempts < 10);

        this.addToHistory(paletteKey);
        return palette;
    }

    private createPalette(count: number, difficulty: number): string[] {
        const colors: string[] = [];

        // Base hue
        const baseHue = Math.floor(Math.random() * 360);

        // Spread determines how far apart colors are on the color wheel
        // Easy (diff 0): Spread 360 (all over)
        // Hard (diff 100): Spread 30 (very close, analogous)
        const minSpread = 40;
        const maxSpread = 360;
        const spread = maxSpread - ((difficulty / 100) * (maxSpread - minSpread));

        for (let i = 0; i < count; i++) {
            // Calculate hue
            // Distribute colors evenly within the spread, or randomly?
            // Randomly within spread is harder. Evenly is cleaner.
            // Let's go with distributed but with some jitter.

            const offset = (i / count) * spread;
            const jitter = (Math.random() * 20) - 10; // +/- 10 degrees jitter
            let hue = (baseHue + offset + jitter) % 360;
            if (hue < 0) hue += 360;

            // Saturation and Lightness
            // Harder levels have less saturation/lightness contrast
            const baseSat = 70;
            const baseLight = 50;

            const satVar = Math.max(0, 30 - (difficulty / 3)); // Less variation at high difficulty
            const lightVar = Math.max(0, 30 - (difficulty / 3));

            const s = baseSat + (Math.random() * satVar * 2 - satVar);
            const l = baseLight + (Math.random() * lightVar * 2 - lightVar);

            colors.push(`hsl(${Math.round(hue)}, ${Math.round(s)}%, ${Math.round(l)}%)`);
        }

        // Shuffle
        return colors.sort(() => Math.random() - 0.5);
    }

    generateDistractors(targetColor: string, count: number, difficulty: number): string[] {
        // Parse target HSL
        const hslMatch = targetColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!hslMatch) return [];

        const h = parseInt(hslMatch[1]);
        const s = parseInt(hslMatch[2]);
        const l = parseInt(hslMatch[3]);

        const distractors: string[] = [];

        // Difficulty determines how close distractors are
        // Easy: +/- 60 hue
        // Hard: +/- 10 hue
        const hueRange = Math.max(10, 60 - (difficulty / 2));

        for (let i = 0; i < count; i++) {
            const hOffset = (Math.random() * hueRange * 2) - hueRange;
            // Ensure we don't pick the exact same color (approx)
            let dh = hOffset;
            if (Math.abs(dh) < 5) dh = 10 * (Math.random() > 0.5 ? 1 : -1);

            let newH = (h + dh) % 360;
            if (newH < 0) newH += 360;

            distractors.push(`hsl(${Math.round(newH)}, ${s}%, ${l}%)`);
        }

        return distractors;
    }

    private addToHistory(key: string) {
        this.history.add(key);
        if (this.history.size > this.maxHistorySize) {
            const first = this.history.values().next().value;
            if (first) this.history.delete(first);
        }
    }
}

export const colorTheory = new ColorTheory();
