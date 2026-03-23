// @ts-nocheck
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type GateInput = {
    releaseCandidate?: string;
    executedAt?: string;
    crashFreeSessionsPct: number;
    anrRatePct: number;
    callSetupSuccessPct: number;
    callDropRatePct: number;
    pushDeliverySuccessPct: number;
    loginSuccessPct: number;
    apkInstallSuccessPct: number;
    aabPrelaunchCriticalIssues: number;
    blockers?: Array<{
        id?: string;
        severity?: string;
        status?: string;
        area?: string;
        title?: string;
    }>;
};

type AuditSummary = {
    decision?: string;
};

type GateThresholds = {
    minCrashFreeSessionsPct: number;
    maxAnrRatePct: number;
    minCallSetupSuccessPct: number;
    maxCallDropRatePct: number;
    minPushDeliverySuccessPct: number;
    minLoginSuccessPct: number;
    minApkInstallSuccessPct: number;
    maxAabPrelaunchCriticalIssues: number;
};

const DEFAULT_THRESHOLDS: GateThresholds = {
    minCrashFreeSessionsPct: 99.5,
    maxAnrRatePct: 0.5,
    minCallSetupSuccessPct: 98,
    maxCallDropRatePct: 2,
    minPushDeliverySuccessPct: 97,
    minLoginSuccessPct: 99,
    minApkInstallSuccessPct: 99,
    maxAabPrelaunchCriticalIssues: 0,
};

const OPEN_BLOCKER_STATUSES = new Set(["open", "new", "in_progress", "reopened", "blocked"]);
const BLOCKING_SEVERITIES = new Set(["P0", "P1"]);

function projectRoot() {
    return process.cwd();
}

function parseThresholds(filePath: string): GateThresholds {
    if (!existsSync(filePath)) {
        return DEFAULT_THRESHOLDS;
    }
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    return {
        minCrashFreeSessionsPct: Number(raw.minCrashFreeSessionsPct ?? DEFAULT_THRESHOLDS.minCrashFreeSessionsPct),
        maxAnrRatePct: Number(raw.maxAnrRatePct ?? DEFAULT_THRESHOLDS.maxAnrRatePct),
        minCallSetupSuccessPct: Number(raw.minCallSetupSuccessPct ?? DEFAULT_THRESHOLDS.minCallSetupSuccessPct),
        maxCallDropRatePct: Number(raw.maxCallDropRatePct ?? DEFAULT_THRESHOLDS.maxCallDropRatePct),
        minPushDeliverySuccessPct: Number(raw.minPushDeliverySuccessPct ?? DEFAULT_THRESHOLDS.minPushDeliverySuccessPct),
        minLoginSuccessPct: Number(raw.minLoginSuccessPct ?? DEFAULT_THRESHOLDS.minLoginSuccessPct),
        minApkInstallSuccessPct: Number(raw.minApkInstallSuccessPct ?? DEFAULT_THRESHOLDS.minApkInstallSuccessPct),
        maxAabPrelaunchCriticalIssues: Number(raw.maxAabPrelaunchCriticalIssues ?? DEFAULT_THRESHOLDS.maxAabPrelaunchCriticalIssues),
    };
}

function parseInput(filePath: string): GateInput {
    if (!existsSync(filePath)) {
        throw new Error(`Missing QA input file: ${filePath}`);
    }
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    return {
        crashFreeSessionsPct: Number(raw.crashFreeSessionsPct ?? 0),
        anrRatePct: Number(raw.anrRatePct ?? 100),
        callSetupSuccessPct: Number(raw.callSetupSuccessPct ?? 0),
        callDropRatePct: Number(raw.callDropRatePct ?? 100),
        pushDeliverySuccessPct: Number(raw.pushDeliverySuccessPct ?? 0),
        loginSuccessPct: Number(raw.loginSuccessPct ?? 0),
        apkInstallSuccessPct: Number(raw.apkInstallSuccessPct ?? 0),
        aabPrelaunchCriticalIssues: Number(raw.aabPrelaunchCriticalIssues ?? 999),
    };
}

