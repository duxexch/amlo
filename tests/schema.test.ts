/**
 * Tests for shared/schema.ts — Zod validation schemas
 */
import { describe, it, expect } from "vitest";
import {
  userRegisterSchema,
  userLoginSchema,
  forgotPasswordSchema,
  sendMessageSchema,
  initiateCallSchema,
  adminLoginSchema,
  createGiftSchema,
  banUserSchema,
} from "../shared/schema";

describe("userRegisterSchema", () => {
  it("should accept valid registration data", () => {
    const result = userRegisterSchema.safeParse({
      username: "testuser",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty username", () => {
    const result = userRegisterSchema.safeParse({
      username: "",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = userRegisterSchema.safeParse({
      username: "testuser",
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = userRegisterSchema.safeParse({
      username: "testuser",
      email: "test@example.com",
      password: "12",
    });
    expect(result.success).toBe(false);
  });
});

describe("userLoginSchema", () => {
  it("should accept valid login data", () => {
    const result = userLoginSchema.safeParse({
      login: "testuser",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty login", () => {
    const result = userLoginSchema.safeParse({
      login: "",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("should accept valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("sendMessageSchema", () => {
  it("should accept text message", () => {
    const result = sendMessageSchema.safeParse({
      receiverId: "user-123",
      content: "Hello!",
      type: "text",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty content", () => {
    const result = sendMessageSchema.safeParse({
      receiverId: "user-123",
      content: "",
      type: "text",
    });
    expect(result.success).toBe(false);
  });
});

describe("initiateCallSchema", () => {
  it("should accept valid call initiation", () => {
    const result = initiateCallSchema.safeParse({
      receiverId: "user-123",
      type: "video",
    });
    expect(result.success).toBe(true);
  });

  it("should accept voice type", () => {
    const result = initiateCallSchema.safeParse({
      receiverId: "user-123",
      type: "voice",
    });
    expect(result.success).toBe(true);
  });
});

describe("adminLoginSchema", () => {
  it("should accept valid admin login", () => {
    const result = adminLoginSchema.safeParse({
      username: "admin",
      password: "adminpass123",
    });
    expect(result.success).toBe(true);
  });
});

describe("createGiftSchema", () => {
  it("should accept valid gift data", () => {
    const result = createGiftSchema.safeParse({
      name: "Diamond Ring",
      nameAr: "خاتم ألماس",
      icon: "💎",
      price: 100,
      category: "premium",
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative price", () => {
    const result = createGiftSchema.safeParse({
      name: "Gift",
      nameAr: "هدية",
      icon: "🎁",
      price: -10,
      category: "general",
    });
    expect(result.success).toBe(false);
  });
});

describe("banUserSchema", () => {
  it("should accept ban with reason", () => {
    const result = banUserSchema.safeParse({
      userId: "user-123",
      reason: "Spam",
    });
    expect(result.success).toBe(true);
  });
});
