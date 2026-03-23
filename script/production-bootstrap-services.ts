// @ts-nocheck
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

function env(name: string, fallback = ""): string {
    return String(process.env[name] || fallback).trim();
}

function envBool(name: string, fallback: boolean): boolean {
    const v = env(name, "").toLowerCase();
    if (!v) return fallback;
    return v === "1" || v === "true" || v === "yes" || v === "on";
}

function envInt(name: string, fallback: number): number {
    const n = Number(env(name, ""));
    return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function hasRequired(values: string[]): boolean {
    return values.every((v) => {
        const x = String(v || "").trim();
        if (!x) return false;
        return !/^REPLACE_/i.test(x) && !/^CHANGE_ME/i.test(x);
    });
}

async function main() {
    const root = process.cwd();
    const envProdPath = path.join(root, ".env.production");
    const envPath = path.join(root, ".env");
    if (existsSync(envProdPath)) loadEnv({ path: envProdPath, override: false });
    if (existsSync(envPath)) loadEnv({ path: envPath, override: false });

    const { storage } = await import("../server/storage");
    const { getPool } = await import("../server/db");

    const apply = process.argv.includes("--execute") || process.argv.includes("--apply");

    const socialLogin = {
        google: {
            enabled: envBool("SOCIAL_GOOGLE_ENABLED", true) && hasRequired([env("SOCIAL_GOOGLE_CLIENT_ID"), env("SOCIAL_GOOGLE_CLIENT_SECRET")]),
            clientId: env("SOCIAL_GOOGLE_CLIENT_ID"),
            clientSecret: env("SOCIAL_GOOGLE_CLIENT_SECRET"),
        },
        apple: {
            enabled: envBool("SOCIAL_APPLE_ENABLED", true) && hasRequired([env("SOCIAL_APPLE_SERVICE_ID"), env("SOCIAL_APPLE_TEAM_ID"), env("SOCIAL_APPLE_KEY_ID")]),
            serviceId: env("SOCIAL_APPLE_SERVICE_ID"),
            teamId: env("SOCIAL_APPLE_TEAM_ID"),
            keyId: env("SOCIAL_APPLE_KEY_ID"),
        },
        facebook: {
            enabled: envBool("SOCIAL_FACEBOOK_ENABLED", false) && hasRequired([env("SOCIAL_FACEBOOK_APP_ID"), env("SOCIAL_FACEBOOK_APP_SECRET")]),
            appId: env("SOCIAL_FACEBOOK_APP_ID"),
            appSecret: env("SOCIAL_FACEBOOK_APP_SECRET"),
        },
        twitter: {
            enabled: envBool("SOCIAL_TWITTER_ENABLED", false) && hasRequired([env("SOCIAL_TWITTER_API_KEY"), env("SOCIAL_TWITTER_API_SECRET")]),
            apiKey: env("SOCIAL_TWITTER_API_KEY"),
            apiSecret: env("SOCIAL_TWITTER_API_SECRET"),
        },
        tiktok: {
            enabled: envBool("SOCIAL_TIKTOK_ENABLED", false) && hasRequired([env("SOCIAL_TIKTOK_CLIENT_KEY"), env("SOCIAL_TIKTOK_CLIENT_SECRET")]),
            clientKey: env("SOCIAL_TIKTOK_CLIENT_KEY"),
            clientSecret: env("SOCIAL_TIKTOK_CLIENT_SECRET"),
        },
        snapchat: {
            enabled: envBool("SOCIAL_SNAPCHAT_ENABLED", false) && hasRequired([env("SOCIAL_SNAPCHAT_CLIENT_ID"), env("SOCIAL_SNAPCHAT_CLIENT_SECRET")]),
            clientId: env("SOCIAL_SNAPCHAT_CLIENT_ID"),
            clientSecret: env("SOCIAL_SNAPCHAT_CLIENT_SECRET"),
        },
        instagram: {
            enabled: envBool("SOCIAL_INSTAGRAM_ENABLED", false) && hasRequired([env("SOCIAL_INSTAGRAM_APP_ID"), env("SOCIAL_INSTAGRAM_APP_SECRET")]),
            appId: env("SOCIAL_INSTAGRAM_APP_ID"),
            appSecret: env("SOCIAL_INSTAGRAM_APP_SECRET"),
        },
        huawei: {
            enabled: envBool("SOCIAL_HUAWEI_ENABLED", false) && hasRequired([env("SOCIAL_HUAWEI_APP_ID"), env("SOCIAL_HUAWEI_APP_SECRET")]),
            appId: env("SOCIAL_HUAWEI_APP_ID"),
            appSecret: env("SOCIAL_HUAWEI_APP_SECRET"),
        },
    };

    const otp = {
        provider: env("OTP_PROVIDER", "email"),
        enabled: envBool("OTP_ENABLED", true),
        gmail: {
            enabled: envBool("OTP_EMAIL_ENABLED", true),
            host: env("SMTP_HOST", "smtp.hostinger.com"),
            port: envInt("SMTP_PORT", 465),
            username: env("SMTP_USER"),
            password: env("SMTP_PASS"),
            senderName: env("SMTP_SENDER_NAME", "Ablox"),
            senderEmail: env("SMTP_SENDER_EMAIL", env("SMTP_USER")),
        },
        sms: {
            enabled: envBool("OTP_SMS_ENABLED", false) && hasRequired([env("SMS_API_KEY"), env("SMS_API_SECRET")]),
            provider: env("SMS_PROVIDER", "twilio"),
            phoneNumber: env("SMS_PHONE_NUMBER"),
            apiKey: env("SMS_API_KEY"),
            apiSecret: env("SMS_API_SECRET"),
            senderId: env("SMS_SENDER_ID"),
        },
        otpConfig: {
            codeLength: envInt("OTP_CODE_LENGTH", 6),
            expiryMinutes: envInt("OTP_EXPIRY_MINUTES", 5),
            maxAttempts: envInt("OTP_MAX_ATTEMPTS", 5),
            cooldownMinutes: envInt("OTP_COOLDOWN_MINUTES", 5),
        },
    };

    const appDownload = {
        enabled: envBool("APP_DOWNLOAD_ENABLED", true),
        domain: env("APP_DOWNLOAD_DOMAIN", "https://mrco.live"),
        rollout: {
            enabled: envBool("APP_DOWNLOAD_ROLLOUT_ENABLED", false),
            apkPercent: envInt("APP_DOWNLOAD_APK_PERCENT", 100),
            aabPercent: envInt("APP_DOWNLOAD_AAB_PERCENT", 100),
            allowTenants: env("APP_DOWNLOAD_ALLOW_TENANTS").split(",").map((v) => v.trim()).filter(Boolean),
            blockTenants: env("APP_DOWNLOAD_BLOCK_TENANTS").split(",").map((v) => v.trim()).filter(Boolean),
        },
        pwa: {
            enabled: envBool("PWA_ENABLED", true),
            url: env("PWA_URL", "https://mrco.live"),
            extension: "/",
            description: "نسخة الويب — تعمل من المتصفح مباشرة بدون تحميل",
        },
        apk: {
            enabled: envBool("APK_ENABLED", true),
            url: env("APK_URL", "https://mrco.live/download/ablox.apk"),
            extension: ".apk",
            description: "ملف APK — للتثبيت المباشر على أجهزة أندرويد",
            version: env("APK_VERSION"),
            build: env("APK_BUILD"),
            checksum: env("APK_SHA256"),
            sizeBytes: envInt("APK_SIZE_BYTES", 0),
        },
        aab: {
            enabled: envBool("AAB_ENABLED", true),
            url: env("AAB_URL", "https://mrco.live/download/ablox.aab"),
            extension: ".aab",
            description: "ملف AAB — لرفعه على متجر جوجل بلاي",
            version: env("AAB_VERSION"),
            build: env("AAB_BUILD"),
            checksum: env("AAB_SHA256"),
            sizeBytes: envInt("AAB_SIZE_BYTES", 0),
        },
    };

    const gateways = {
        stripe: {
            enabled: envBool("GATEWAY_STRIPE_ENABLED", true) && hasRequired([env("GATEWAY_STRIPE_PUBLIC_KEY"), env("GATEWAY_STRIPE_SECRET_KEY")]),
            displayName: "Stripe",
            countries: ["*"],
            mode: env("GATEWAY_STRIPE_MODE", "live"),
            priority: 1,
            credentials: {
                publicKey: env("GATEWAY_STRIPE_PUBLIC_KEY"),
                secretKey: env("GATEWAY_STRIPE_SECRET_KEY"),
                webhookSecret: env("GATEWAY_STRIPE_WEBHOOK_SECRET"),
            },
        },
        paypal: {
            enabled: envBool("GATEWAY_PAYPAL_ENABLED", false) && hasRequired([env("GATEWAY_PAYPAL_CLIENT_ID"), env("GATEWAY_PAYPAL_CLIENT_SECRET")]),
            displayName: "PayPal",
            countries: ["*"],
            mode: env("GATEWAY_PAYPAL_MODE", "live"),
            priority: 2,
            credentials: {
                clientId: env("GATEWAY_PAYPAL_CLIENT_ID"),
                clientSecret: env("GATEWAY_PAYPAL_CLIENT_SECRET"),
                webhookId: env("GATEWAY_PAYPAL_WEBHOOK_ID"),
            },
        },
        paymob: {
            enabled: envBool("GATEWAY_PAYMOB_ENABLED", false) && hasRequired([env("GATEWAY_PAYMOB_API_KEY"), env("GATEWAY_PAYMOB_INTEGRATION_ID")]),
            displayName: "Paymob",
            countries: ["EG", "AE", "SA", "JO"],
            mode: env("GATEWAY_PAYMOB_MODE", "live"),
            priority: 3,
            credentials: {
                apiKey: env("GATEWAY_PAYMOB_API_KEY"),
                integrationId: env("GATEWAY_PAYMOB_INTEGRATION_ID"),
                iframeId: env("GATEWAY_PAYMOB_IFRAME_ID"),
                hmacSecret: env("GATEWAY_PAYMOB_HMAC_SECRET"),
            },
        },
        myfatoorah: {
            enabled: envBool("GATEWAY_MYFATOORAH_ENABLED", false) && hasRequired([env("GATEWAY_MYFATOORAH_API_TOKEN")]),
            displayName: "MyFatoorah",
            countries: ["SA", "AE", "KW", "QA", "BH", "OM"],
            mode: env("GATEWAY_MYFATOORAH_MODE", "live"),
            priority: 4,
            credentials: {
                apiToken: env("GATEWAY_MYFATOORAH_API_TOKEN"),
                webhookSecret: env("GATEWAY_MYFATOORAH_WEBHOOK_SECRET"),
            },
        },
        tap: {
            enabled: envBool("GATEWAY_TAP_ENABLED", false) && hasRequired([env("GATEWAY_TAP_SECRET_KEY"), env("GATEWAY_TAP_PUBLIC_KEY")]),
            displayName: "Tap Payments",
            countries: ["SA", "AE", "KW", "BH", "QA", "OM"],
            mode: env("GATEWAY_TAP_MODE", "live"),
            priority: 5,
            credentials: {
                secretKey: env("GATEWAY_TAP_SECRET_KEY"),
                publicKey: env("GATEWAY_TAP_PUBLIC_KEY"),
                webhookSecret: env("GATEWAY_TAP_WEBHOOK_SECRET"),
            },
        },
        moyasar: {
            enabled: envBool("GATEWAY_MOYASAR_ENABLED", false) && hasRequired([env("GATEWAY_MOYASAR_SECRET_KEY"), env("GATEWAY_MOYASAR_PUBLISHABLE_KEY")]),
            displayName: "Moyasar",
            countries: ["SA"],
            mode: env("GATEWAY_MOYASAR_MODE", "live"),
            priority: 6,
            credentials: {
                secretKey: env("GATEWAY_MOYASAR_SECRET_KEY"),
                publishableKey: env("GATEWAY_MOYASAR_PUBLISHABLE_KEY"),
                webhookSecret: env("GATEWAY_MOYASAR_WEBHOOK_SECRET"),
            },
        },
    };

    const preview = {
        socialLogin,
        otp,
        appDownload,
        gateways,
    };

    const previewPath = path.join(root, "qa", "results", "production-bootstrap-preview.json");
    writeFileSync(previewPath, JSON.stringify(preview, null, 2), "utf8");

    if (!apply) {
        console.log("=== Production Provider Bootstrap (dry-run) ===");
        console.log(`Preview: ${previewPath}`);
        console.log("Run with --execute to write to database.");
        return;
    }

    try {
        const checks = await storage.getAllSystemConfigs();
        if (!checks) {
            console.error("Database is not available. Cannot bootstrap production providers.");
            process.exit(1);
        }

        await storage.upsertSystemConfig("socialLogin", socialLogin);
        await storage.upsertSystemConfig("otp", otp);
        await storage.upsertSystemConfig("appDownload", appDownload);
        await storage.upsertSetting("payment_gateways_config", JSON.stringify(gateways), "payments", "Payment gateway providers and credentials");

        console.log("=== Production Provider Bootstrap Complete ===");
        console.log("Updated categories: socialLogin, otp, appDownload, payment_gateways_config");
    } finally {
        const pool = getPool();
        if (pool) {
            await pool.end();
        }
    }
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
