/**
 * Tests for server/utils/crypto.ts
 */
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashPasswordAsync,
  verifyPasswordAsync,
  generateReferralCode,
} from "../server/utils/crypto";

describe("crypto utils", () => {
  describe("hashPassword / verifyPassword (sync)", () => {
    it("should hash and verify a password", () => {
      const hash = hashPassword("test123");
      expect(hash).toBeTruthy();
      expect(hash).not.toBe("test123");
      expect(verifyPassword("test123", hash)).toBe(true);
    });

    it("should reject wrong password", () => {
      const hash = hashPassword("correct");
      expect(verifyPassword("wrong", hash)).toBe(false);
    });

    it("should return false for invalid hash", () => {
      expect(verifyPassword("test", "notahash")).toBe(false);
    });
  });

  describe("hashPasswordAsync / verifyPasswordAsync", () => {
    it("should hash and verify a password async", async () => {
      const hash = await hashPasswordAsync("async123");
      expect(hash).toBeTruthy();
      expect(await verifyPasswordAsync("async123", hash)).toBe(true);
    });

    it("should reject wrong password async", async () => {
      const hash = await hashPasswordAsync("correct");
      expect(await verifyPasswordAsync("wrong", hash)).toBe(false);
    });
  });

  describe("generateReferralCode", () => {
    it("should generate a code with default prefix", () => {
      const code = generateReferralCode();
      expect(code).toMatch(/^APL-[A-F0-9]{8}$/);
    });

    it("should use custom prefix", () => {
      const code = generateReferralCode("REF");
      expect(code).toMatch(/^REF-[A-F0-9]{8}$/);
    });

    it("should generate unique codes", () => {
      const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
      expect(codes.size).toBe(100);
    });
  });
});
