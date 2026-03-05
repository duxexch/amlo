import { motion } from "framer-motion";
import { UserPlus, Heart, MessageCircle, Crown, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import avatarImg from "@/assets/images/avatar-3d.png";
import { COUNTRIES } from "@/lib/countries";

interface MatchedUser {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  country?: string;
  gender?: string;
  level?: number;
  bio?: string;
}

interface MatchedUserCardProps {
  user: MatchedUser;
  onStartChat: () => void;
  onFollow: () => void;
  onClose?: () => void;
  isFollowed?: boolean;
}

export function MatchedUserCard({ user, onStartChat, onFollow, onClose, isFollowed }: MatchedUserCardProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const countryData = user.country ? COUNTRIES.find(c => c.code === user.country) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 50 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="w-full max-w-sm mx-auto"
    >
      <div className="glass rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-emerald-500/30 via-cyan-500/20 to-primary/20 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-10 relative z-10">
          <div className="w-20 h-20 rounded-full border-4 border-[#0c0c1d] overflow-hidden ring-2 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <img src={user.avatar || avatarImg} alt={user.displayName || ""} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Info */}
        <div className="text-center px-6 pt-3 pb-6">
          <h4 className="text-white font-bold text-lg">{user.displayName || user.username || "مستخدم"}</h4>
          {user.username && <p className="text-white/40 text-xs mt-0.5">@{user.username}</p>}

          {/* Level + Country */}
          <div className="flex items-center justify-center gap-2 mt-2">
            {user.level && (
              <span className="bg-gradient-to-r from-primary to-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full">
                LV.{user.level}
              </span>
            )}
            {countryData && (
              <span className="bg-white/5 text-white/60 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                {countryData.flag} {isAr ? countryData.nameAr : countryData.nameEn}
              </span>
            )}
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-white/30 text-xs mt-3 line-clamp-2">{user.bio}</p>
          )}

          {/* Match indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 rounded-full bg-emerald-400"
            />
            <span className="text-emerald-400 text-sm font-bold">{t("world.matchFound")}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={onFollow}
              disabled={isFollowed}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                isFollowed
                  ? "bg-pink-500/20 border border-pink-500/30 text-pink-400"
                  : "bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFollowed ? "fill-pink-400" : ""}`} />
              {t("room.follow")}
            </button>
            <button
              onClick={onStartChat}
              className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all transform hover:scale-[1.02]"
            >
              <MessageCircle className="w-4 h-4" />
              {t("world.chat.startChat")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
