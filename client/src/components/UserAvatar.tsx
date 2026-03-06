/**
 * Shared UserAvatar — أفاتار المستخدم الموحد
 * ════════════════════════════════════════
 * Single source of truth for user avatar display.
 * Used across Friends, ChatPopupModal, and other pages.
 */
import { memo } from "react";
import { Check } from "lucide-react";

const AVATAR_COLORS = [
  "from-primary to-secondary",
  "from-cyan-400 to-blue-500",
  "from-pink-400 to-rose-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
];

const SIZE_CLASSES: Record<string, string> = {
  xs: "w-7 h-7",
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-14 h-14",
};

const TEXT_CLASSES: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
};

interface UserAvatarProps {
  user: {
    displayName?: string | null;
    username?: string | null;
    avatar?: string | null;
    isOnline?: boolean;
    isVerified?: boolean;
  } | null;
  size?: "xs" | "sm" | "md" | "lg";
  showVerified?: boolean;
}

export const UserAvatar = memo(function UserAvatar({ user, size = "md", showVerified = true }: UserAvatarProps) {
  const name = user?.displayName || user?.username || "?";
  const color = AVATAR_COLORS[Math.abs(name.charCodeAt(0)) % AVATAR_COLORS.length];
  const initial = name[0]?.toUpperCase();

  return (
    <div className="relative shrink-0">
      {user?.avatar ? (
        <img src={user.avatar} alt="" className={`${SIZE_CLASSES[size]} rounded-2xl object-cover`} />
      ) : (
        <div className={`${SIZE_CLASSES[size]} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white ${TEXT_CLASSES[size]}`}>
          {initial}
        </div>
      )}
      {user?.isOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a1a] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      )}
      {showVerified && user?.isVerified && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </div>
  );
});
