import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import giftImg from "@/assets/images/gift-3d.png";

interface PopupButton {
  label: string;
  url: string;
  style: "primary" | "secondary";
}

interface PopupData {
  enabled: boolean;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttons: PopupButton[];
  showOnce: boolean;
  delaySeconds: number;
}

export function AnnouncementPopup() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<PopupData | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if already shown this session
    const alreadyShown = sessionStorage.getItem("announcement_popup_shown");

    fetch("/api/announcement-popup")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          const popup = res.data as PopupData;
          setData(popup);

          if (popup.showOnce && alreadyShown) return;

          const timer = setTimeout(() => {
            setVisible(true);
            if (popup.showOnce) {
              sessionStorage.setItem("announcement_popup_shown", "1");
            }
          }, (popup.delaySeconds || 8) * 1000);

          return () => clearTimeout(timer);
        }
      })
      .catch(() => {});
  }, []);

  const handleClose = () => setVisible(false);

  const handleButtonClick = (url: string) => {
    setVisible(false);
    if (url.startsWith("http")) {
      window.open(url, "_blank");
    } else {
      setLocation(url);
    }
  };

  if (!data) return null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Popup Card */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(168,85,247,0.15)] z-10"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all group"
            >
              <X className="w-4 h-4 text-white/60 group-hover:text-white" />
            </button>

            {/* Image */}
            <div className="w-full h-52 bg-gradient-to-br from-primary/30 via-[#0c0c1d] to-pink-500/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(168,85,247,0.25),transparent_70%)]" />
              <img
                src={data.imageUrl || giftImg}
                alt="Announcement"
                className="w-full h-full object-contain relative z-10 p-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = giftImg;
                }}
              />
            </div>

            {/* Content */}
            <div className="bg-[#0c0c1d] p-6 pt-5">
              {data.title && (
                <h3 className="text-xl font-black text-white text-center mb-1.5 leading-tight">
                  {data.title}
                </h3>
              )}
              {data.subtitle && (
                <p className="text-white/50 text-sm text-center leading-relaxed mb-5">
                  {data.subtitle}
                </p>
              )}

              {/* Buttons */}
              <div className="flex flex-col gap-2.5">
                {data.buttons.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => handleButtonClick(btn.url)}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      btn.style === "primary"
                        ? "bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                        : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {btn.label}
                    {btn.url.startsWith("http") && (
                      <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
