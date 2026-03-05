/**
 * Tests for server/utils/sanitize.ts
 */
import { describe, it, expect } from "vitest";
import { sanitizeUser, sanitizeUsers } from "../server/utils/sanitize";

describe("sanitizeUser", () => {
  it("should strip all sensitive fields", () => {
    const user = {
      id: "1",
      username: "test",
      email: "test@example.com",
      passwordHash: "$2b$12$xxx",
      pinHash: "hash123",
      resetToken: "token",
      resetTokenExpiry: new Date(),
      verificationToken: "vtoken",
      twoFactorSecret: "ABCDEF123456",
      encryptionKey: "secret-key",
      displayName: "Test User",
      twoFactorEnabled: true,
    };

    const sanitized = sanitizeUser(user);

    expect(sanitized.id).toBe("1");
    expect(sanitized.username).toBe("test");
    expect(sanitized.email).toBe("test@example.com");
    expect(sanitized.displayName).toBe("Test User");
    expect(sanitized.twoFactorEnabled).toBe(true);

    // Sensitive fields should be stripped
    expect("passwordHash" in sanitized).toBe(false);
    expect("pinHash" in sanitized).toBe(false);
    expect("resetToken" in sanitized).toBe(false);
    expect("resetTokenExpiry" in sanitized).toBe(false);
    expect("verificationToken" in sanitized).toBe(false);
    expect("twoFactorSecret" in sanitized).toBe(false);
    expect("encryptionKey" in sanitized).toBe(false);
  });

  it("should not mutate the original object", () => {
    const user = { id: "1", passwordHash: "hash" };
    const sanitized = sanitizeUser(user);
    expect(user.passwordHash).toBe("hash");
    expect("passwordHash" in sanitized).toBe(false);
  });

  it("should handle objects with no sensitive fields", () => {
    const user = { id: "1", name: "Test" };
    const sanitized = sanitizeUser(user);
    expect(sanitized).toEqual({ id: "1", name: "Test" });
  });
});

describe("sanitizeUsers", () => {
  it("should sanitize an array of users", () => {
    const users = [
      { id: "1", username: "a", passwordHash: "x" },
      { id: "2", username: "b", passwordHash: "y" },
    ];
    const result = sanitizeUsers(users);
    expect(result).toHaveLength(2);
    expect("passwordHash" in result[0]).toBe(false);
    expect("passwordHash" in result[1]).toBe(false);
    expect(result[0].username).toBe("a");
  });
});
