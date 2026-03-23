// @ts-nocheck
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function normalize(value: string): string {
    return String(value || "").trim().toLowerCase();
}

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

function isFamilyCovered(oems: Set<string>, aliases: string[]): boolean {
    return aliases.some((name) => oems.has(normalize(name)));
}

function main() {
    const matrixPath = path.join(process.cwd(), "qa", "device-matrix.csv");
    if (!existsSync(matrixPath)) {
        console.error(`FAIL: missing matrix file ${matrixPath}`);
        process.exit(1);
    }

    const rawCsv = readFileSync(matrixPath, "utf8");
    const headerLine = rawCsv.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
    const headers = headerLine.split(",").map((h) => unquote(h));
    const requiredHeaders = [
        "tier",
        "oem",
        "model",
        "osVersion",
        "ramTier",
        "networkProfile",
        "installApk",
        "installAab",
        "upgradeApk",
        "upgradeAab",
        "uninstallApk",
        "uninstallAab",
        "reinstallApk",
        "reinstallAab",
        "permissionsFlow",
        "backgroundBehavior",
        "batteryOptimization",
        "callReconnect",
        "call15mSoak",
        "call60mSoak",
        "interruptionHandling",
        "notificationAction",
        "oemAutostartPolicy",
        "otpFlow",
        "socialLoginFlow",
        "sessionRefresh",
        "authFailureMode",
        "startupPerf",
        "memoryRegression",
        "batteryRegression",
        "thermalRegression",
        "playPrelaunchTriage",
        "crashAnrClosure",
        "rcSignoffPack",
    ];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
        console.error("FAIL: device matrix missing required columns");
        for (const h of missingHeaders) {
            console.error(`- ${h}`);
        }
        process.exit(1);
    }

    const rows = parseCsv(rawCsv);
    if (rows.length === 0) {
        console.error("FAIL: matrix is empty");
        process.exit(1);
    }

    const oems = new Set(rows.map((r) => normalize(r.oem)));
    const osVersions = new Set(rows.map((r) => normalize(r.osVersion)));
    const ramTiers = new Set(rows.map((r) => normalize(r.ramTier)));

    const failures: string[] = [];

    const oemFamilies: Array<{ label: string; aliases: string[] }> = [
        { label: "Samsung", aliases: ["samsung"] },
        { label: "Xiaomi/Redmi", aliases: ["xiaomi", "redmi"] },
        { label: "Oppo/Realme", aliases: ["oppo", "realme"] },
        { label: "Vivo", aliases: ["vivo"] },
        { label: "Motorola/Nokia", aliases: ["motorola", "nokia"] },
    ];

    for (const family of oemFamilies) {
        if (!isFamilyCovered(oems, family.aliases)) {
            failures.push(`Missing OEM family coverage: ${family.label}`);
        }
    }

    const requiredOs = [
        "android 8",
        "android 9",
        "android 10",
        "android 11",
        "android 12",
        "android 13",
        "android 14",
    ];

    for (const os of requiredOs) {
        if (!osVersions.has(os)) {
            failures.push(`Missing OS coverage: ${os}`);
        }
    }

    for (const tier of ["low", "mid", "high"]) {
        if (!ramTiers.has(tier)) {
            failures.push(`Missing RAM tier coverage: ${tier}`);
        }
    }

    if (rows.length < 15) {
        failures.push(`Matrix has only ${rows.length} rows; minimum recommended is 15`);
    }

    if (failures.length > 0) {
        console.error("FAIL: device matrix validation failed");
        for (const f of failures) {
            console.error(`- ${f}`);
        }
        process.exit(1);
    }

    console.log("PASS: device matrix validation passed");
    console.log(`Rows: ${rows.length}`);
    console.log(`OEM entries: ${Array.from(oems).join(", ")}`);
    console.log(`OS entries: ${Array.from(osVersions).join(", ")}`);
    console.log(`RAM tiers: ${Array.from(ramTiers).join(", ")}`);
}

main();
