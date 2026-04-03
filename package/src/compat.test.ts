import { describe, expect, it } from "vitest";

import {
  assertHostCompatibility,
  compareVersions,
  isHostVersionSupported,
  parseOpenClawVersion,
} from "./compat.js";

describe("compat", () => {
  it("parses date-based versions and strips prerelease suffixes", () => {
    expect(parseOpenClawVersion("2026.3.22-beta.1")).toEqual({
      year: 2026,
      month: 3,
      day: 22,
    });
    expect(parseOpenClawVersion("bad-version")).toBeNull();
  });

  it("compares versions correctly", () => {
    const older = parseOpenClawVersion("2026.3.21")!;
    const newer = parseOpenClawVersion("2026.3.22")!;

    expect(compareVersions(older, newer)).toBe(-1);
    expect(compareVersions(newer, older)).toBe(1);
    expect(compareVersions(newer, parseOpenClawVersion("2026.3.22")!)).toBe(0);
  });

  it("checks minimum host support", () => {
    expect(isHostVersionSupported("2026.3.22")).toBe(true);
    expect(isHostVersionSupported("2026.4.1")).toBe(true);
    expect(isHostVersionSupported("2026.3.21")).toBe(false);
    expect(isHostVersionSupported("unknown")).toBe(false);
  });

  it("throws on incompatible hosts", () => {
    expect(() => assertHostCompatibility("2026.3.21")).toThrow(/requires OpenClaw >=2026\.3\.22/);
  });

  it("allows missing host versions without failing fast", () => {
    expect(() => assertHostCompatibility(undefined)).not.toThrow();
    expect(() => assertHostCompatibility("unknown")).not.toThrow();
  });
});
