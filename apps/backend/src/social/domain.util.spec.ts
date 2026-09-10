/**
 * Unit tests for the email domain allow-list gate.
 */
import { describe, expect, it } from "vitest";
import { isEmailDomainAllowed } from "./domain.util.js";

const ALLOWED = ["inft.kr"];

describe("isEmailDomainAllowed", () => {
  it("accepts an email matching an allowed domain", () => {
    expect(isEmailDomainAllowed("user@inft.kr", ALLOWED)).toBe(true);
  });

  it("accepts differing case in the domain", () => {
    expect(isEmailDomainAllowed("User@INFT.KR", ALLOWED)).toBe(true);
  });

  it("rejects a foreign domain", () => {
    expect(isEmailDomainAllowed("user@gmail.com", ALLOWED)).toBe(false);
  });

  it("rejects a subdomain of an allowed domain", () => {
    expect(isEmailDomainAllowed("user@evil.inft.kr", ALLOWED)).toBe(false);
  });

  it("rejects emails without a domain", () => {
    expect(isEmailDomainAllowed("not-an-email", ALLOWED)).toBe(false);
    expect(isEmailDomainAllowed("a@", ALLOWED)).toBe(false);
  });

  it("rejects when the allow-list is empty", () => {
    expect(isEmailDomainAllowed("user@inft.kr", [])).toBe(false);
  });
});