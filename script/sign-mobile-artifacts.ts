// @ts-nocheck
import { existsSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

function run(cmd: string, args: string[]) {
    const r = spawnSync(cmd, args, { stdio: "inherit", shell: false });
    if (r.status !== 0) {
        throw new Error(`${cmd} failed with exit code ${r.status ?? 1}`);
    }
}

function runCapture(cmd: string, args: string[]): string {
    const r = spawnSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: false, encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`${cmd} failed with exit code ${r.status ?? 1}: ${r.stderr || ""}`);
    }
    return String(r.stdout || "").trim();
}

function ensureTool(name: string) {
    const check = spawnSync(name, ["-help"], { stdio: "ignore", shell: false });
    if (check.error) {
        throw new Error(`${name} is not available in PATH`);
    }
}

function sha256(filePath: string): string {
    const out = runCapture("certutil", ["-hashfile", filePath, "SHA256"])
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    const candidate = out.find((line) => /^[A-Fa-f0-9 ]{32,}$/.test(line));
    return String(candidate || "").replace(/\s+/g, "").toLowerCase();
}

function main() {
    const root = process.cwd();
    const keytool = process.env.SIGNING_KEYTOOL || "keytool";
    const jarsigner = process.env.SIGNING_JARSIGNER || "jarsigner";
    const keystorePath = process.env.SIGNING_KEYSTORE_PATH || path.join(root, "signing", "ablox-release.keystore");
    const alias = process.env.SIGNING_KEY_ALIAS || "ablox";
    const storePass = process.env.SIGNING_STORE_PASSWORD || "";
    const keyPass = process.env.SIGNING_KEY_PASSWORD || storePass;
    const createIfMissing = (process.env.SIGNING_CREATE_IF_MISSING || "0") === "1";
    const dname = process.env.SIGNING_DNAME || "CN=Ablox, OU=Mobile, O=Ablox, L=Riyadh, S=Riyadh, C=SA";
    const apkPath = process.env.SIGNING_APK_PATH || path.join(root, "client", "public", "download", "ablox.apk");
    const aabPath = process.env.SIGNING_AAB_PATH || path.join(root, "client", "public", "download", "ablox.aab");

    if (!storePass) {
        throw new Error("SIGNING_STORE_PASSWORD is required");
    }

    ensureTool(keytool);
    ensureTool(jarsigner);

    if (!existsSync(keystorePath)) {
        if (!createIfMissing) {
            throw new Error(`Keystore not found: ${keystorePath}. Set SIGNING_CREATE_IF_MISSING=1 to generate one.`);
        }
        run(keytool, [
            "-genkeypair",
            "-v",
            "-keystore",
            keystorePath,
            "-storepass",
            storePass,
            "-keypass",
            keyPass,
            "-alias",
            alias,
            "-keyalg",
            "RSA",
            "-keysize",
            "2048",
            "-validity",
            "10000",
            "-storetype",
            "PKCS12",
            "-dname",
            dname,
        ]);
    }

    const artifacts = [
        { name: "apk", src: apkPath, ext: ".apk" },
        { name: "aab", src: aabPath, ext: ".aab" },
    ];

    for (const art of artifacts) {
        if (!existsSync(art.src)) {
            throw new Error(`Missing artifact: ${art.src}`);
        }
        const dir = path.dirname(art.src);
        const tmpSigned = path.join(dir, `${path.basename(art.src, art.ext)}.signed${art.ext}`);
        const backup = path.join(dir, `${path.basename(art.src, art.ext)}.unsigned.backup${art.ext}`);

        run(jarsigner, [
            "-keystore",
            keystorePath,
            "-storepass",
            storePass,
            "-keypass",
            keyPass,
            "-sigalg",
            "SHA256withRSA",
            "-digestalg",
            "SHA-256",
            "-signedjar",
            tmpSigned,
            art.src,
            alias,
        ]);

        run(jarsigner, [
            "-verify",
            "-verbose",
            "-certs",
            tmpSigned,
        ]);

        if (!existsSync(backup)) {
            renameSync(art.src, backup);
        }
        renameSync(tmpSigned, art.src);
    }

    const apkSize = statSync(apkPath).size;
    const aabSize = statSync(aabPath).size;
    const manifest = {
        generatedAt: new Date().toISOString(),
        signing: {
            keystorePath,
            alias,
        },
        apk: {
            path: apkPath,
            sizeBytes: apkSize,
            sha256: sha256(apkPath),
        },
        aab: {
            path: aabPath,
            sizeBytes: aabSize,
            sha256: sha256(aabPath),
        },
    };

    const outPath = path.join(root, "qa", "results", "signed-artifacts-manifest.json");
    writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");

    console.log("=== Signed Mobile Artifacts ===");
    console.log(`APK: ${apkPath}`);
    console.log(`AAB: ${aabPath}`);
    console.log(`Manifest: ${outPath}`);
    console.log(`APK_SHA256=${manifest.apk.sha256}`);
    console.log(`APK_SIZE_BYTES=${manifest.apk.sizeBytes}`);
    console.log(`AAB_SHA256=${manifest.aab.sha256}`);
    console.log(`AAB_SIZE_BYTES=${manifest.aab.sizeBytes}`);
}

main();
