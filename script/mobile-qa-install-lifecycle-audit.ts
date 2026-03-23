// @ts-nocheck
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Status = "PASS" | "FAIL" | "PENDING" | "NA";

const ALLOWED_STATUSES = new Set<Status>(["PASS", "FAIL", "PENDING", "NA"]);

function unquote(value: string): string {
    const v = String(value || "").trim();
    if (v.startsWith('"') && v.endsWith('"')) {
        return v.slice(1, -1).trim();
    }
    return v;
}

function parseCsv(content: string): Array<Record<string, string>> {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => unquote(h));
    return lines.slice(1).map((line) => {
        const cols = line.split(",");
        const row: Record<string, string> = {};
        for (let i = 0; i < headers.length; i += 1) {
            row[headers[i]] = unquote(cols[i] || "");
        }
        return row;
    });
}

function asStatus(value: string): Status {
    const v = String(value || "").trim().toUpperCase() as Status;
    return ALLOWED_STATUSES.has(v) ? v : "PENDING";
}

function pct(part: number, total: number): number {
    if (total <= 0) return 0;
    return Number(((part / total) * 100).toFixed(2));
}

function main() {
    const strict = process.argv.includes("--strict");
    const root = process.cwd();
    const matrixPath = path.join(root, "qa", "device-matrix.csv");
    const outPath = path.join(root, "qa", "results", "install-lifecycle-summary.json");

    if (!existsSync(matrixPath)) {
        console.error(`FAIL: missing matrix file ${matrixPath}`);
        process.exit(1);
    }

    const rows = parseCsv(readFileSync(matrixPath, "utf8"));
    if (rows.length === 0) {
        console.error("FAIL: matrix file has no rows");
        process.exit(1);
    }

    let invalidCells = 0;

    const fields = [
        "installApk",
        "installAab",
        "upgradeApk",
        "upgradeAab",
        "uninstallApk",
        "uninstallAab",
        "reinstallApk",
        "reinstallAab",
    ] as const;

    const counters: Record<string, { pass: number; fail: number; pending: number; na: number }> = {};
    for (const field of fields) {
        counters[field] = { pass: 0, fail: 0, pending: 0, na: 0 };
    }

    let tier1Checks = 0;
    let tier1DoneChecks = 0;
    let tier1HasFail = false;

    for (const row of rows) {
        const tier = String(row.tier || "").trim().toUpperCase();
        for (const field of fields) {
            const raw = String((row as any)[field] || "").trim().toUpperCase();
            if (!ALLOWED_STATUSES.has(raw as Status)) invalidCells += 1;
            const status = asStatus(raw);

            if (status === "PASS") counters[field].pass += 1;
            else if (status === "FAIL") counters[field].fail += 1;
            else if (status === "PENDING") counters[field].pending += 1;
            else if (status === "NA") counters[field].na += 1;
        }

        if (tier === "T1") {
            tier1Checks += fields.length;
            for (const field of fields) {
                const status = asStatus((row as any)[field]);
                if (status !== "PENDING") tier1DoneChecks += 1;
                if (status === "FAIL") tier1HasFail = true;
            }
        }
    }

    const apkInstallExecuted = counters.installApk.pass + counters.installApk.fail;
    const aabInstallExecuted = counters.installAab.pass + counters.installAab.fail;
    const apkUpgradeExecuted = counters.upgradeApk.pass + counters.upgradeApk.fail;
    const aabUpgradeExecuted = counters.upgradeAab.pass + counters.upgradeAab.fail;
    const apkUninstallExecuted = counters.uninstallApk.pass + counters.uninstallApk.fail;
    const aabUninstallExecuted = counters.uninstallAab.pass + counters.uninstallAab.fail;
    const apkReinstallExecuted = counters.reinstallApk.pass + counters.reinstallApk.fail;
    const aabReinstallExecuted = counters.reinstallAab.pass + counters.reinstallAab.fail;

    const report = {
        generatedAt: new Date().toISOString(),
        totalDevices: rows.length,
        invalidCells,
        lifecycle: {
            installApk: {
                ...counters.installApk,
                executed: apkInstallExecuted,
                successPct: pct(counters.installApk.pass, apkInstallExecuted),
            },
            installAab: {
                ...counters.installAab,
                executed: aabInstallExecuted,
                successPct: pct(counters.installAab.pass, aabInstallExecuted),
            },
            upgradeApk: {
                ...counters.upgradeApk,
                executed: apkUpgradeExecuted,
                successPct: pct(counters.upgradeApk.pass, apkUpgradeExecuted),
            },
            upgradeAab: {
                ...counters.upgradeAab,
                executed: aabUpgradeExecuted,
                successPct: pct(counters.upgradeAab.pass, aabUpgradeExecuted),
            },
            uninstallApk: {
                ...counters.uninstallApk,
                executed: apkUninstallExecuted,
                successPct: pct(counters.uninstallApk.pass, apkUninstallExecuted),
            },
            uninstallAab: {
                ...counters.uninstallAab,
                executed: aabUninstallExecuted,
                successPct: pct(counters.uninstallAab.pass, aabUninstallExecuted),
            },
            reinstallApk: {
                ...counters.reinstallApk,
                executed: apkReinstallExecuted,
                successPct: pct(counters.reinstallApk.pass, apkReinstallExecuted),
            },
            reinstallAab: {
                ...counters.reinstallAab,
                executed: aabReinstallExecuted,
                successPct: pct(counters.reinstallAab.pass, aabReinstallExecuted),
            },
        },
        tier1: {
            checks: tier1Checks,
            completedChecks: tier1DoneChecks,
            completionPct: pct(tier1DoneChecks, tier1Checks),
            hasFail: tier1HasFail,
        },
        decision: tier1HasFail ? "FAIL" : (pct(tier1DoneChecks, tier1Checks) < 100 ? "IN_PROGRESS" : "PASS"),
    };

    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    console.log("=== AMLO Install Lifecycle Audit ===");
    console.log(`Matrix: ${matrixPath}`);
    console.log(`Report: ${outPath}`);
    console.log(`installApk pass/fail/pending: ${counters.installApk.pass}/${counters.installApk.fail}/${counters.installApk.pending}`);
    console.log(`installAab pass/fail/pending: ${counters.installAab.pass}/${counters.installAab.fail}/${counters.installAab.pending}`);
    console.log(`upgradeApk pass/fail/pending: ${counters.upgradeApk.pass}/${counters.upgradeApk.fail}/${counters.upgradeApk.pending}`);
    console.log(`upgradeAab pass/fail/pending: ${counters.upgradeAab.pass}/${counters.upgradeAab.fail}/${counters.upgradeAab.pending}`);
    console.log(`uninstallApk pass/fail/pending: ${counters.uninstallApk.pass}/${counters.uninstallApk.fail}/${counters.uninstallApk.pending}`);
    console.log(`uninstallAab pass/fail/pending: ${counters.uninstallAab.pass}/${counters.uninstallAab.fail}/${counters.uninstallAab.pending}`);
    console.log(`reinstallApk pass/fail/pending: ${counters.reinstallApk.pass}/${counters.reinstallApk.fail}/${counters.reinstallApk.pending}`);
    console.log(`reinstallAab pass/fail/pending: ${counters.reinstallAab.pass}/${counters.reinstallAab.fail}/${counters.reinstallAab.pending}`);
    console.log(`Tier1 completion: ${report.tier1.completionPct}%`);
    console.log(`Decision: ${report.decision}`);

    if (strict && report.decision !== "PASS") {
        process.exit(1);
    }
}

main();
