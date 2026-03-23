// @ts-nocheck
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type DecisionPayload = {
    decision?: string;
};

function readDecision(filePath: string): string {
    if (!existsSync(filePath)) return "MISSING";
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as DecisionPayload;
    return String(raw.decision || "UNKNOWN").toUpperCase();
}

function main() {
    const root = process.cwd();
    const outPath = path.join(root, "qa", "results", "final-qa-report.json");
    const lifecyclePath = path.join(root, "qa", "results", "install-lifecycle-summary.json");
    const compatibilityPath = path.join(root, "qa", "results", "compatibility-summary.json");
    const callPath = path.join(root, "qa", "results", "call-setup-summary.json");
    const reliabilityPath = path.join(root, "qa", "results", "reliability-summary.json");
    const metricsPath = path.join(root, "qa", "results", "current-run.json");

    const lifecycleDecision = readDecision(lifecyclePath);
    const compatibilityDecision = readDecision(compatibilityPath);
    const callDecision = readDecision(callPath);
    const reliabilityDecision = readDecision(reliabilityPath);
    const metricsPresent = existsSync(metricsPath);

    const checks = [
        { key: "metricsInput", ok: metricsPresent, value: metricsPresent ? "PRESENT" : "MISSING", expected: "PRESENT" },
        { key: "lifecycleDecision", ok: lifecycleDecision === "PASS", value: lifecycleDecision, expected: "PASS" },
        { key: "compatibilityDecision", ok: compatibilityDecision === "PASS", value: compatibilityDecision, expected: "PASS" },
        { key: "callDecision", ok: callDecision === "PASS", value: callDecision, expected: "PASS" },
        { key: "reliabilityDecision", ok: reliabilityDecision === "PASS", value: reliabilityDecision, expected: "PASS" },
    ];

    const failedChecks = checks.filter((c) => !c.ok);
    const report = {
        generatedAt: new Date().toISOString(),
        inputs: {
            metricsPath,
            lifecyclePath,
            compatibilityPath,
            callPath,
            reliabilityPath,
        },
        checks,
        failedChecks,
        decision: failedChecks.length === 0 ? "PASS" : "IN_PROGRESS",
    };

    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    console.log("=== AMLO Final QA Report (Stage 61) ===");
    console.log(`Report: ${outPath}`);
    for (const c of checks) {
        console.log(`${c.ok ? "PASS" : "FAIL"}: ${c.key}=${c.value} (expected ${c.expected})`);
    }
    console.log(`Decision: ${report.decision}`);
}

main();