function parseAuditDecision(filePath: string): string {
    if (!existsSync(filePath)) {
        return "MISSING";
    }
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as AuditSummary;
    return String(raw?.decision || "UNKNOWN").toUpperCase();
}

function evaluate(
    input: GateInput,
    t: GateThresholds,
    lifecycleDecision: string,
    compatibilityDecision: string,
    callAuditDecision: string,
    reliabilityDecision: string,
    finalReportDecision: string,
) {
    const checks = [
        { key: "crashFreeSessionsPct", ok: input.crashFreeSessionsPct >= t.minCrashFreeSessionsPct, value: input.crashFreeSessionsPct, expected: `>= ${t.minCrashFreeSessionsPct}` },
        { key: "anrRatePct", ok: input.anrRatePct < t.maxAnrRatePct, value: input.anrRatePct, expected: `< ${t.maxAnrRatePct}` },
        { key: "callSetupSuccessPct", ok: input.callSetupSuccessPct >= t.minCallSetupSuccessPct, value: input.callSetupSuccessPct, expected: `>= ${t.minCallSetupSuccessPct}` },
        { key: "callDropRatePct", ok: input.callDropRatePct <= t.maxCallDropRatePct, value: input.callDropRatePct, expected: `<= ${t.maxCallDropRatePct}` },
        { key: "pushDeliverySuccessPct", ok: input.pushDeliverySuccessPct >= t.minPushDeliverySuccessPct, value: input.pushDeliverySuccessPct, expected: `>= ${t.minPushDeliverySuccessPct}` },
        { key: "loginSuccessPct", ok: input.loginSuccessPct >= t.minLoginSuccessPct, value: input.loginSuccessPct, expected: `>= ${t.minLoginSuccessPct}` },
        { key: "apkInstallSuccessPct", ok: input.apkInstallSuccessPct >= t.minApkInstallSuccessPct, value: input.apkInstallSuccessPct, expected: `>= ${t.minApkInstallSuccessPct}` },
        { key: "aabPrelaunchCriticalIssues", ok: input.aabPrelaunchCriticalIssues <= t.maxAabPrelaunchCriticalIssues, value: input.aabPrelaunchCriticalIssues, expected: `<= ${t.maxAabPrelaunchCriticalIssues}` },
        { key: "lifecycleAuditDecision", ok: lifecycleDecision === "PASS", value: lifecycleDecision, expected: "PASS" },
        { key: "compatibilityAuditDecision", ok: compatibilityDecision === "PASS", value: compatibilityDecision, expected: "PASS" },
        { key: "callAuditDecision", ok: callAuditDecision === "PASS", value: callAuditDecision, expected: "PASS" },
        { key: "reliabilityAuditDecision", ok: reliabilityDecision === "PASS", value: reliabilityDecision, expected: "PASS" },
        { key: "finalQaReportDecision", ok: finalReportDecision === "PASS", value: finalReportDecision, expected: "PASS" },
    ];

    const failed = checks.filter((c) => !c.ok);

    const blockers = Array.isArray(input.blockers) ? input.blockers : [];
    const openBlockingBlockers = blockers.filter((b) => {
        const severity = String(b.severity || "").toUpperCase();
        const status = String(b.status || "").toLowerCase();
        return BLOCKING_SEVERITIES.has(severity) && OPEN_BLOCKER_STATUSES.has(status);
    });

    return {
        checks,
        failed,
        openBlockingBlockers,
        decision: failed.length === 0 && openBlockingBlockers.length === 0 ? "GO" : "NO-GO",
    };
}

