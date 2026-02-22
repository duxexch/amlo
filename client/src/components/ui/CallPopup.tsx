import { motion, AnimatePresence } from "framer-motion";
import { Phone, Video, X } from "lucide-react";
import avatarImg from "@/assets/images/avatar-3d.png";

interface CallPopupProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  callerName?: string;
  isVideo?: boolean;
}

export function CallPopup({ isOpen, onAccept, onDecline, callerName = "مستخدم عشوائي", isVideo = true }: CallPopupProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-sm glass rounded-3xl p-6 border-primary/30 neon-border overflow-hidden"
          >
            {/* Pulsing background effect */}
            <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />
            
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary neon-border relative z-10">
                  <img src={avatarImg} alt="Caller" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">{callerName}</h3>
              <p className="text-primary font-medium animate-pulse mb-8 text-lg">
                {isVideo ? "مكالمة فيديو واردة..." : "مكالمة صوتية واردة..."}
              </p>
              
              <div className="flex gap-6 w-full justify-center">
                <button 
                  onClick={onDecline}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/80 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                >
                  <X className="w-8 h-8 text-white" />
                </button>
                <button 
                  onClick={onAccept}
                  className="w-16 h-16 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse-ring-accent relative"
                >
                  {isVideo ? <Video className="w-8 h-8 text-white z-10" /> : <Phone className="w-8 h-8 text-white z-10" />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}