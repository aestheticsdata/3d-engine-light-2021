import { parseCustomFrameRate } from "@ui/inspector/controls/customFrameRate";
import { describe, expect, it } from "vitest";

describe("parseCustomFrameRate", () => {
  it("returns the typed number unchanged when it's within range", () => {
    expect(parseCustomFrameRate("90")).toBe(90);
  });

  it("rounds a fractional value to the nearest integer", () => {
    expect(parseCustomFrameRate("119.6")).toBe(120);
  });

  it("clamps a value above the range down to the maximum", () => {
    expect(parseCustomFrameRate("1000")).toBe(240);
  });

  it("clamps a value at or below zero up to the minimum", () => {
    expect(parseCustomFrameRate("0")).toBe(1);
    expect(parseCustomFrameRate("-30")).toBe(1);
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(parseCustomFrameRate("")).toBeNull();
    expect(parseCustomFrameRate("   ")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseCustomFrameRate("abc")).toBeNull();
  });
});
