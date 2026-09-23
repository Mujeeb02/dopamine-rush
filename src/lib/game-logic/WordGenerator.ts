import randomWords from 'random-words';

export class WordGenerator {
    private history: Set<string> = new Set();
    private maxHistorySize = 50;

    generateWord(difficulty: number): string {
        // Difficulty 0-100

        let word = '';
        let attempts = 0;

        do {
            if (difficulty < 50) {
                // Use real words
                const minLength = 3 + Math.floor(difficulty / 10);
                const maxLength = 5 + Math.floor(difficulty / 5);
                word = this.getRealWord(minLength, maxLength);
            } else {
                // Use procedural generation for "alien" or "code" words at high levels
                // Or just complex real words
                // Let's mix it up. 
                if (Math.random() > 0.7) {
                    word = this.generateProceduralWord(Math.floor(difficulty / 10));
                } else {
                    const minLength = 6 + Math.floor((difficulty - 50) / 10);
                    const maxLength = 10 + Math.floor((difficulty - 50) / 5);
                    word = this.getRealWord(minLength, maxLength);
                }
            }
            attempts++;
        } while (this.history.has(word) && attempts < 10);

        this.addToHistory(word);
        return word;
    }

    generateSentence(wordCount: number, difficulty: number): string {
        const words = [];
        for (let i = 0; i < wordCount; i++) {
            words.push(this.generateWord(difficulty));
        }
        return words.join(' ');
    }

    private getRealWord(minLen: number, maxLen: number): string {
        // Simple wrapper around randomWords to filter by length
        let word = '';
        let tries = 0;
        while (tries < 50) {
            const candidate = (randomWords() as string).toLowerCase();
            if (candidate.length >= minLen && candidate.length <= maxLen) {
                word = candidate;
                break;
            }
            tries++;
        }
        return word || 'complexity'; // Fallback
    }

    private generateProceduralWord(length: number): string {
        const vowels = 'aeiou';
        const consonants = 'bcdfghjklmnpqrstvwxyz';
        let word = '';

        // Simple CV pattern
        let isVowel = Math.random() > 0.5;

        for (let i = 0; i < length; i++) {
            if (isVowel) {
                word += vowels[Math.floor(Math.random() * vowels.length)];
                isVowel = false;
            } else {
                word += consonants[Math.floor(Math.random() * consonants.length)];
                isVowel = true;
            }
        }
        return word;
    }

    private addToHistory(key: string) {
        this.history.add(key);
        if (this.history.size > this.maxHistorySize) {
            const first = this.history.values().next().value;
            if (first) this.history.delete(first);
        }
    }
}

export const wordGenerator = new WordGenerator();
