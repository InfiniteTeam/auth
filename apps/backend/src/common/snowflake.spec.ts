import { describe, expect, it } from "vitest";

import {
  DEFAULT_SNOWFLAKE_EPOCH_MS,
  SnowflakeGenerator,
} from "../common/snowflake.js";

const EPOCH = Date.UTC(2026, 8, 8);

describe("SnowflakeGenerator", () => {
  it("generates strictly increasing ids within the same millisecond", () => {
    const snowflake = new SnowflakeGenerator();
    const prev: bigint[] = [];
    for (let i = 0; i < 5000; i++) {
      const id = snowflake.nextId(EPOCH + 1000);
      expect(id).toBeGreaterThan(prev.at(-1) ?? 0n);
      prev.push(id);
    }
    expect(new Set(prev.map(String)).size).toBe(5000);
  });

  it("increases the timestamp component on sequence rollover", () => {
    const snowflake = new SnowflakeGenerator();
    let last = 0n;
    for (let i = 0; i < 5000; i++) {
      const id = snowflake.nextId(EPOCH + 1000);
      expect(id).toBeGreaterThan(last);
      last = id;
    }
  });

  it("embeds a distinct worker id in the id", () => {
    const a = new SnowflakeGenerator({ workerId: 0 });
    const b = new SnowflakeGenerator({ workerId: 5 });
    for (let i = 0; i < 100; i++) {
      const fromA = a.nextId(EPOCH + 2000);
      const fromB = b.nextId(EPOCH + 2000);
      expect(fromA).not.toBe(fromB);
    }
  });

  it("uses the custom epoch", () => {
    const defaultGen = new SnowflakeGenerator();
    const customGen = new SnowflakeGenerator({ epoch: EPOCH + 10_000 });
    const now = EPOCH + 20_000;
    const defaultId = defaultGen.nextId(now);
    const customId = customGen.nextId(now);
    expect(defaultId).toBeGreaterThan(customId);
  });

  it("throws when the clock is before the epoch", () => {
    const snowflake = new SnowflakeGenerator();
    expect(() => snowflake.nextId(EPOCH - 1)).toThrow(/epoch/);
  });

  it("throws for an out-of-range worker id", () => {
    expect(() => new SnowflakeGenerator({ workerId: 1024 })).toThrow(RangeError);
    expect(() => new SnowflakeGenerator({ workerId: -1 })).toThrow(RangeError);
  });

  it("returns decimal strings from nextIdString", () => {
    const snowflake = new SnowflakeGenerator();
    const id = snowflake.nextId(EPOCH + 3000);
    expect(snowflake.nextIdString(EPOCH + 3000)).toMatch(/^\d+$/);
    expect(/^\d+$/.test(id.toString())).toBe(true);
  });

  it("reports the default platform epoch", () => {
    expect(DEFAULT_SNOWFLAKE_EPOCH_MS).toBe(EPOCH);
  });
});