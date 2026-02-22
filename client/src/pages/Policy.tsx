import { motion } from "framer-motion";
import { Shield, FileText, CheckCircle } from "lucide-react";

export function Policy({ type }: { type: 'privacy' | 'terms' }) {
  const content = type === 'privacy' ? {
    title: "سياسة الخصوصية",
    icon: Shield,
    sections: [
      { t: "جمع المعلومات", c: "نقوم بجمع المعلومات التي تقدمها لنا مباشرة عند إنشاء حسابك، مثل الاسم والبريد الإلكتروني." },
      { t: "استخدام البيانات", c: "نستخدم بياناتك لتحسين تجربة المستخدم، وتوفير الدعم الفني، وضمان أمان المنصة." },
      { t: "حماية البيانات", c: "نحن نستخدم أحدث تقنيات التشفير لضمان حماية بياناتك الشخصية والمحادثات." }
    ]
  } : {
    title: "اتفاقية الاستخدام",
    icon: FileText,
    sections: [
      { t: "شروط العضوية", c: "يجب أن يكون عمر المستخدم 18 عاماً على الأقل لاستخدام خدمات البث المباشر." },
      { t: "السلوك المقبول", c: "يمنع تماماً استخدام الألفاظ النابية أو المحتوى غير الأخلاقي داخل الغرف." },
      { t: "نظام النقاط", c: "النقاط المشتراة غير قابلة للاسترداد بعد استخدامها في إرسال الهدايا." }
    ]
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in py-10">
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
          <content.icon className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-black text-white mb-4">{content.title}</h1>
        <p className="text-white/40">آخر تحديث: 22 فبراير 2026</p>
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