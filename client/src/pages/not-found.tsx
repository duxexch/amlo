import { AlertCircle, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 text-center">
        <div className="glass p-8 rounded-3xl border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2">404</h1>
          <h2 className="text-xl font-bold text-white/80 mb-3">{t("notFound.title")}</h2>
          <p className="text-white/50 mb-8">
            {t("notFound.description")}
          </p>
          <Link href="/">
            <a className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl transition-all" aria-label={t("nav.home")}>
              <Home className="w-5 h-5" />
              {t("nav.home")}
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
