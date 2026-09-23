export interface GridPoint {
  x: number;
  y: number;
  id: number;
}

export class PatternGenerator {
  private history: Set<string> = new Set();
  private maxHistorySize = 20;

  constructor() {}

  /**
   * Generates a unique pattern for FreezeFrame
   */
  generateGridPattern(gridSize: number, activeCount: number): GridPoint[] {
    const totalCells = gridSize * gridSize;
    let pattern: number[] = [];
    let patternKey = '';
    let attempts = 0;

    do {
      // Create a pool of all cell indices
      const pool = Array.from({ length: totalCells }, (_, i) => i);
      
      // Shuffle pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Select first 'activeCount' cells
      pattern = pool.slice(0, activeCount).sort((a, b) => a - b);
      patternKey = `grid:${gridSize}:${pattern.join(',')}`;
      attempts++;
    } while (this.history.has(patternKey) && attempts < 10);

    this.addToHistory(patternKey);

    return pattern.map(id => ({
      id,
      x: id % gridSize,
      y: Math.floor(id / gridSize)
    }));
  }

  /**
   * Generates a trail path for TrailTracker
   */
  generateTrail(gridSize: number, length: number, difficulty: 'easy' | 'medium' | 'hard'): GridPoint[] {
    length = Math.min(Math.max(1, length), gridSize * gridSize);
    let trail: GridPoint[] = [];
    let trailKey = '';
    let attempts = 0;

    do {
      trail = this.createTrailPath(gridSize, length, difficulty);
      trailKey = `trail:${gridSize}:${trail.map(p => `${p.x},${p.y}`).join('|')}`;
      attempts++;
    } while ((trail.length < length || this.history.has(trailKey)) && attempts < 50);

    // A bounded serpentine path guarantees completion even after repeated dead ends.
    if (trail.length < length) {
      trail = Array.from({ length }, (_, i) => {
        const y = Math.floor(i / gridSize);
        const x = y % 2 ? gridSize - 1 - i % gridSize : i % gridSize;
        return { x, y, id: y * gridSize + x };
      });
      trailKey = `trail:${gridSize}:${trail.map(p => p.id).join(',')}`;
    }

    this.addToHistory(trailKey);
    return trail;
  }

  private createTrailPath(gridSize: number, length: number, difficulty: 'easy' | 'medium' | 'hard'): GridPoint[] {
    const trail: GridPoint[] = [];
    let currentX = Math.floor(Math.random() * gridSize);
    let currentY = Math.floor(Math.random() * gridSize);
    
    trail.push({ x: currentX, y: currentY, id: currentY * gridSize + currentX });

    for (let i = 1; i < length; i++) {
      const moves = this.getValidMoves(currentX, currentY, gridSize, trail, difficulty);
      
      if (moves.length === 0) {
        return trail;
      }

      const move = moves[Math.floor(Math.random() * moves.length)];
      currentX = move.x;
      currentY = move.y;
      trail.push({ x: currentX, y: currentY, id: currentY * gridSize + currentX });
    }

    return trail;
  }

  private getValidMoves(x: number, y: number, gridSize: number, currentTrail: GridPoint[], difficulty: 'easy' | 'medium' | 'hard'): {x: number, y: number}[] {
    const moves = [];
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, // Cardinals
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 } // Diagonals
    ];

    // Filter directions based on difficulty
    let allowedDirs = directions;
    if (difficulty === 'easy') {
      allowedDirs = directions.slice(0, 4); // Only cardinals
    }

    for (const dir of allowedDirs) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      // Check bounds
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        // Check if already in trail (no self-intersection for now, maybe allow for hard?)
        if (!currentTrail.some(p => p.x === nx && p.y === ny)) {
          moves.push({ x: nx, y: ny });
        }
      }
    }

    return moves;
  }

  private addToHistory(key: string) {
    this.history.add(key);
    if (this.history.size > this.maxHistorySize) {
      const first = this.history.values().next().value;
      if (first) this.history.delete(first);
    }
  }
}

export const patternGenerator = new PatternGenerator();
