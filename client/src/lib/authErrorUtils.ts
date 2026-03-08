export type AuthFieldErrors = Record<string, string>;

export type AuthUiError = {
    status: number;
    code: string;
    message: string;
    hint: string;
    retryAfterSeconds: number;
    fieldErrors: AuthFieldErrors;
    attemptsRemaining?: number;
    attemptsMax?: number;
};

function clampRetry(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(Math.floor(n), 24 * 60 * 60);
}

function sanitizeFieldErrors(value: unknown): AuthFieldErrors {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([k, v]) => typeof k === "string" && k.trim() && typeof v === "string" && String(v).trim())
            .map(([k, v]) => [k, String(v).trim()]),
    );
}

export function normalizeAuthUiError(
    err: any,
    t: (key: string, fallback?: string) => string,
): AuthUiError {
    const status = Number(err?.status || 0);
    const code = String(err?.code || "AUTH_UNKNOWN_ERROR");
    const message = String(err?.message || t("auth.error", "حدث خطأ، حاول مرة أخرى"));
    const retryAfterSeconds = clampRetry(err?.retryAfterSeconds || err?.cooldownSeconds);
    const fieldErrors = sanitizeFieldErrors(err?.fieldErrors);

    let hint = t("auth.hintGeneric", "راجع البيانات المدخلة ثم أعد المحاولة.");
    if (status === 400 || code === "AUTH_VALIDATION_ERROR") {
        hint = t("auth.hintValidation", "تحقق من الحقول المميزة بالخطأ وصححها ثم أعد المحاولة.");
    } else if (status === 401 || code === "INVALID_CREDENTIALS") {
        hint = t("auth.hintInvalidCredentials", "تأكد من البريد/اسم المستخدم وكلمة المرور، ثم حاول مرة أخرى.");
    } else if (status === 409 || code === "EMAIL_ALREADY_EXISTS" || code === "USERNAME_ALREADY_EXISTS") {
        hint = t("auth.hintAlreadyExists", "استخدم بيانات مختلفة أو انتقل لتسجيل الدخول إذا كان لديك حساب بالفعل.");
    } else if (status === 429 || code.includes("RATE_LIMIT") || code === "LOGIN_TEMP_LOCKED") {
        hint = t("auth.hintRateLimited", "عدد المحاولات كبير. انتظر حتى تنتهي المهلة ثم أعد المحاولة.");
    } else if (status === 503 || code === "OTP_SERVICE_UNAVAILABLE") {
        hint = t("auth.hintServiceUnavailable", "الخدمة غير متاحة مؤقتاً. حاول مجدداً بعد قليل.");
    }

    const attemptsRemaining = Number.isFinite(Number(err?.attemptsRemaining))
        ? Number(err.attemptsRemaining)
        : undefined;
    const attemptsMax = Number.isFinite(Number(err?.attemptsMax))
        ? Number(err.attemptsMax)
        : undefined;

    return {
        status,
        code,
        message,
        hint,
        retryAfterSeconds,
        fieldErrors,
        attemptsRemaining,
        attemptsMax,
    };
}

export function mapAuthFieldErrorsForForm(fieldErrors: AuthFieldErrors, isLogin: boolean): AuthFieldErrors {
    const mapped: AuthFieldErrors = { ...fieldErrors };
    if (isLogin && mapped.login && !mapped.email) {
        mapped.email = mapped.login;
    }
    return mapped;
}
