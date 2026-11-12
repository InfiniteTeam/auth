import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { ListAdminSessionsQueryDto } from "./session-admin.dto.js";

describe("ListAdminSessionsQueryDto", () => {
  it("parses both activeOnly values and rejects invalid values", () => {
    for (const [input, expected] of [
      ["true", true],
      ["false", false],
    ] as const) {
      const query = plainToInstance(ListAdminSessionsQueryDto, {
        activeOnly: input,
      });
      expect(validateSync(query)).toEqual([]);
      expect(query.activeOnly).toBe(expected);
    }

    expect(
      validateSync(
        plainToInstance(ListAdminSessionsQueryDto, { activeOnly: "other" }),
      ),
    ).not.toEqual([]);
  });
});
