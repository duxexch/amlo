import { motion, AnimatePresence } from "framer-motion";
import { Video, Mic, Users, Flame, Radio, Circle, Clock, Eye, Globe } from "lucide-react";
import { Link, useLocation } from "wouter";
import avatarImg from "@/assets/images/avatar-3d.png";
import heroBg from "@/assets/images/hero-bg.png";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { RandomFiltersModal, type MatchFilters } from "@/components/RandomFiltersModal";
import { MatchingScreen } from "@/components/MatchingScreen";

// ── Featured Live Streams Marquee ──────────────────────
function FeaturedStreamCard({ stream }: { stream: any }) {
  return (
    <Link href={`/room/${stream.id}`}>
      <a className="relative w-[140px] h-[190px] md:w-[160px] md:h-[210px] rounded-2xl overflow-hidden shrink-0 group block border border-white/10 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]">
        {/* Background */}
        <img src={avatarImg} alt={stream.displayName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* LIVE badge */}
        {stream.isLive && (
          <div className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            LIVE
          </div>
        )}

        {/* Viewers */}
        <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
          <Users className="w-2.5 h-2.5" />
          {stream.viewers >= 1000 ? (stream.viewers / 1000).toFixed(1) + "K" : stream.viewers}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
          <p className="text-white text-xs font-bold truncate">{stream.displayName}</p>
          {stream.tags?.length > 0 && (
            <div className="flex gap-1 mt-1 overflow-hidden">
              {stream.tags.slice(0, 2).map((tag: string) => (
                <span key={tag} className="text-[9px] font-medium bg-white/20 backdrop-blur-sm text-white/90 px-1.5 py-0.5 rounded-md">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Glow ring on hover */}
        <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-primary/30 transition-all duration-300" />
      </a>
    </Link>
  );
}

function FeaturedMarquee() {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const speedRef = useRef(0.5); // px per frame
  const pausedRef = useRef(false);

  useEffect(() => {
    fetch("/api/featured-streams")
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.length) {
          setStreams(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Infinite scroll animation
  useEffect(() => {
    if (!streams.length) return;
    const el = scrollRef.current;
    if (!el) return;

    const animate = () => {
      if (!pausedRef.current && el) {
        el.scrollLeft += speedRef.current;
        // Reset when we've scrolled through one set
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0;
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [streams]);

  if (!streams.length) return null;

  // Double the streams for seamless loop
  const doubled = [...streams, ...streams];

  return (
    <div className="relative -mx-4 md:-mx-8">
      {/* Section label */}
      <div className="flex items-center gap-2 px-4 md:px-8 mb-3">
        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
          <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          <span className="text-xs font-bold text-red-400">{t("home.featuredLive")}</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/5 to-transparent" />
      </div>

      {/* Scrolling container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-hidden px-4 md:px-8 pb-1"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 2000); }}
      >
        {doubled.map((stream, i) => (
          <FeaturedStreamCard key={`${stream.id}-${i}`} stream={stream} />
        ))}
      </div>

      {/* Fade edges */}
      <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-20" />
      <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-20" />
    </div>
  );
}

// ── Time since helper ──────────────────────────────────
function getTimeSince(dateStr: string, t: any): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("home.justNow");
  if (mins < 60) return `${mins} ${t("home.minutesAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${t("home.hoursAgo")}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${t("home.daysAgo")}`;
}

export function Home() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<'random' | 'live'>('random');
  const [followedAccounts, setFollowedAccounts] = useState<any[]>([]);
  const [liveFilter, setLiveFilter] = useState<'all' | 'videoLive' | 'audioLive' | 'offline'>('all');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filtersType, setFiltersType] = useState<"video" | "audio">("video");
  const [showMatching, setShowMatching] = useState(false);
  const [matchFilters, setMatchFilters] = useState<MatchFilters | null>(null);

  useEffect(() => {
    fetch("/api/followed-accounts")
      .then(r => r.json())
      .then(data => {
        if (data.success) setFollowedAccounts(data.data);
      })
      .catch(() => {});
  }, []);

  const filteredAccounts = followedAccounts.filter(a => {
    if (liveFilter === 'videoLive') return a.isLive && a.liveType !== 'audio';
    if (liveFilter === 'audioLive') return a.isLive && a.liveType === 'audio';
    if (liveFilter === 'offline') return !a.isLive;
    return true;
  });

  const videoLiveCount = followedAccounts.filter(a => a.isLive && a.liveType !== 'audio').length;
  const audioLiveCount = followedAccounts.filter(a => a.isLive && a.liveType === 'audio').length;
  const liveCount = videoLiveCount + audioLiveCount;
  const offlineCount = followedAccounts.filter(a => !a.isLive).length;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Featured Live Streams Marquee */}
      <FeaturedMarquee />

      {/* Tabs */}
      <div className="space-y-6 mt-4">
      <div className="flex p-1.5 bg-white/5 rounded-2xl w-full max-w-md mx-auto backdrop-blur-md border border-white/10">
        <button 
          onClick={() => setActiveTab('random')}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'random' ? 'bg-primary text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'text-white/60 hover:text-white'}`}
        >
          {t("home.tabRandomChat")}
        </button>
        <button 
          onClick={() => setActiveTab('live')}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'live' ? 'bg-secondary text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'text-white/60 hover:text-white'}`}
        >
          {t("home.tabLiveStream")}
        </button>
        <button 
          onClick={() => navigate('/world')}
          className="flex-1 py-3 px-3 rounded-xl font-bold text-sm transition-all duration-300 text-white/60 hover:text-white flex items-center justify-center gap-1.5 hover:bg-emerald-500/10"
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          {t("home.tabWorld")}
        </button>
      </div>

      {/* Random Match Section */}
      {activeTab === 'random' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-6"
        >
          <div className="glass p-8 rounded-3xl flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center mb-6 neon-border relative">
              <div className="absolute inset-0 rounded-full animate-pulse-ring" />
              <Video className="w-14 h-14 text-primary" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">{t("home.randomVideoTitle")}</h3>
            <p className="text-muted-foreground mb-8 text-lg">{t("home.randomVideoDesc")}</p>
            <button
              onClick={() => { setFiltersType("video"); setShowFiltersModal(true); }}
              className="bg-primary hover:bg-primary/90 text-white font-bold text-xl py-4 px-10 rounded-full w-full max-w-[250px] shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all transform hover:scale-105 inline-block"
            >
              {t("common.startNow")}
            </button>
          </div>

          <div className="glass p-8 rounded-3xl flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-28 h-28 rounded-full bg-secondary/20 flex items-center justify-center mb-6 neon-border-secondary relative">
              <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{animationDelay: '1s'}} />
              <Mic className="w-14 h-14 text-secondary" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">{t("home.randomAudioTitle")}</h3>
            <p className="text-muted-foreground mb-8 text-lg">{t("home.randomAudioDesc")}</p>
            <button
              onClick={() => { setFiltersType("audio"); setShowFiltersModal(true); }}
              className="bg-secondary hover:bg-secondary/90 text-white font-bold text-xl py-4 px-10 rounded-full w-full max-w-[250px] shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all transform hover:scale-105 inline-block"
            >
              {t("common.startNow")}
            </button>
          </div>
        </motion.div>
      )}

      {/* Live Streams Section — Followed Accounts */}
      {activeTab === 'live' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Header with filters */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400" />
                {t("home.followedAccounts")}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-green-400">
                  <Circle className="w-2.5 h-2.5 fill-green-400" />
                  {videoLiveCount} {t("home.videoLiveLabel")}
                </span>
                <span className="text-white/30">|</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Circle className="w-2.5 h-2.5 fill-emerald-400" />
                  {audioLiveCount} {t("home.audioLiveLabel")}
                </span>
                <span className="text-white/30">|</span>
                <span className="flex items-center gap-1 text-white/40">
                  <Circle className="w-2.5 h-2.5 fill-white/30" />
                  {offlineCount} {t("home.offline")}
                </span>
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all' as const, label: t("home.filterAll"), count: followedAccounts.length },
                { key: 'videoLive' as const, label: t("home.filterVideoLive"), count: videoLiveCount },
                { key: 'audioLive' as const, label: t("home.filterAudioLive"), count: audioLiveCount },
                { key: 'offline' as const, label: t("home.filterOffline"), count: offlineCount },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setLiveFilter(f.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-300 ${
                    liveFilter === f.key
                      ? 'bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {/* Accounts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredAccounts.map((account) => (
                <motion.div
                  key={account.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link href={account.isLive ? (account.liveType === 'audio' ? `/live?audio=${account.id}` : `/room/${account.id}`) : `/profile/${account.id}`}>
                    <a className={`glass rounded-2xl p-4 flex items-center gap-4 group border transition-all duration-300 block ${
                      account.isLive && account.liveType === 'audio'
                        ? 'border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : account.isLive
                        ? 'border-green-500/20 hover:border-green-500/40 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                        : 'border-white/5 hover:border-white/15'
                    }`}>
                      {/* Avatar with status indicator */}
                      <div className="relative shrink-0">
                        <div className={`w-14 h-14 rounded-full overflow-hidden ${
                          account.isLive ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-[#0c0c1d]' : 'ring-1 ring-white/10'
                        }`}>
                          <img src={avatarImg} alt={account.displayName} className="w-full h-full object-cover" />
                        </div>
                        {/* Status dot */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0c0c1d] flex items-center justify-center ${
                          account.isLive && account.liveType === 'audio' ? 'bg-emerald-500' : account.isLive ? 'bg-green-500' : 'bg-gray-500'
                        }`}>
                          {account.isLive && (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-base truncate">{account.displayName}</h3>
                          {account.isLive && account.liveType === 'audio' ? (
                            <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-pulse">
                              <Mic className="w-2.5 h-2.5" />
                              AUDIO
                            </span>
                          ) : account.isLive ? (
                            <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              LIVE
                            </span>
                          ) : null}
                        </div>
                        <p className="text-white/40 text-sm truncate">@{account.username}</p>
                        {account.isLive ? (
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`${account.liveType === 'audio' ? 'text-emerald-400' : 'text-green-400'} text-xs font-medium truncate`}>{account.streamTitle}</span>
                            <span className="flex items-center gap-1 text-white/50 text-xs shrink-0">
                              <Eye className="w-3 h-3" />
                              {account.viewers >= 1000 ? (account.viewers / 1000).toFixed(1) + "K" : account.viewers}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-1 text-white/30 text-xs">
                            <Clock className="w-3 h-3" />
                            {t("home.lastSeen")} {getTimeSince(account.lastSeen, t)}
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div className="shrink-0">
                        {account.isLive && account.liveType === 'audio' ? (
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                            <Mic className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : account.isLive ? (
                          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center group-hover:bg-red-500/20 transition-all">
                            <Video className="w-4 h-4 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                            <Users className="w-4 h-4 text-white/40" />
                          </div>
                        )}
                      </div>
                    </a>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">{t("home.noFollowed")}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Hero Section */}
      <section className="relative w-full h-[250px] md:h-[300px] rounded-3xl overflow-hidden shadow-2xl">
        <img src={heroBg} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </section>
      </div>

      {/* Random Chat Modals */}
      <RandomFiltersModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        initialType={filtersType}
        onStart={(filters) => {
          setShowFiltersModal(false);
          setMatchFilters(filters);
          setShowMatching(true);
        }}
      />
      <MatchingScreen
        isOpen={showMatching}
        filters={matchFilters}
        onClose={() => setShowMatching(false)}
      />
    </div>
  );
}