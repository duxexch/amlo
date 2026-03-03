import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    dotfiles: "allow",           // serve .well-known/assetlinks.json
    maxAge: "1d",                // 24h for most files (was 1h)
    immutable: false,            // only hashed files get immutable below
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      // No-cache for service worker
      if (filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
      // Correct MIME for manifest
      if (filePath.endsWith("manifest.json")) {
        res.setHeader("Content-Type", "application/manifest+json");
      }
      // Step 28: Immutable caching for hashed assets (Vite output)
      if (/\/assets\/.*\.[a-f0-9]{8}\./i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
