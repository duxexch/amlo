import { eq, desc, asc, sql, and, or, like, ilike, count } from "drizzle-orm";
import { getDb } from "./db";
import { cacheGet, cacheSet, cacheDel } from "./redis";
import { escapeLike } from "./utils/validation";
import * as schema from "@shared/schema";
import type { User, InsertUser, Admin, InsertAdmin, UpgradeRequest, WalletTransaction, GiftTransaction, FraudAlert, UserReport } from "@shared/schema";

// ── In-memory cache layer (Process-level, avoids Redis round-trip) ──
const _memCache = new Map<string, { data: any; expiresAt: number }>();

function memGet<T = any>(key: string): T | undefined {
  const entry = _memCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _memCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function memSet(key: string, data: any, ttlMs: number) {
  _memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  // Prevent unbounded growth
  if (_memCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _memCache) {
      if (now > v.expiresAt) _memCache.delete(k);
    }
  }
}

function memDel(key: string) {
  _memCache.delete(key);
}

/**
 * DatabaseStorage — backed by PostgreSQL through Drizzle ORM.
 * All methods are safe to call even if DB is not connected (returns empty/null).
 */
export class DatabaseStorage {
  private get db() {
    return getDb();
  }

  // ── Users ──
  async getUser(id: string): Promise<User | undefined> {
    if (!this.db) return undefined;
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!this.db) return undefined;
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!this.db) return undefined;
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    if (!this.db) throw new Error("Database not available");
    const [user] = await this.db.insert(schema.users).values(data).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    if (!this.db) return undefined;
    const [user] = await this.db.update(schema.users).set({ ...data, updatedAt: new Date() }).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async getUsersCount(): Promise<number> {
    if (!this.db) return 0;
    const [result] = await this.db.select({ count: count() }).from(schema.users);
    return result?.count || 0;
  }

  async getUsersPaginated(page = 1, limit = 20, filters: { search?: string; status?: string; country?: string; banned?: string; verified?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (filters.search) {
      const q = `%${escapeLike(filters.search)}%`;
      conditions.push(or(ilike(schema.users.username, q), ilike(schema.users.displayName, q), ilike(schema.users.email, q)));
    }
    if (filters.status) conditions.push(eq(schema.users.status, filters.status));
    if (filters.country) conditions.push(eq(schema.users.country, filters.country));
    if (filters.banned === "true") conditions.push(eq(schema.users.isBanned, true));
    if (filters.banned === "false") conditions.push(eq(schema.users.isBanned, false));
    if (filters.verified === "true") conditions.push(eq(schema.users.isVerified, true));
    if (filters.verified === "false") conditions.push(eq(schema.users.isVerified, false));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db.select({ count: count() }).from(schema.users).where(where);
    const data = await this.db.select().from(schema.users).where(where).orderBy(desc(schema.users.createdAt)).limit(limit).offset(offset);

    return { data, total: countResult?.count || 0 };
  }

  // ── Admins ──
  async getAdmin(id: string): Promise<Admin | undefined> {
    if (!this.db) return undefined;
    const [admin] = await this.db.select().from(schema.admins).where(eq(schema.admins.id, id)).limit(1);
    return admin;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    if (!this.db) return undefined;
    const [admin] = await this.db.select().from(schema.admins).where(eq(schema.admins.username, username)).limit(1);
    return admin;
  }

  async updateAdmin(id: string, data: Partial<Admin>): Promise<Admin | undefined> {
    if (!this.db) return undefined;
    const [admin] = await this.db.update(schema.admins).set({ ...data, updatedAt: new Date() }).where(eq(schema.admins.id, id)).returning();
    return admin;
  }

  // ── Gifts ──
  async getGifts() {
    if (!this.db) return [];
    // 3-tier cache: Memory (60s) → Redis (5min) → DB
    const mem = memGet("gifts:all");
    if (mem) return mem;
    const cached = await cacheGet("gifts:all");
    if (cached) {
      const parsed = JSON.parse(cached);
      memSet("gifts:all", parsed, 60_000);
      return parsed;
    }
    const gifts = await this.db.select().from(schema.gifts).orderBy(asc(schema.gifts.sortOrder));
    await cacheSet("gifts:all", JSON.stringify(gifts), 300);
    memSet("gifts:all", gifts, 60_000);
    return gifts;
  }

  async getGift(id: string) {
    if (!this.db) return undefined;
    const [gift] = await this.db.select().from(schema.gifts).where(eq(schema.gifts.id, id)).limit(1);
    return gift;
  }

  async createGift(data: any) {
    if (!this.db) throw new Error("Database not available");
    const [gift] = await this.db.insert(schema.gifts).values(data).returning();
    await cacheDel("gifts:all");
    memDel("gifts:all");
    return gift;
  }

  async updateGift(id: string, data: any) {
    if (!this.db) return undefined;
    const [gift] = await this.db.update(schema.gifts).set(data).where(eq(schema.gifts.id, id)).returning();
    await cacheDel("gifts:all");
    memDel("gifts:all");
    return gift;
  }

  async deleteGift(id: string) {
    if (!this.db) return false;
    await this.db.delete(schema.gifts).where(eq(schema.gifts.id, id));
    await cacheDel("gifts:all");
    memDel("gifts:all");
    return true;
  }

  // ── System Settings ──
  async getSettings() {
    if (!this.db) return [];
    return this.db.select().from(schema.systemSettings);
  }

  async getSetting(key: string) {
    if (!this.db) return undefined;
    const [setting] = await this.db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);
    return setting;
  }

  async upsertSetting(key: string, value: string, category?: string, description?: string) {
    if (!this.db) return undefined;
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await this.db.update(schema.systemSettings).set({ value, updatedAt: new Date() }).where(eq(schema.systemSettings.key, key)).returning();
      return updated;
    }
    const [created] = await this.db.insert(schema.systemSettings).values({ key, value, category: category || "general", description: description || "" }).returning();
    return created;
  }

  // ── Admin Logs ──
  async addAdminLog(adminId: string, action: string, targetType: string, targetId: string, details: string) {
    if (!this.db) return;
    await this.db.insert(schema.adminLogs).values({ adminId, action, targetType, targetId, details });
  }

  async getAdminLogs(page = 1, limit = 20) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const [countResult] = await this.db.select({ count: count() }).from(schema.adminLogs);
    const data = await this.db.select().from(schema.adminLogs).orderBy(desc(schema.adminLogs.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  // ── Agents ──
  async getAgents() {
    if (!this.db) return [];
    return this.db.select().from(schema.agents).orderBy(desc(schema.agents.createdAt));
  }

  /** DB-side filtered + paginated agent search (avoids full table scan + JS filter) */
  async getAgentsFiltered(opts: { search?: string; status?: string; page: number; limit: number }): Promise<{ data: typeof schema.agents.$inferSelect[]; total: number }> {
    if (!this.db) return { data: [], total: 0 };
    const conditions: any[] = [];
    if (opts.search) {
      const q = `%${escapeLike(opts.search)}%`;
      conditions.push(
        or(
          ilike(schema.agents.name, q),
          ilike(schema.agents.email, q),
          ilike(schema.agents.referralCode, q),
        )
      );
    }
    if (opts.status) {
      conditions.push(eq(schema.agents.status, opts.status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.agents).where(where);
    const data = await this.db.select().from(schema.agents)
      .where(where)
      .orderBy(desc(schema.agents.createdAt))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit);
    return { data, total: countResult?.count || 0 };
  }

  async getAgentsCount(): Promise<number> {
    if (!this.db) return 0;
    const [result] = await this.db.select({ count: count() }).from(schema.agents);
    return result?.count || 0;
  }

  async getAgent(id: string) {
    if (!this.db) return undefined;
    const [agent] = await this.db.select().from(schema.agents).where(eq(schema.agents.id, id)).limit(1);
    return agent;
  }

  async getAgentByEmail(email: string) {
    if (!this.db) return undefined;
    const [agent] = await this.db.select().from(schema.agents).where(eq(schema.agents.email, email)).limit(1);
    return agent;
  }

  async createAgent(data: any) {
    if (!this.db) throw new Error("Database not available");
    const [agent] = await this.db.insert(schema.agents).values(data).returning();
    return agent;
  }

  async updateAgent(id: string, data: any) {
    if (!this.db) return undefined;
    const [agent] = await this.db.update(schema.agents).set({ ...data, updatedAt: new Date() }).where(eq(schema.agents.id, id)).returning();
    return agent;
  }

  async deleteAgent(id: string) {
    if (!this.db) return false;
    await this.db.delete(schema.agents).where(eq(schema.agents.id, id));
    return true;
  }

  // ── Wallet Transactions ──
  async createTransaction(data: any) {
    if (!this.db) throw new Error("Database not available");
    const [tx] = await this.db.insert(schema.walletTransactions).values(data).returning();
    return tx;
  }

  async updateTransaction(id: string, data: any) {
    if (!this.db) return undefined;
    const [tx] = await this.db.update(schema.walletTransactions).set(data).where(eq(schema.walletTransactions.id, id)).returning();
    return tx;
  }

  // ── User Reports ──
  async getReport(id: string) {
    if (!this.db) return undefined;
    const [report] = await this.db.select().from(schema.userReports).where(eq(schema.userReports.id, id)).limit(1);
    return report;
  }

  async updateReport(id: string, data: any) {
    if (!this.db) return undefined;
    const [report] = await this.db.update(schema.userReports).set(data).where(eq(schema.userReports.id, id)).returning();
    return report;
  }

  // ── Coin Packages ──
  async getCoinPackages() {
    if (!this.db) return [];
    return this.db.select().from(schema.coinPackages).orderBy(asc(schema.coinPackages.sortOrder));
  }

  // ── Upgrade Requests ──
  async createUpgradeRequest(data: { userId: string; currentLevel: number; requestedLevel: number }): Promise<UpgradeRequest> {
    if (!this.db) throw new Error("Database not available");
    const [req] = await this.db.insert(schema.upgradeRequests).values(data).returning();
    return req;
  }

  async getUpgradeRequest(id: string): Promise<UpgradeRequest | undefined> {
    if (!this.db) return undefined;
    const [req] = await this.db.select().from(schema.upgradeRequests).where(eq(schema.upgradeRequests.id, id)).limit(1);
    return req;
  }

  async getUpgradeRequestsByUser(userId: string): Promise<UpgradeRequest[]> {
    if (!this.db) return [];
    return this.db.select().from(schema.upgradeRequests)
      .where(eq(schema.upgradeRequests.userId, userId))
      .orderBy(desc(schema.upgradeRequests.createdAt));
  }

  async getPendingUpgradeRequestByUser(userId: string): Promise<UpgradeRequest | undefined> {
    if (!this.db) return undefined;
    const [req] = await this.db.select().from(schema.upgradeRequests)
      .where(and(eq(schema.upgradeRequests.userId, userId), eq(schema.upgradeRequests.status, "pending")))
      .limit(1);
    return req;
  }

  async getUpgradeRequestsPaginated(page = 1, limit = 20, filters: { status?: string; userId?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.upgradeRequests.status, filters.status));
    if (filters.userId) conditions.push(eq(schema.upgradeRequests.userId, filters.userId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db.select({ count: count() }).from(schema.upgradeRequests).where(where);
    const data = await this.db.select().from(schema.upgradeRequests).where(where)
      .orderBy(desc(schema.upgradeRequests.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async reviewUpgradeRequest(id: string, status: "approved" | "rejected", reviewedBy: string, adminNotes?: string): Promise<UpgradeRequest | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db.update(schema.upgradeRequests)
      .set({ status, reviewedBy, adminNotes: adminNotes || null, reviewedAt: new Date() })
      .where(eq(schema.upgradeRequests.id, id))
      .returning();
    return updated;
  }

  async getPendingUpgradeRequestsCount(): Promise<number> {
    if (!this.db) return 0;
    const [result] = await this.db.select({ count: count() }).from(schema.upgradeRequests)
      .where(eq(schema.upgradeRequests.status, "pending"));
    return result?.count || 0;
  }

  // ════════════════════════════════════════════════════════════
  // SYSTEM CONFIG — إعدادات النظام المتقدمة
  // ════════════════════════════════════════════════════════════
  async getSystemConfig(category: string) {
    if (!this.db) return null;
    // 3-tier cache: Memory (2min) → Redis (5min) → DB
    const memKey = `sysconfig:${category}`;
    const mem = memGet(memKey);
    if (mem) return mem;
    const cached = await cacheGet(memKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      memSet(memKey, parsed, 120_000);
      return parsed;
    }
    const [cfg] = await this.db.select().from(schema.systemConfig)
      .where(eq(schema.systemConfig.category, category)).limit(1);
    const result = cfg || null;
    if (result) {
      await cacheSet(memKey, JSON.stringify(result), 300);
      memSet(memKey, result, 120_000);
    }
    return result;
  }

  async upsertSystemConfig(category: string, configData: object, updatedBy?: string) {
    if (!this.db) return null;
    const json = JSON.stringify(configData);
    const memKey = `sysconfig:${category}`;
    const existing = await this.getSystemConfig(category);
    if (existing) {
      const [updated] = await this.db.update(schema.systemConfig)
        .set({ configData: json, updatedBy: updatedBy || null, updatedAt: new Date() })
        .where(eq(schema.systemConfig.id, existing.id)).returning();
      if (updated) {
        await cacheSet(memKey, JSON.stringify(updated), 300);
        memSet(memKey, updated, 120_000);
      }
      return updated;
    }
    const [created] = await this.db.insert(schema.systemConfig)
      .values({ category, configData: json, updatedBy }).returning();
    if (created) {
      await cacheSet(memKey, JSON.stringify(created), 300);
      memSet(memKey, created, 120_000);
    }
    return created;
  }

  async getAllSystemConfigs() {
    if (!this.db) return [];
    return this.db.select().from(schema.systemConfig).orderBy(schema.systemConfig.category);
  }

  // ════════════════════════════════════════════════════════════
  // FEATURED STREAMS CONFIG — البثوث المميزة
  // ════════════════════════════════════════════════════════════
  async getFeaturedStreams() {
    if (!this.db) return [];
    // 3-tier cache: Memory (30s) → Redis (2min) → DB
    const mem = memGet("featured:streams");
    if (mem) return mem;
    const cached = await cacheGet("featured:streams");
    if (cached) {
      const parsed = JSON.parse(cached);
      memSet("featured:streams", parsed, 30_000);
      return parsed;
    }
    const streams = await this.db.select().from(schema.featuredStreamsConfig)
      .where(eq(schema.featuredStreamsConfig.isActive, true))
      .orderBy(asc(schema.featuredStreamsConfig.sortOrder));
    await cacheSet("featured:streams", JSON.stringify(streams), 120);
    memSet("featured:streams", streams, 30_000);
    return streams;
  }

  async getAllFeaturedStreams() {
    if (!this.db) return [];
    return this.db.select().from(schema.featuredStreamsConfig)
      .orderBy(asc(schema.featuredStreamsConfig.sortOrder));
  }

  async createFeaturedStream(data: Partial<typeof schema.featuredStreamsConfig.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.featuredStreamsConfig).values(data as any).returning();
    return created;
  }

  async updateFeaturedStream(id: string, data: Partial<typeof schema.featuredStreamsConfig.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.featuredStreamsConfig)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(schema.featuredStreamsConfig.id, id)).returning();
    return updated;
  }

  async deleteFeaturedStream(id: string) {
    if (!this.db) return;
    await this.db.delete(schema.featuredStreamsConfig)
      .where(eq(schema.featuredStreamsConfig.id, id));
  }

  async reorderFeaturedStreams(orderedIds: string[]) {
    if (!this.db) return;
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.update(schema.featuredStreamsConfig)
        .set({ sortOrder: i })
        .where(eq(schema.featuredStreamsConfig.id, orderedIds[i]));
    }
  }

  // ════════════════════════════════════════════════════════════
  // ANNOUNCEMENT POPUPS
  // ════════════════════════════════════════════════════════════
  async getAnnouncementPopup() {
    if (!this.db) return null;
    // 3-tier cache: Memory (60s) → Redis (2min) → DB
    const mem = memGet("announcement:popup");
    if (mem !== undefined) return mem;
    const cached = await cacheGet("announcement:popup");
    if (cached) {
      const parsed = JSON.parse(cached);
      memSet("announcement:popup", parsed, 60_000);
      return parsed;
    }
    const [popup] = await this.db.select().from(schema.announcementPopups).limit(1);
    const result = popup || null;
    await cacheSet("announcement:popup", JSON.stringify(result), 120);
    memSet("announcement:popup", result, 60_000);
    return result;
  }

  async upsertAnnouncementPopup(data: Partial<typeof schema.announcementPopups.$inferInsert>) {
    if (!this.db) return null;
    const existing = await this.getAnnouncementPopup();
    let result;
    if (existing) {
      const [updated] = await this.db.update(schema.announcementPopups)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(schema.announcementPopups.id, existing.id)).returning();
      result = updated;
    } else {
      const [created] = await this.db.insert(schema.announcementPopups).values(data as any).returning();
      result = created;
    }
    await cacheDel("announcement:popup"); // invalidate cache
    memDel("announcement:popup");
    return result;
  }

  // ════════════════════════════════════════════════════════════
  // PAYMENT METHODS — طرق الدفع
  // ════════════════════════════════════════════════════════════
  async getPaymentMethods(activeOnly = false) {
    if (!this.db) return [];
    const q = this.db.select().from(schema.paymentMethods);
    if (activeOnly) return q.where(eq(schema.paymentMethods.isActive, true))
      .orderBy(asc(schema.paymentMethods.sortOrder));
    return q.orderBy(asc(schema.paymentMethods.sortOrder));
  }

  async getPaymentMethod(id: string) {
    if (!this.db) return null;
    const [m] = await this.db.select().from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.id, id)).limit(1);
    return m || null;
  }

  async createPaymentMethod(data: Partial<typeof schema.paymentMethods.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.paymentMethods).values(data as any).returning();
    return created;
  }

  async updatePaymentMethod(id: string, data: Partial<typeof schema.paymentMethods.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.paymentMethods)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(schema.paymentMethods.id, id)).returning();
    return updated;
  }

  async deletePaymentMethod(id: string) {
    if (!this.db) return;
    await this.db.delete(schema.paymentMethods).where(eq(schema.paymentMethods.id, id));
  }

  // ════════════════════════════════════════════════════════════
  // FRAUD ALERTS — تنبيهات الاحتيال
  // ════════════════════════════════════════════════════════════
  async getFraudAlerts(page = 1, limit = 20, filters: { status?: string; severity?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.fraudAlerts.status, filters.status));
    if (filters.severity) conditions.push(eq(schema.fraudAlerts.severity, filters.severity));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.fraudAlerts).where(where);
    const data = await this.db.select().from(schema.fraudAlerts).where(where)
      .orderBy(desc(schema.fraudAlerts.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async getFraudAlert(id: string) {
    if (!this.db) return null;
    const [alert] = await this.db.select().from(schema.fraudAlerts)
      .where(eq(schema.fraudAlerts.id, id)).limit(1);
    return alert || null;
  }

  async createFraudAlert(data: Partial<typeof schema.fraudAlerts.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.fraudAlerts).values(data as any).returning();
    return created;
  }

  async updateFraudAlert(id: string, data: Partial<typeof schema.fraudAlerts.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.fraudAlerts)
      .set(data as any)
      .where(eq(schema.fraudAlerts.id, id)).returning();
    return updated;
  }

  async getFraudStats() {
    if (!this.db) return { total: 0, pending: 0, investigating: 0, resolved: 0, dismissed: 0, critical: 0 };
    const result = await this.db
      .select({
        total: count(),
        pending: sql<number>`count(*) filter (where ${schema.fraudAlerts.status} = 'pending')`,
        investigating: sql<number>`count(*) filter (where ${schema.fraudAlerts.status} = 'investigating')`,
        resolved: sql<number>`count(*) filter (where ${schema.fraudAlerts.status} = 'resolved')`,
        dismissed: sql<number>`count(*) filter (where ${schema.fraudAlerts.status} = 'dismissed')`,
        critical: sql<number>`count(*) filter (where ${schema.fraudAlerts.severity} = 'critical')`,
      })
      .from(schema.fraudAlerts);
    const row = result[0];
    return {
      total: row?.total || 0,
      pending: row?.pending || 0,
      investigating: row?.investigating || 0,
      resolved: row?.resolved || 0,
      dismissed: row?.dismissed || 0,
      critical: row?.critical || 0,
    };
  }

  // ════════════════════════════════════════════════════════════
  // BANNED WORDS — الكلمات المحظورة
  // ════════════════════════════════════════════════════════════
  async getBannedWords() {
    if (!this.db) return [];
    return this.db.select().from(schema.bannedWords).orderBy(schema.bannedWords.word);
  }

  async addBannedWord(word: string, language = "all", severity = "block") {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.bannedWords).values({ word, language, severity }).returning();
    return created;
  }

  async deleteBannedWord(id: string) {
    if (!this.db) return;
    await this.db.delete(schema.bannedWords).where(eq(schema.bannedWords.id, id));
  }

  // ════════════════════════════════════════════════════════════
  // AGENT APPLICATIONS — طلبات الوكلاء
  // ════════════════════════════════════════════════════════════
  async getAgentApplications(page = 1, limit = 20, filters: { status?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.agentApplications.status, filters.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.agentApplications).where(where);
    const data = await this.db.select().from(schema.agentApplications).where(where)
      .orderBy(desc(schema.agentApplications.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async getAgentApplication(id: string) {
    if (!this.db) return null;
    const [app] = await this.db.select().from(schema.agentApplications)
      .where(eq(schema.agentApplications.id, id)).limit(1);
    return app || null;
  }

  async createAgentApplication(data: Partial<typeof schema.agentApplications.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.agentApplications).values(data as any).returning();
    return created;
  }

  async updateAgentApplication(id: string, data: Partial<typeof schema.agentApplications.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.agentApplications)
      .set(data as any)
      .where(eq(schema.agentApplications.id, id)).returning();
    return updated;
  }

  async deleteAgentApplication(id: string) {
    if (!this.db) return;
    await this.db.delete(schema.agentApplications).where(eq(schema.agentApplications.id, id));
  }

  // ════════════════════════════════════════════════════════════
  // ACCOUNT APPLICATIONS — طلبات فتح الحسابات
  // ════════════════════════════════════════════════════════════
  async getAccountApplications(page = 1, limit = 20, filters: { status?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.accountApplications.status, filters.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.accountApplications).where(where);
    const data = await this.db.select().from(schema.accountApplications).where(where)
      .orderBy(desc(schema.accountApplications.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async createAccountApplication(data: Partial<typeof schema.accountApplications.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.accountApplications).values(data as any).returning();
    return created;
  }

  async updateAccountApplication(id: string, data: Partial<typeof schema.accountApplications.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.accountApplications)
      .set(data as any)
      .where(eq(schema.accountApplications.id, id)).returning();
    return updated;
  }

  // ════════════════════════════════════════════════════════════
  // NOTIFICATION PREFERENCES — تفضيلات الإشعارات
  // ════════════════════════════════════════════════════════════
  async getNotificationPreferences(userId: string) {
    if (!this.db) return null;
    const [prefs] = await this.db.select().from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, userId)).limit(1);
    return prefs || null;
  }

  async upsertNotificationPreferences(userId: string, data: Partial<typeof schema.notificationPreferences.$inferInsert>) {
    if (!this.db) return null;
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const [updated] = await this.db.update(schema.notificationPreferences)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(schema.notificationPreferences.id, existing.id)).returning();
      return updated;
    }
    const [created] = await this.db.insert(schema.notificationPreferences)
      .values({ userId, ...data } as any).returning();
    return created;
  }

  // ════════════════════════════════════════════════════════════
  // WALLET / TRANSACTIONS — المحفظة والمعاملات المالية
  // ════════════════════════════════════════════════════════════
  async getUserTransactions(userId: string, page = 1, limit = 20, filters: { type?: string; status?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [eq(schema.walletTransactions.userId, userId)];
    if (filters.type) conditions.push(eq(schema.walletTransactions.type, filters.type));
    if (filters.status) conditions.push(eq(schema.walletTransactions.status, filters.status));
    const where = and(...conditions);
    const [countResult] = await this.db.select({ count: count() }).from(schema.walletTransactions).where(where);
    const data = await this.db.select().from(schema.walletTransactions).where(where)
      .orderBy(desc(schema.walletTransactions.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async getAllTransactions(page = 1, limit = 20, filters: { type?: string; status?: string; userId?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.type) conditions.push(eq(schema.walletTransactions.type, filters.type));
    if (filters.status) conditions.push(eq(schema.walletTransactions.status, filters.status));
    if (filters.userId) conditions.push(eq(schema.walletTransactions.userId, filters.userId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.walletTransactions).where(where);
    const data = await this.db.select().from(schema.walletTransactions).where(where)
      .orderBy(desc(schema.walletTransactions.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async getTransaction(id: string) {
    if (!this.db) return null;
    const [tx] = await this.db.select().from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.id, id)).limit(1);
    return tx || null;
  }

  // ════════════════════════════════════════════════════════════
  // GIFT TRANSACTIONS — معاملات الهدايا
  // ════════════════════════════════════════════════════════════
  async createGiftTransaction(data: Partial<typeof schema.giftTransactions.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.giftTransactions).values(data as any).returning();
    return created;
  }

  async getUserGiftHistory(userId: string, role: "sent" | "received" = "sent", page = 1, limit = 20) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const col = role === "sent" ? schema.giftTransactions.senderId : schema.giftTransactions.receiverId;
    const [countResult] = await this.db.select({ count: count() }).from(schema.giftTransactions).where(eq(col, userId));
    const data = await this.db.select().from(schema.giftTransactions).where(eq(col, userId))
      .orderBy(desc(schema.giftTransactions.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  // ════════════════════════════════════════════════════════════
  // WITHDRAWAL REQUESTS — طلبات السحب
  // ════════════════════════════════════════════════════════════
  async getWithdrawalRequests(page = 1, limit = 20, filters: { status?: string; userId?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.withdrawalRequests.status, filters.status));
    if (filters.userId) conditions.push(eq(schema.withdrawalRequests.userId, filters.userId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.withdrawalRequests).where(where);
    const data = await this.db.select().from(schema.withdrawalRequests).where(where)
      .orderBy(desc(schema.withdrawalRequests.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async createWithdrawalRequest(data: Partial<typeof schema.withdrawalRequests.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.withdrawalRequests).values(data as any).returning();
    return created;
  }

  async updateWithdrawalRequest(id: string, data: Partial<typeof schema.withdrawalRequests.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.withdrawalRequests)
      .set(data as any)
      .where(eq(schema.withdrawalRequests.id, id)).returning();
    return updated;
  }

  // ════════════════════════════════════════════════════════════
  // STREAMS — البثوث المباشرة
  // ════════════════════════════════════════════════════════════
  async getActiveStreams(page = 1, limit = 20) {
    if (!this.db) return { data: [], total: 0 };
    // 3-tier cache: Memory (15s) → Redis (30s) → DB
    const cacheKey = `streams:active:${page}:${limit}`;
    const mem = memGet(cacheKey);
    if (mem) return mem;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      memSet(cacheKey, parsed, 15_000);
      return parsed;
    }
    const offset = (page - 1) * limit;
    const where = eq(schema.streams.status, "active");
    const [countResult] = await this.db.select({ count: count() }).from(schema.streams).where(where);
    const data = await this.db.select().from(schema.streams).where(where)
      .orderBy(desc(schema.streams.viewerCount)).limit(limit).offset(offset);
    const result = { data, total: countResult?.count || 0 };
    await cacheSet(cacheKey, JSON.stringify(result), 30);
    memSet(cacheKey, result, 15_000);
    return result;
  }

  async getStream(id: string) {
    if (!this.db) return null;
    const [stream] = await this.db.select().from(schema.streams)
      .where(eq(schema.streams.id, id)).limit(1);
    return stream || null;
  }

  async createStream(data: Partial<typeof schema.streams.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.streams).values(data as any).returning();
    await cacheDel("streams:active:1:20"); // invalidate most common cache key
    await cacheDel("streams:active:1:50");
    return created;
  }

  async updateStream(id: string, data: Partial<typeof schema.streams.$inferInsert>) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.streams)
      .set(data as any)
      .where(eq(schema.streams.id, id)).returning();
    return updated;
  }

  async endStream(id: string) {
    if (!this.db) return null;
    const [updated] = await this.db.update(schema.streams)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(schema.streams.id, id)).returning();
    await cacheDel("streams:active:1:20");
    await cacheDel("streams:active:1:50");
    return updated;
  }

  async getUserActiveStream(userId: string) {
    if (!this.db) return null;
    const [stream] = await this.db.select().from(schema.streams)
      .where(and(eq(schema.streams.userId, userId), eq(schema.streams.status, "active")))
      .limit(1);
    return stream || null;
  }

  async getStreamsByUser(userId: string) {
    if (!this.db) return [];
    return this.db.select().from(schema.streams)
      .where(eq(schema.streams.userId, userId))
      .orderBy(desc(schema.streams.startedAt));
  }

  // ════════════════════════════════════════════════════════════
  // STREAM VIEWERS — مشاهدو البث
  // ════════════════════════════════════════════════════════════
  async addStreamViewer(streamId: string, userId: string, role = "viewer") {
    if (!this.db) return null;

    // Ensure a user can rejoin after leaving despite unique(stream_id, user_id).
    const [existing] = await this.db.select().from(schema.streamViewers)
      .where(and(
        eq(schema.streamViewers.streamId, streamId),
        eq(schema.streamViewers.userId, userId),
      ))
      .limit(1);

    // Already active in this stream: no-op, keep counter stable.
    if (existing && !existing.leftAt) {
      return existing;
    }

    let viewer = existing;
    if (existing) {
      // Rejoin existing row.
      const [updated] = await this.db.update(schema.streamViewers)
        .set({ leftAt: null, joinedAt: new Date(), role })
        .where(eq(schema.streamViewers.id, existing.id))
        .returning();
      viewer = updated || existing;
    } else {
      const [created] = await this.db.insert(schema.streamViewers)
        .values({ streamId, userId, role })
        .returning();
      viewer = created || null;
    }

    // Increment only when transitioning into active state.
    await this.db.update(schema.streams)
      .set({ viewerCount: sql`viewer_count + 1` })
      .where(eq(schema.streams.id, streamId));

    return viewer;
  }

  async removeStreamViewer(streamId: string, userId: string) {
    if (!this.db) return;
    const updated = await this.db.update(schema.streamViewers)
      .set({ leftAt: new Date() })
      .where(and(
        eq(schema.streamViewers.streamId, streamId),
        eq(schema.streamViewers.userId, userId),
        sql`left_at IS NULL`
      ))
      .returning({ id: schema.streamViewers.id });

    // Nothing active to remove: do not decrement.
    if (!updated.length) return;

    await this.db.update(schema.streams)
      .set({ viewerCount: sql`GREATEST(viewer_count - 1, 0)` })
      .where(eq(schema.streams.id, streamId));
  }

  async getStreamViewers(streamId: string) {
    if (!this.db) return [];
    return this.db.select().from(schema.streamViewers)
      .where(and(
        eq(schema.streamViewers.streamId, streamId),
        sql`left_at IS NULL`
      ));
  }

  // ════════════════════════════════════════════════════════════
  // USER FOLLOWS — نظام المتابعة العام
  // ════════════════════════════════════════════════════════════
  async followUser(followerId: string, followingId: string) {
    if (!this.db) return null;
    // Check if already following
    const existing = await this.db.select().from(schema.userFollows)
      .where(and(
        eq(schema.userFollows.followerId, followerId),
        eq(schema.userFollows.followingId, followingId)
      )).limit(1);
    if (existing.length > 0) return existing[0];
    const [follow] = await this.db.insert(schema.userFollows)
      .values({ followerId, followingId }).returning();
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string) {
    if (!this.db) return;
    await this.db.delete(schema.userFollows)
      .where(and(
        eq(schema.userFollows.followerId, followerId),
        eq(schema.userFollows.followingId, followingId)
      ));
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const where = eq(schema.userFollows.followingId, userId);
    const [countResult] = await this.db.select({ count: count() }).from(schema.userFollows).where(where);
    const data = await this.db.select().from(schema.userFollows).where(where)
      .orderBy(desc(schema.userFollows.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const where = eq(schema.userFollows.followerId, userId);
    const [countResult] = await this.db.select({ count: count() }).from(schema.userFollows).where(where);
    const data = await this.db.select().from(schema.userFollows).where(where)
      .orderBy(desc(schema.userFollows.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async getFollowCounts(userId: string) {
    if (!this.db) return { followers: 0, following: 0 };
    const [followers] = await this.db.select({ count: count() }).from(schema.userFollows)
      .where(eq(schema.userFollows.followingId, userId));
    const [following] = await this.db.select({ count: count() }).from(schema.userFollows)
      .where(eq(schema.userFollows.followerId, userId));
    return { followers: followers?.count || 0, following: following?.count || 0 };
  }

  async isFollowing(followerId: string, followingId: string) {
    if (!this.db) return false;
    const [result] = await this.db.select().from(schema.userFollows)
      .where(and(
        eq(schema.userFollows.followerId, followerId),
        eq(schema.userFollows.followingId, followingId)
      )).limit(1);
    return !!result;
  }

  async getFollowedAccounts(userId: string, limit = 20) {
    if (!this.db) return [];
    const follows = await this.db.select({
      followId: schema.userFollows.id,
      followingId: schema.userFollows.followingId,
    }).from(schema.userFollows)
      .where(eq(schema.userFollows.followerId, userId))
      .limit(limit);
    if (follows.length === 0) return [];
    const userIds = follows.map(f => f.followingId);
    const users = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      status: schema.users.status,
      level: schema.users.level,
      country: schema.users.country,
    }).from(schema.users)
      .where(or(...userIds.map(uid => eq(schema.users.id, uid))));
    return users;
  }

  // ════════════════════════════════════════════════════════════
  // USER REPORTS — بلاغات المستخدمين (موسّعة)
  // ════════════════════════════════════════════════════════════
  async getReports(page = 1, limit = 20, filters: { status?: string; type?: string } = {}) {
    if (!this.db) return { data: [], total: 0 };
    const offset = (page - 1) * limit;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.userReports.status, filters.status));
    if (filters.type) conditions.push(eq(schema.userReports.type, filters.type));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db.select({ count: count() }).from(schema.userReports).where(where);
    const data = await this.db.select().from(schema.userReports).where(where)
      .orderBy(desc(schema.userReports.createdAt)).limit(limit).offset(offset);
    return { data, total: countResult?.count || 0 };
  }

  async createReport(data: Partial<typeof schema.userReports.$inferInsert>) {
    if (!this.db) return null;
    const [created] = await this.db.insert(schema.userReports).values(data as any).returning();
    return created;
  }

  // ════════════════════════════════════════════════════════════
  // ADMIN STATS — إحصائيات حقيقية
  // ════════════════════════════════════════════════════════════
  async getAdminDashboardStats() {
    if (!this.db) return { totalUsers: 0, totalAgents: 0, activeStreams: 0, todayRevenue: 0, weeklyRevenue: 0 };
    const [usersCount] = await this.db.select({ count: count() }).from(schema.users);
    const [agentsCount] = await this.db.select({ count: count() }).from(schema.agents);
    const [streamsCount] = await this.db.select({ count: count() }).from(schema.streams)
      .where(eq(schema.streams.status, "active"));
    
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    
    const todayRevResult = await this.db.select({ 
      total: sql<number>`COALESCE(SUM(amount), 0)` 
    }).from(schema.walletTransactions)
      .where(and(
        eq(schema.walletTransactions.type, "purchase"),
        eq(schema.walletTransactions.status, "completed"),
        sql`created_at >= ${today.toISOString()}`
      ));
    
    const weekRevResult = await this.db.select({
      total: sql<number>`COALESCE(SUM(amount), 0)`
    }).from(schema.walletTransactions)
      .where(and(
        eq(schema.walletTransactions.type, "purchase"),
        eq(schema.walletTransactions.status, "completed"),
        sql`created_at >= ${weekAgo.toISOString()}`
      ));

    return {
      totalUsers: usersCount?.count || 0,
      totalAgents: agentsCount?.count || 0,
      activeStreams: streamsCount?.count || 0,
      todayRevenue: Number(todayRevResult[0]?.total || 0),
      weeklyRevenue: Number(weekRevResult[0]?.total || 0),
    };
  }

  async getWeeklyUserRegistrations() {
    if (!this.db) return [];
    const result = await this.db.select({
      day: sql<string>`DATE(created_at)`,
      count: count(),
    }).from(schema.users)
      .where(sql`created_at >= NOW() - INTERVAL '7 days'`)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);
    return result;
  }

  async getRecentAdminActivity(limit = 10) {
    if (!this.db) return [];
    return this.db.select().from(schema.adminLogs)
      .orderBy(desc(schema.adminLogs.createdAt))
      .limit(limit);
  }

  // ════════════════════════════════════════════════════════════
  // User deletion
  // ════════════════════════════════════════════════════════════
  async deleteUser(id: string) {
    if (!this.db) return;
    // Wrap all deletions in a transaction to prevent partial deletes
    await this.db.transaction(async (tx) => {
      await tx.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, id));
      await tx.delete(schema.friendProfileVisibility)
        .where(or(eq(schema.friendProfileVisibility.userId, id), eq(schema.friendProfileVisibility.friendId, id)));
      await tx.delete(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, id));
      await tx.delete(schema.friendships)
        .where(or(eq(schema.friendships.senderId, id), eq(schema.friendships.receiverId, id)));
      await tx.delete(schema.chatBlocks)
        .where(or(eq(schema.chatBlocks.blockerId, id), eq(schema.chatBlocks.blockedId, id)));
      await tx.delete(schema.userFollows)
        .where(or(eq(schema.userFollows.followerId, id), eq(schema.userFollows.followingId, id)));
      // Finally delete the user
      await tx.delete(schema.users).where(eq(schema.users.id, id));
    });
  }
}

export const storage = new DatabaseStorage();
