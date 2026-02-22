import { motion } from "framer-motion";
import { History, ShieldCheck } from "lucide-react";
import coinImg from "@/assets/images/coin-3d.png";

export function Wallet() {
  const packages = [
    { coins: 100, price: "$0.99", bonus: 0 },
    { coins: 500, price: "$4.99", bonus: 50 },
    { coins: 1000, price: "$9.99", bonus: 150 },
    { coins: 2000, price: "$18.99", bonus: 350 },
    { coins: 5000, price: "$44.99", bonus: 1000 },
    { coins: 10000, price: "$89.99", bonus: 2500, popular: true },
    { coins: 20000, price: "$169.99", bonus: 6000 },
    { coins: 50000, price: "$399.99", bonus: 18000 },
    { coins: 100000, price: "$749.99", bonus: 40000 },
    { coins: 500000, price: "$2999.99", bonus: 250000 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-white" style={{fontFamily: 'Outfit'}}>المحفظة</h1>
        <button className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/10">
          <History className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Balance Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass p-8 md:p-10 rounded-[2rem] relative overflow-hidden border border-white/20 shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-white/80 font-bold text-lg mb-2">الرصيد الحالي</p>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-black text-white neon-text tracking-tight">1,250</span>
              <span className="text-2xl text-yellow-400 font-black mb-2 drop-shadow-md">كوينز</span>
            </div>
          </div>
          
          <img src={coinImg} alt="Coins" className="w-32 h-32 md:w-40 md:h-40 object-contain animate-float drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]" />
        </div>
      </motion.div>

      {/* Packages */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          شحن الرصيد
          <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">10 باقات متاحة</span>
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {packages.map((pkg, i) => (
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              key={i}
              className={`glass p-6 rounded-3xl flex flex-col items-center text-center relative overflow-hidden group transition-all duration-300 hover:-translate-y-2 ${pkg.popular ? 'border-2 border-primary neon-border bg-primary/5' : 'border border-white/10 hover:border-primary/50'}`}
            >
              {pkg.popular && (
                <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold py-1.5 shadow-md">
                  الأكثر مبيعاً
                </div>
              )}
              
              <div className="w-20 h-20 mt-6 mb-4 relative">
                <img src={coinImg} alt="Coin" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-lg" />
              </div>
              
              <div className="flex items-center gap-1 mb-2">
                <span className="text-3xl font-black text-white">{pkg.coins.toLocaleString()}</span>
              </div>
              
              {pkg.bonus > 0 ? (
                <div className="text-sm font-bold text-green-400 mb-6 bg-green-400/10 px-3 py-1 rounded-lg border border-green-400/20">
                  +{pkg.bonus.toLocaleString()} بونص
                </div>
              ) : (
                 <div className="h-8 mb-6" />
              )}
              
              <div className="w-full py-3 md:py-4 rounded-2xl bg-white/10 font-bold text-white mt-auto group-hover:bg-primary transition-all duration-300 text-lg border border-white/5">
                {pkg.price}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="glass p-8 rounded-3xl mt-10 flex flex-col md:flex-row items-center justify-between gap-8 border-white/10 bg-gradient-to-r from-white/5 to-transparent">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
            <ShieldCheck className="text-green-400 w-6 h-6" />
            دفع آمن 100%
          </h3>
          <p className="text-white/70 max-w-md font-medium leading-relaxed">
            ندعم كافة وسائل الدفع العالمية والمحلية متوافقة مع متجر جوجل بلاي و أبل ستور. جميع المعاملات مشفرة وآمنة.
          </p>
        </div>
        <div className="flex gap-4 flex-wrap justify-center">
          <div className="h-14 px-6 bg-white/10 rounded-xl flex items-center justify-center font-bold text-white border border-white/10 hover:bg-white/20 transition-colors">Visa</div>
          <div className="h-14 px-6 bg-white/10 rounded-xl flex items-center justify-center font-bold text-white border border-white/10 hover:bg-white/20 transition-colors">MasterCard</div>
          <div className="h-14 px-6 bg-white/10 rounded-xl flex items-center justify-center font-bold text-white border border-white/10 hover:bg-white/20 transition-colors">Apple Pay</div>
          <div className="h-14 px-6 bg-white/10 rounded-xl flex items-center justify-center font-bold text-white border border-white/10 hover:bg-white/20 transition-colors">Google Pay</div>
        </div>
      </div>
    </div>
  );
}