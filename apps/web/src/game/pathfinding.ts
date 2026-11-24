// Grid A* for tap-to-move. Obstacles are rasterized into a coarse grid
// (inflated by the player's footprint) so tapped targets route around
// trees, buildings, and water instead of walking into them.

export interface Point {
  x: number;
  y: number;
}

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(width: number, height: number, readonly cell = 16) {
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  /** Mark a center-anchored rectangle, inflated by `pad` on every side. */
  markRect(cx: number, cy: number, w: number, h: number, blocked: boolean, pad = 0) {
    const c0 = Math.max(0, Math.floor((cx - w / 2 - pad) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((cx + w / 2 + pad) / this.cell));
    const r0 = Math.max(0, Math.floor((cy - h / 2 - pad) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((cy + h / 2 + pad) / this.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.blocked[r * this.cols + c] = blocked ? 1 : 0;
  }

  isBlocked(c: number, r: number): boolean {
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows || this.blocked[r * this.cols + c] === 1;
  }

  private toCell(p: Point) {
    return { c: Math.floor(p.x / this.cell), r: Math.floor(p.y / this.cell) };
  }
  private center(c: number, r: number): Point {
    return { x: c * this.cell + this.cell / 2, y: r * this.cell + this.cell / 2 };
  }

  /** Nearest open cell to `p` (spiral search), so taps on obstacles still go somewhere sensible. */
  nearestOpen(p: Point, maxRadius = 12): { c: number; r: number } | null {
    const { c, r } = this.toCell(p);
    if (!this.isBlocked(c, r)) return { c, r };
    for (let d = 1; d <= maxRadius; d++) {
      let best: { c: number; r: number; dist: number } | null = null;
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d || this.isBlocked(c + dc, r + dr)) continue;
          const dist = dc * dc + dr * dr;
          if (!best || dist < best.dist) best = { c: c + dc, r: r + dr, dist };
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Straight walk between two points crosses no blocked cell. */
  lineClear(a: Point, b: Point): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (this.cell / 3));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const { c, r } = this.toCell({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      if (this.isBlocked(c, r)) return false;
    }
    return true;
  }

  /** Waypoints from `from` to `to` (exclusive of start), or null if unreachable. */
  findPath(from: Point, to: Point, maxNodes = 8000): Point[] | null {
    const start = this.nearestOpen(from, 3);
    const goal = this.nearestOpen(to);
    if (!start || !goal) return null;
    const goalPoint = this.isBlocked(this.toCell(to).c, this.toCell(to).r) ? this.center(goal.c, goal.r) : to;
    if (this.lineClear(from, goalPoint)) return [goalPoint];

    const idx = (c: number, r: number) => r * this.cols + c;
    const startI = idx(start.c, start.r);
    const goalI = idx(goal.c, goal.r);
    const g = new Float32Array(this.cols * this.rows).fill(Infinity);
    const came = new Int32Array(this.cols * this.rows).fill(-1);
    const closed = new Uint8Array(this.cols * this.rows);
    const h = (i: number) => {
      const dc = Math.abs((i % this.cols) - goal.c);
      const dr = Math.abs(Math.floor(i / this.cols) - goal.r);
      return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
    };
    // Binary heap of [f, index]
    const heap: [number, number][] = [];
    const push = (f: number, i: number) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p]![0] <= heap[k]![0]) break;
        [heap[p], heap[k]] = [heap[k]!, heap[p]!];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
          if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k]!, heap[m]!];
          k = m;
        }
      }
      return top;
    };

    g[startI] = 0;
    push(h(startI), startI);
    let expanded = 0;
    while (heap.length > 0 && expanded++ < maxNodes) {
      const [, cur] = pop();
      if (cur === goalI) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const c = cur % this.cols;
      const r = Math.floor(cur / this.cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (this.isBlocked(nc, nr)) continue;
          // No diagonal corner cutting.
          if (dc && dr && (this.isBlocked(c + dc, r) || this.isBlocked(c, r + dr))) continue;
          const ni = idx(nc, nr);
          const cost = g[cur]! + (dc && dr ? Math.SQRT2 : 1);
          if (cost < g[ni]!) {
            g[ni] = cost;
            came[ni] = cur;
            push(cost + h(ni), ni);
          }
        }
      }
    }
    if (came[goalI] === -1 && goalI !== startI) return null;

    const cells: Point[] = [];
    for (let i = goalI; i !== startI && i !== -1; i = came[i]!) cells.push(this.center(i % this.cols, Math.floor(i / this.cols)));
    cells.reverse();
    cells[cells.length - 1] = goalPoint;

    // String-pull: keep only the waypoints needed for line of sight.
    const out: Point[] = [];
    let anchor = from;
    for (let i = 0; i < cells.length; i++) {
      const next = cells[i + 1];
      if (!next || !this.lineClear(anchor, next)) {
        out.push(cells[i]!);
        anchor = cells[i]!;
      }
    }
    return out;
  }
}
