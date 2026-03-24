import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Wrench } from "lucide-react";
import { adminLogs, adminProviders, type ProvidersOverviewResponse } from "@/lib/adminApi";

type ProviderRow = {
    key: string;
    category: string;
    provider: string;
    enabled: boolean;
    configured: boolean;
    mode?: string;
    priority?: number;
    countries?: string[];
};

function statusText(enabled: boolean, configured: boolean) {
    if (!enabled) return "Disabled";
    if (!configured) return "Missing credentials";
    return "Healthy";
}

type WarningAction = {
    key: string;
    title: string;
    details: string;
    href: string;
    actionLabel: string;
};

type AdminLogEntry = {
    id: string;
    action?: string;
    targetType?: string;
    details?: string;
    createdAt?: string;
};

type AuditCategory = "social" | "otp" | "payment_gateway" | "payment_method" | "app_download";

export function ProvidersHubPage() {
    const [data, setData] = useState<ProvidersOverviewResponse | null>(null);
    const [auditLogs, setAuditLogs] = useState<AdminLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string>("");

    const load = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        try {
            const [overviewRes, logsRes] = await Promise.all([
                adminProviders.getOverview(),
                adminLogs.list(1, 120),
            ]);

            if (overviewRes.success && overviewRes.data) {
                setData(overviewRes.data);
            } else {
                setError(overviewRes.message || "Failed to load providers overview");
            }

            if (logsRes.success && logsRes.data) {
                setAuditLogs(logsRes.data as AdminLogEntry[]);
            }
        } catch (e: any) {
            setError(e?.message || "Failed to load providers overview");
        } finally {
            if (isRefresh) setRefreshing(false);
            else setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const rows = useMemo<ProviderRow[]>(() => {
        if (!data) return [];

        const socialRows = data.socialLogin.providers.map((p) => ({
            key: `social:${p.provider}`,
            category: "Social Login",
            provider: p.provider,
            enabled: p.enabled,
            configured: p.configured,
        }));

        const otpRow: ProviderRow = {
            key: `otp:${data.otpSms.provider}`,
            category: "OTP / SMS",
            provider: data.otpSms.provider,
            enabled: data.otpSms.enabled,
            configured: data.otpSms.configured,
        };

        const gatewayRows = data.paymentGateways.providers.map((p) => ({
            key: `gateway:${p.provider}`,
            category: "Payment Gateway",
            provider: p.provider,
            enabled: p.enabled,
            configured: p.configured,
            mode: p.mode,
            priority: p.priority,
            countries: p.countries,
        }));

        return [...socialRows, otpRow, ...gatewayRows];
    }, [data]);

    const warningCount = useMemo(() => rows.filter((r) => r.enabled && !r.configured).length, [rows]);

    const warnings = useMemo<WarningAction[]>(() => {
        if (!data) return [];

        const items: WarningAction[] = [];

        data.socialLogin.providers
            .filter((p) => p.enabled && !p.configured)
            .forEach((p) => {
                items.push({
                    key: `warn-social-${p.provider}`,
                    title: `Social provider not configured: ${p.provider}`,
                    details: `Provider is enabled but credentials are missing for ${p.provider}.`,
                    href: "/admin/settings?tab=socialLogin",
                    actionLabel: "Open Social Login Settings",
                });
            });

        if (data.otpSms.enabled && !data.otpSms.configured) {
            items.push({
                key: "warn-otp",
                title: "OTP provider missing credentials",
                details: `OTP provider ${data.otpSms.provider} is active without valid credentials.`,
                href: "/admin/settings?tab=otp",
                actionLabel: "Open OTP Settings",
            });
        }

        data.paymentGateways.providers
            .filter((p) => p.enabled && !p.configured)
            .forEach((p) => {
                items.push({
                    key: `warn-gateway-${p.provider}`,
                    title: `Payment gateway not configured: ${p.provider}`,
                    details: `Gateway ${p.provider} is enabled (${p.mode}) but credentials are incomplete.`,
                    href: "/admin/finances?tab=payment-methods",
                    actionLabel: "Open Finance Payment Methods",
                });
            });

        if (data.appDownload.enabled && !data.appDownload.apkEnabled && !data.appDownload.aabEnabled) {
            items.push({
                key: "warn-app-download",
                title: "App download enabled without APK/AAB",
                details: "Public app download is enabled while both APK and AAB toggles are off.",
                href: "/admin/settings?tab=appDownload",
                actionLabel: "Open App Download Settings",
            });
        }

        if (data.paymentMethods.total > 0 && data.paymentMethods.active === 0) {
            items.push({
                key: "warn-payment-methods",
                title: "No active payment methods",
                details: "Payment methods exist but all are inactive, which can block deposits and withdrawals.",
                href: "/admin/finances?tab=payment-methods",
                actionLabel: "Open Finance Payment Methods",
            });
        }

        return items;
    }, [data]);

    const groupedAuditTimeline = useMemo(() => {
        const providerLogs = auditLogs.filter((log) => {
            const target = `${log.targetType || ""} ${log.action || ""} ${log.details || ""}`.toLowerCase();
            return (
                target.includes("social") ||
                target.includes("otp") ||
                target.includes("sms") ||
                target.includes("payment") ||
                target.includes("gateway") ||
                target.includes("app download") ||
                target.includes("apk") ||
                target.includes("aab")
            );
        });

        const classify = (log: AdminLogEntry): AuditCategory => {
            const text = `${log.targetType || ""} ${log.action || ""} ${log.details || ""}`.toLowerCase();
            if (text.includes("social") || text.includes("google") || text.includes("facebook") || text.includes("apple")) return "social";
            if (text.includes("otp") || text.includes("sms") || text.includes("twilio")) return "otp";
            if (text.includes("payment_method") || text.includes("payment method")) return "payment_method";
            if (text.includes("app download") || text.includes("apk") || text.includes("aab")) return "app_download";
            return "payment_gateway";
        };

        const grouped: Record<AuditCategory, AdminLogEntry[]> = {
            social: [],
            otp: [],
            payment_gateway: [],
            payment_method: [],
            app_download: [],
        };

        providerLogs.forEach((log) => {
            grouped[classify(log)].push(log);
        });

        (Object.keys(grouped) as AuditCategory[]).forEach((key) => {
            grouped[key] = grouped[key].slice(0, 6);
        });

        return grouped;
    }, [auditLogs]);

    const categoryLabels: Record<AuditCategory, string> = {
        social: "Social Login",
        otp: "OTP / SMS",
        payment_gateway: "Payment Gateway",
        payment_method: "Payment Method",
        app_download: "App Download",
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white/5 rounded-2xl h-28" />
                    ))}
                </div>
                <div className="bg-white/5 rounded-2xl h-80" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-white" style={{ fontFamily: "Outfit" }}>
                        Providers Hub
                    </h1>
                    <p className="text-white/40 text-sm mt-1">
                        Unified visibility for social, OTP, payment gateways, and app distribution switches.
                    </p>
                </div>
                <button
                    onClick={() => void load(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold text-white disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5"
                        >
                            <p className="text-xs text-white/50 font-semibold">Social Login</p>
                            <p className="text-2xl font-black text-white mt-1">{data.socialLogin.enabled}/{data.socialLogin.total}</p>
                            <p className="text-[11px] text-white/35 mt-1">{data.socialLogin.configured} configured</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5"
                        >
                            <p className="text-xs text-white/50 font-semibold">Payment Gateways</p>
                            <p className="text-2xl font-black text-white mt-1">{data.paymentGateways.enabled}/{data.paymentGateways.total}</p>
                            <p className="text-[11px] text-white/35 mt-1">{data.paymentGateways.configured} configured</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5"
                        >
                            <p className="text-xs text-white/50 font-semibold">Payment Methods</p>
                            <p className="text-2xl font-black text-white mt-1">{data.paymentMethods.active}/{data.paymentMethods.total}</p>
                            <p className="text-[11px] text-white/35 mt-1">Active methods</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5"
                        >
                            <p className="text-xs text-white/50 font-semibold">Warnings</p>
                            <p className="text-2xl font-black text-white mt-1">{warningCount}</p>
                            <p className="text-[11px] text-white/35 mt-1">Enabled but not configured</p>
                        </motion.div>
                    </div>

                    <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white">Actionable Warnings</h2>
                            <div className="text-xs text-white/35">{warnings.length} issue(s)</div>
                        </div>
                        <div className="p-4 space-y-3">
                            {warnings.length === 0 ? (
                                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                    No actionable warnings detected. Provider setup looks healthy.
                                </div>
                            ) : (
                                warnings.map((warn) => (
                                    <div key={warn.key} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-amber-100">{warn.title}</p>
                                            <p className="text-xs text-amber-200/80 mt-1">{warn.details}</p>
                                        </div>
                                        <Link href={warn.href}>
                                            <a className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white w-fit">
                                                <Wrench className="w-3.5 h-3.5" />
                                                {warn.actionLabel}
                                            </a>
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white">Provider Health Matrix</h2>
                            <div className="text-xs text-white/35">
                                App download: {data.appDownload.enabled ? "enabled" : "disabled"} | APK: {data.appDownload.apkEnabled ? "on" : "off"} | AAB: {data.appDownload.aabEnabled ? "on" : "off"}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-white/45 text-xs">
                                        <th className="px-5 py-3 text-left font-semibold">Category</th>
                                        <th className="px-5 py-3 text-left font-semibold">Provider</th>
                                        <th className="px-5 py-3 text-left font-semibold">Status</th>
                                        <th className="px-5 py-3 text-left font-semibold">Mode</th>
                                        <th className="px-5 py-3 text-left font-semibold">Priority</th>
                                        <th className="px-5 py-3 text-left font-semibold">Countries</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const healthy = row.enabled && row.configured;
                                        const warning = row.enabled && !row.configured;
                                        return (
                                            <tr key={row.key} className="border-t border-white/5 text-white/85">
                                                <td className="px-5 py-3 text-white/65">{row.category}</td>
                                                <td className="px-5 py-3 font-semibold">{row.provider}</td>
                                                <td className="px-5 py-3">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${healthy
                                                            ? "bg-emerald-500/15 text-emerald-300"
                                                            : warning
                                                                ? "bg-amber-500/15 text-amber-300"
                                                                : "bg-white/10 text-white/60"
                                                            }`}
                                                    >
                                                        {healthy && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        {warning && <AlertTriangle className="w-3.5 h-3.5" />}
                                                        {!healthy && !warning && <ShieldAlert className="w-3.5 h-3.5" />}
                                                        {statusText(row.enabled, row.configured)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-white/70">{row.mode || "-"}</td>
                                                <td className="px-5 py-3 text-white/70">{row.priority ?? "-"}</td>
                                                <td className="px-5 py-3 text-white/70">{row.countries?.length ? row.countries.join(", ") : "-"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white">Provider Audit Timeline</h2>
                            <div className="text-xs text-white/35">Grouped by provider category</div>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {(Object.keys(groupedAuditTimeline) as AuditCategory[]).map((category) => {
                                const events = groupedAuditTimeline[category];
                                return (
                                    <div key={category} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-bold text-white">{categoryLabels[category]}</h3>
                                            <span className="text-[11px] text-white/35">{events.length} event(s)</span>
                                        </div>
                                        {events.length === 0 ? (
                                            <p className="text-xs text-white/35">No recent provider audit events.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {events.map((event) => (
                                                    <div key={event.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                                        <p className="text-xs text-white/80">{event.details || event.action || "provider update"}</p>
                                                        <p className="text-[10px] text-white/35 mt-1">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}