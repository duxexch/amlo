import { describe, expect, it } from "vitest";
import { mapAuthFieldErrorsForForm, normalizeAuthUiError } from "../client/src/lib/authErrorUtils";

const t = (_k: string, fallback?: string) => fallback || "";

describe("authErrorUtils", () => {
    it("normalizes rate-limit error with retry", () => {
        const out = normalizeAuthUiError(
            {
                status: 429,
                code: "LOGIN_TEMP_LOCKED",
                message: "too many attempts",
                retryAfterSeconds: 75,
                attemptsRemaining: 0,
                attemptsMax: 5,
            },
            t,
        );

        expect(out.status).toBe(429);
        expect(out.retryAfterSeconds).toBe(75);
        expect(out.attemptsRemaining).toBe(0);
        expect(out.attemptsMax).toBe(5);
        expect(out.hint).toContain("انتظر");
    });

    it("keeps field errors and maps login field to email for login form", () => {
        const out = normalizeAuthUiError(
            {
                status: 400,
                code: "AUTH_VALIDATION_ERROR",
                message: "invalid",
                fieldErrors: { login: "required" },
            },
            t,
        );

        const mapped = mapAuthFieldErrorsForForm(out.fieldErrors, true);
        expect(mapped.email).toBe("required");
    });

    it("falls back to generic message and hint", () => {
        const out = normalizeAuthUiError({}, t);
        expect(out.message).toContain("حدث خطأ");
        expect(out.hint).toContain("راجع");
    });
});
