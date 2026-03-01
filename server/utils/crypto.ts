import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt.
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored bcrypt hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    return bcrypt.compareSync(password, stored);
  } catch {
    return false;
  }
}

/**
 * Hash a password asynchronously (preferred for production).
 */
export async function hashPasswordAsync(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password asynchronously (preferred for production).
 */
export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  try {
    return bcrypt.compare(password, stored);
  } catch {
    return false;
  }
}

/**
 * Generate a unique referral code.
 */
export function generateReferralCode(prefix = "APL"): string {
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
}