function main() {
    const isDryRun = process.argv.includes("--dry-run");
    const inputPath = path.join(projectRoot(), "qa", "results", "current-run.json");
    const thresholdsPath = path.join(projectRoot(), "qa", "thresholds.json");
    const lifecycleAuditPath = path.join(projectRoot(), "qa", "results", "install-lifecycle-summary.json");
    const compatibilityAuditPath = path.join(projectRoot(), "qa", "results", "compatibility-summary.json");
    const callAuditPath = path.join(projectRoot(), "qa", "results", "call-setup-summary.json");
    const reliabilityAuditPath = path.join(projectRoot(), "qa", "results", "reliability-summary.json");
    const finalQaReportPath = path.join(projectRoot(), "qa", "results", "final-qa-report.json");
    const decisionOutPath = path.join(projectRoot(), "qa", "results", "go-no-go-decision.json");
    const thresholds = parseThresholds(thresholdsPath);

    console.log("=== AMLO Mobile Go/No-Go Gate ===");
    console.log(`Mode: ${isDryRun ? "dry-run" : "execute"}`);
    console.log(`Input: ${inputPath}`);
    console.log(`Lifecycle audit: ${lifecycleAuditPath}`);
    console.log(`Compatibility audit: ${compatibilityAuditPath}`);
    console.log(`Call audit: ${callAuditPath}`);
    console.log(`Reliability audit: ${reliabilityAuditPath}`);
    console.log(`Final QA report: ${finalQaReportPath}`);

    if (isDryRun) {
        const sample: GateInput = {
            releaseCandidate: "dry-run-rc",
            executedAt: new Date().toISOString(),
            crashFreeSessionsPct: 99.7,
            anrRatePct: 0.3,
            callSetupSuccessPct: 98.4,
            callDropRatePct: 1.6,
            pushDeliverySuccessPct: 97.5,
            loginSuccessPct: 99.4,
            apkInstallSuccessPct: 99.2,
            aabPrelaunchCriticalIssues: 0,
            blockers: [
                {
                    id: "MOB-DRY-001",
                    severity: "P2",
                    status: "resolved",
                    area: "qa",
                    title: "Non-blocking sample issue",
                },
            ],
        };
        const report = evaluate(sample, thresholds, "PASS", "PASS", "PASS", "PASS", "PASS");
        for (const check of report.checks) {
            console.log(`${check.ok ? "PASS" : "FAIL"}: ${check.key}=${check.value} (expected ${check.expected})`);
        }
        if (report.openBlockingBlockers.length > 0) {
            console.log("BLOCKERS: open P0/P1 found");
            for (const b of report.openBlockingBlockers) {
                console.log(`- ${b.id || "unknown"} [${b.severity}] ${b.status}: ${b.title || ""}`);
            }
        } else {
            console.log("BLOCKERS: none (open P0/P1)");
        }
        console.log(`Decision: ${report.decision}`);
        process.exit(report.decision === "GO" ? 0 : 1);
    }

    const input = parseInput(inputPath);
    const lifecycleDecision = parseAuditDecision(lifecycleAuditPath);
    const compatibilityDecision = parseAuditDecision(compatibilityAuditPath);
    const callAuditDecision = parseAuditDecision(callAuditPath);
    const reliabilityDecision = parseAuditDecision(reliabilityAuditPath);
    const finalReportDecision = parseAuditDecision(finalQaReportPath);
    const report = evaluate(
        input,
        thresholds,
        lifecycleDecision,
        compatibilityDecision,
        callAuditDecision,
        reliabilityDecision,
        finalReportDecision,
    );

    for (const check of report.checks) {
        console.log(`${check.ok ? "PASS" : "FAIL"}: ${check.key}=${check.value} (expected ${check.expected})`);
    }

    if (report.openBlockingBlockers.length > 0) {
        console.log("BLOCKERS: open P0/P1 found");
        for (const b of report.openBlockingBlockers) {
            console.log(`- ${b.id || "unknown"} [${b.severity}] ${b.status}: ${b.title || ""}`);
        }
    } else {
        console.log("BLOCKERS: none (open P0/P1)");
    }

    console.log(`Decision: ${report.decision}`);
    writeFileSync(
        decisionOutPath,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                decision: report.decision,
                checks: report.checks,
                failed: report.failed,
                openBlockingBlockers: report.openBlockingBlockers,
            },
            null,
            2,
        ),
        "utf8",
    );
    console.log(`Decision report: ${decisionOutPath}`);
    if (report.decision !== "GO") {
        process.exit(1);
    }
}

main();
