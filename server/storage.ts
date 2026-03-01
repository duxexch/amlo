import { eq, desc, asc, sql, and, or, like, ilike, count } from "drizzle-orm";
import { getDb } from "./db";
import * as schema from "@shared/schema";
import type { User, InsertUser, Admin, InsertAdmin, UpgradeRequest } from "@shared/schema";

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
      const q = `%${filters.search}%`;
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
    return this.db.select().from(schema.gifts).orderBy(asc(schema.gifts.sortOrder));
  }

  async getGift(id: string) {
    if (!this.db) return undefined;
    const [gift] = await this.db.select().from(schema.gifts).where(eq(schema.gifts.id, id)).limit(1);
    return gift;
  }

  async createGift(data: any) {
    if (!this.db) throw new Error("Database not available");
    const [gift] = await this.db.insert(schema.gifts).values(data).returning();
    return gift;
  }

  async updateGift(id: string, data: any) {
    if (!this.db) return undefined;
    const [gift] = await this.db.update(schema.gifts).set(data).where(eq(schema.gifts.id, id)).returning();
    return gift;
  }

  async deleteGift(id: string) {
    if (!this.db) return false;
    await this.db.delete(schema.gifts).where(eq(schema.gifts.id, id));
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
}

export const storage = new DatabaseStorage();
