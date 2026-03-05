/**
 * Database Backup Script — نسخة احتياطية للقاعدة
 * ═══════════════════════════════════════════════
 * Creates a pg_dump backup of the production database.
 * Usage: npm run db:backup
 *
 * Set DATABASE_URL in .env or pass directly.
 * Backups go to ./backups/ with timestamped filenames.
 */
import "dotenv/config";
import { execSync } from "child_process";
import { mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import path from "path";

const MAX_BACKUPS = 10; // Keep last N backups
const BACKUP_DIR = path.resolve(import.meta.dirname, "..", "backups");

function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set. Cannot create backup.");
    process.exit(1);
  }

  // Create backup directory
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ablox-backup-${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`📦 Creating backup: ${filename}`);

  try {
    // pg_dump with compression
    execSync(`pg_dump "${dbUrl}" | gzip > "${filepath}"`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300_000, // 5 min max
    });

    console.log(`✅ Backup created: ${filepath}`);

    // Prune old backups
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("ablox-backup-") && f.endsWith(".sql.gz"))
      .sort()
      .reverse();

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const f of toDelete) {
        unlinkSync(path.join(BACKUP_DIR, f));
        console.log(`🗑️  Pruned old backup: ${f}`);
      }
    }

    console.log(`📊 Total backups: ${Math.min(files.length, MAX_BACKUPS)}`);
  } catch (err: any) {
    console.error("❌ Backup failed:", err.message);
    process.exit(1);
  }
}

main();
