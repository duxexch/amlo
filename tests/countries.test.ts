/**
 * Tests for client/src/lib/countries.ts — Country data module
 */
import { describe, it, expect } from "vitest";
import { COUNTRIES, getCountryName, getCountryFlag } from "../client/src/lib/countries";

describe("COUNTRIES", () => {
  it("should have at least 40 countries", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(40);
  });

  it("every country should have code, flag, nameAr, nameEn", () => {
    for (const c of COUNTRIES) {
      expect(c.code).toBeTruthy();
      expect(c.flag).toBeTruthy();
      expect(c.nameAr).toBeTruthy();
      expect(c.nameEn).toBeTruthy();
    }
  });

  it("should have unique codes", () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("should include common countries", () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(codes).toContain("SA");
    expect(codes).toContain("EG");
    expect(codes).toContain("US");
  });
});

describe("getCountryName", () => {
  it("should return Arabic name for ar", () => {
    expect(getCountryName("SA", "ar")).toBe("السعودية");
  });

  it("should return English name for en", () => {
    expect(getCountryName("SA", "en")).toBe("Saudi Arabia");
  });

  it("should return code for unknown country", () => {
    expect(getCountryName("ZZ", "ar")).toBe("ZZ");
  });
});

describe("getCountryFlag", () => {
  it("should return flag emoji for known country", () => {
    const flag = getCountryFlag("EG");
    expect(flag).toBeTruthy();
    expect(flag).not.toBe("");
  });

  it("should return globe emoji for unknown country", () => {
    expect(getCountryFlag("ZZ")).toBe("🌍");
  });
});
