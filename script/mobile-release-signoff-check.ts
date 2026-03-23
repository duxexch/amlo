// @ts-nocheck
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function readDecision(filePath: string): string {
    if (!existsSync(filePath)) return "MISSING";
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    return String(raw?.decision || "UNKNOWN").toUpperCase();
}

function main() {
    const root = process.cwd();
    const goNoGoPath = path.join(root, "qa", "results", "go-no-go-decision.json");
    const finalQaPath = path.join(root, "qa", "results", "final-qa-report.json");
    const rollbackRunbookPath = path.join(root, "RUNBOOK-PROD-DEPLOY-AND-MONITORING.md");
    const boardPath = path.join(root, "qa", "release-decision-board.md");
    const outPath = path.join(root, "qa", "results", "release-signoff-readiness.json");

    const goNoGoDecision = readDecision(goNoGoPath);
    const finalQaDecision = readDecision(finalQaPath);

    const checks = [
        { key: "goNoGoDecision", ok: goNoGoDecision === "GO", value: goNoGoDecision, expected: "GO" },
        { key: "finalQaDecision", ok: finalQaDecision === "PASS", value: finalQaDecision, expected: "PASS" },
        { key: "rollbackRunbook", ok: existsSync(rollbackRunbookPath), value: existsSync(rollbackRunbookPath) ? "PRESENT" : "MISSING", expected: "PRESENT" },
        { key: "decisionBoardTemplate", ok: existsSync(boardPath), value: existsSync(boardPath) ? "PRESENT" : "MISSING", expected: "PRESENT" },
    ];

    const failedChecks = checks.filter((c) => !c.ok);
    const report = {
        generatedAt: new Date().toISOString(),
        checks,
        failedChecks,
        decision: failedChecks.length === 0 ? "READY" : "NOT_READY",
    };

    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    console.log("=== AMLO Release Signoff Readiness (Stage 63) ===");
    console.log(`Report: ${outPath}`);
    for (const c of checks) {
        console.log(`${c.ok ? "PASS" : "FAIL"}: ${c.key}=${c.value} (expected ${c.expected})`);
    }
    console.log(`Decision: ${report.decision}`);

    if (report.decision !== "READY") {
        process.exit(1);
    }
}

main();
