import { motion } from "framer-motion";
import { Shield, FileText, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Policy({ type }: { type: 'privacy' | 'terms' }) {
  const { t } = useTranslation();
  const content = type === 'privacy' ? {
    title: t("policy.privacyTitle"),
    icon: Shield,
    sections: [
      { t: t("policy.privacy.s1Title"), c: t("policy.privacy.s1Content") },
      { t: t("policy.privacy.s2Title"), c: t("policy.privacy.s2Content") },
      { t: t("policy.privacy.s3Title"), c: t("policy.privacy.s3Content") }
    ]
  } : {
    title: t("policy.termsTitle"),
    icon: FileText,
    sections: [
      { t: t("policy.terms.s1Title"), c: t("policy.terms.s1Content") },
      { t: t("policy.terms.s2Title"), c: t("policy.terms.s2Content") },
      { t: t("policy.terms.s3Title"), c: t("policy.terms.s3Content") }
    ]
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in py-10">
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
          <content.icon className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-black text-white mb-4">{content.title}</h1>
        <p className="text-white/40">{t("policy.lastUpdated")}</p>
      </div>

      <div className="glass p-10 rounded-[3rem] border-white/10 space-y-10 leading-relaxed">
        {content.sections.map((s, i) => (
          <div key={i} className="space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {s.t}
            </h3>
            <p className="text-white/70 text-lg pr-7">{s.c}</p>
          </div>
        ))}
      </div>
    </div>
  );
}