/**
 * Snowflake ID generator.
 *
 * Produces 64-bit, roughly time-ordered unique identifiers for OIDC clients:
 *
 * ```
 * | 41 bits timestamp (ms since epoch) | 10 bits worker | 12 bits sequence |
 * ```
 *
 * The default epoch is a custom platform cutover date (`2026-09-08T00:00:00Z`),
 * which gives ~69 years of unique ids from a 41-bit millisecond timestamp.
 * Sequence rolls over within a millisecond; on millisecond exhaustion the
 * generator advances to the next millisecond.
 */

export interface SnowflakeOptions {
  /** Epoch in milliseconds; defaults to `2026-09-08T00:00:00Z`. */
  epoch?: number;
  /** Worker id in `[0, 1023]`; defaults to `0`. */
  workerId?: number;
}

const DEFAULT_EPOCH = Date.UTC(2026, 8, 8);

const TIMESTAMP_BITS = 41n;
const WORKER_BITS = 10n;
const SEQUENCE_BITS = 12n;

const MAX_TIMESTAMP = (1n << TIMESTAMP_BITS) - 1n;
const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

const WORKER_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_BITS;

/**
 * Generator of unique 64-bit Snowflake identifiers.
 */
export class SnowflakeGenerator {
  private readonly epoch: number;
  private readonly workerId: bigint;
  private lastTimestamp = -1n;
  private sequence = 0n;

  public constructor(options: SnowflakeOptions = {}) {
    this.epoch = options.epoch ?? DEFAULT_EPOCH;
    const workerId = options.workerId ?? 0;
    if (workerId < 0 || workerId > MAX_WORKER_ID) {
      throw new RangeError(
        `Snowflake workerId out of range [0, ${MAX_WORKER_ID}]: ${workerId}`,
      );
    }
    this.workerId = BigInt(workerId);
  }

  /**
   * Returns the next unique Snowflake id.
   *
   * @param now - Wall-clock time in milliseconds; defaults to `Date.now()`.
   */
  public nextId(now: number = Date.now()): bigint {
    let timestamp = BigInt(now - this.epoch);

    if (timestamp < 0n) {
      throw new RangeError(
        "Snowflake clock is before the configured epoch; adjust SNOWFLAKE_EPOCH_MS",
      );
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        timestamp = this.advanceTimestamp(this.lastTimestamp, now);
      }
    } else if (timestamp > this.lastTimestamp) {
      this.sequence = 0n;
    } else {
      // Clock moved backwards; never reuse a timestamp.
      timestamp = this.lastTimestamp + 1n;
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
    }

    if (timestamp > MAX_TIMESTAMP) {
      throw new RangeError("Snowflake timestamp overflow (epoch elapsed)");
    }

    this.lastTimestamp = timestamp;
    return (timestamp << TIMESTAMP_SHIFT) | (this.workerId << WORKER_SHIFT) | this.sequence;
  }

  /** Returns the next unique Snowflake id as a decimal string. */
  public nextIdString(now?: number): string {
    return this.nextId(now).toString();
  }

  private advanceTimestamp(lastTimestamp: bigint, now: number): bigint {
    let timestamp = BigInt(now - this.epoch);
    while (timestamp <= lastTimestamp) {
      timestamp += 1n;
    }
    return timestamp;
  }
}

/** Default platform Snowflake epoch: `2026-09-08T00:00:00Z`. */
export const DEFAULT_SNOWFLAKE_EPOCH_MS = DEFAULT_EPOCH;