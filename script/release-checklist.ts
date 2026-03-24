// @ts-nocheck
import { spawnSync } from "node:child_process";

type Step = {
    name: string;
    command: string;
    enabled: boolean;
    reasonIfSkipped?: string;
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const runDbMigrate = process.env.RUN_DB_MIGRATE === "1";
const runSmoke = process.env.RUN_SMOKE === "1";
const runQaGate = process.env.RUN_QA_GATE === "1";
const runTypeCheck = process.env.SKIP_TYPECHECK !== "1";
const runBuild = process.env.SKIP_BUILD !== "1";
const runReadiness = process.env.SKIP_READINESS !== "1";

const steps: Step[] = [
    {
        name: "Type check",
        command: "npm run check",
        enabled: runTypeCheck,
        reasonIfSkipped: "SKIP_TYPECHECK=1",
    },
    {
        name: "Build",
        command: "npm run build",
        enabled: runBuild,
        reasonIfSkipped: "SKIP_BUILD=1",
    },
    {
        name: "Database migrate",
        command: "npm run db:migrate",
        enabled: runDbMigrate,
        reasonIfSkipped: "RUN_DB_MIGRATE is not set to 1",
    },
    {
        name: "Readiness gate",
        command: "npm run readiness:gate",
        enabled: runReadiness,
        reasonIfSkipped: "SKIP_READINESS=1",
    },
    {
        name: "Production smoke",
        command: "npm run smoke:prod",
        enabled: runSmoke,
        reasonIfSkipped: "RUN_SMOKE is not set to 1",
    },
    {
        name: "Mobile lifecycle audit (strict)",
        command: "npm run qa:lifecycle:audit:strict",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
    {
        name: "Mobile compatibility audit (strict)",
        command: "npm run qa:compat:audit:strict",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
    {
        name: "Mobile call setup audit (strict)",
        command: "npm run qa:call:audit:strict",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
    {
        name: "Mobile reliability audit (strict)",
        command: "npm run qa:reliability:audit:strict",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
    {
        name: "Mobile final QA report",
        command: "npm run qa:final-report",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
    {
        name: "Mobile Go/No-Go gate",
        command: "npm run qa:go-no-go",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
    {
        name: "Mobile release signoff readiness",
        command: "npm run qa:release:signoff",
        enabled: runQaGate,
        reasonIfSkipped: "RUN_QA_GATE is not set to 1",
    },
];

function log(msg: string) {
    process.stdout.write(`${msg}\n`);
}

function runStep(step: Step): boolean {
    if (!step.enabled) {
        log(`SKIP: ${step.name} (${step.reasonIfSkipped || "disabled"})`);
        return true;
    }

    log(`RUN: ${step.name}`);
    log(`CMD: ${step.command}`);

    if (dryRun) {
        log(`DRY-RUN: ${step.name}`);
        return true;
    }

    const result = spawnSync(step.command, {
        shell: true,
        stdio: "inherit",
        env: process.env,
    });

    if (result.status !== 0) {
        log(`FAIL: ${step.name} (exit ${result.status ?? 1})`);
        return false;
    }

    log(`PASS: ${step.name}`);
    return true;
}

log("=== AMLO Release Checklist ===");
log(`Mode: ${dryRun ? "dry-run" : "execute"}`);

for (const step of steps) {
    const ok = runStep(step);
    if (!ok) {
        log("=== RESULT: FAILED ===");
        process.exit(1);
    }
}

log("=== RESULT: PASSED ===");
