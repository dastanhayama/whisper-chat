/**
 * Bounded circular buffer for storing messages in memory.
 * When full, oldest items are automatically removed.
 */
export class BoundedBuffer<T> {
  private items: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.maxSize) {
      this.items.shift();
    }
  }

  getAll(): T[] {
    return [...this.items];
  }

  getLast(count: number): T[] {
    const start = Math.max(0, this.items.length - count);
    return this.items.slice(start);
  }

  clear(): void {
    this.items = [];
  }

  get length(): number {
    return this.items.length;
  }

  get capacity(): number {
    return this.maxSize;
  }
}

/**
 * Rate limiter using sliding window algorithm.
 * Tracks actions within a time window and enforces limits.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequestsPerSecond: number) {
    this.maxRequests = maxRequestsPerSecond;
    this.windowMs = 1000; // 1 second window
  }

  canProceed(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => t > windowStart);

    return this.timestamps.length < this.maxRequests;
  }

  record(): boolean {
    if (!this.canProceed()) {
      return false;
    }
    this.timestamps.push(Date.now());
    return true;
  }

  reset(): void {
    this.timestamps = [];
  }
}
