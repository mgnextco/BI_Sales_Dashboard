import React, { useEffect, useState } from "react";
import { Clock, ShieldAlert, LogOut, RefreshCw, UserCheck } from "lucide-react";
import { motion } from "motion/react";

interface AccessPendingScreenProps {
  userProfile: { role: string; name: string; approved?: boolean; rejected?: boolean } | null;
  onLogout: () => void;
  theme: "light" | "dark";
  onCheckStatus: () => Promise<void>;
}

export function AccessPendingScreen({ userProfile, onLogout, theme, onCheckStatus }: AccessPendingScreenProps) {
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>("");

  useEffect(() => {
    // Automatically poll status every 6 seconds to give a real-time reactive feel
    const interval = setInterval(async () => {
      try {
        await onCheckStatus();
        setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err) {
        console.warn("Auto status poll failed:", err);
      }
    }, 6000);

    setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    return () => clearInterval(interval);
  }, [onCheckStatus]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await onCheckStatus();
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  const isRejected = userProfile?.rejected === true;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${
      theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`max-w-md w-full bg-white dark:bg-slate-900 border ${
          isRejected 
            ? "border-red-200 dark:border-red-950/60" 
            : "border-slate-200 dark:border-slate-800"
        } p-8 rounded-2xl shadow-xl flex flex-col items-center text-center`}
      >
        {isRejected ? (
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-6">
            <ShieldAlert size={36} className="animate-bounce" />
          </div>
        ) : (
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <Clock size={32} className="animate-spin-slow" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
        )}

        <h2 className="text-2xl font-bold tracking-tight mb-2">
          {isRejected ? "Access Request Rejected" : "Approval Pending"}
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          {isRejected ? (
            "Your sign-up access request has been rejected or deleted by an administrator. Please contact your system administrator to authorize your profile, or log out and create a different account."
          ) : (
            "Thank you for registering! To maintain data security, all new sign-up requests must be approved by a system administrator before accessing sales intelligence data."
          )}
        </p>

        {userProfile && !isRejected && (
          <div className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-900 p-4 rounded-xl text-left mb-6 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-900">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Requested Profile</span>
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full select-none flex items-center gap-1">
                <Clock size={10} /> Pending Approval
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Name:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{userProfile.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Requested Role:</span>
              <span className="font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">{userProfile.role}</span>
            </div>
          </div>
        )}

        {lastChecked && !isRejected && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1.5 justify-center">
            <RefreshCw size={10} className={checking ? "animate-spin" : ""} />
            Last checked: {lastChecked} (Auto-checking every 6s)
          </div>
        )}

        <div className="w-full flex flex-row gap-3 font-sans">
          {!isRejected && (
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={checking}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 select-none disabled:opacity-75"
            >
              <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
              {checking ? "Checking..." : "Check Status"}
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 select-none"
          >
            <LogOut size={15} />
            {isRejected ? "Back to Login" : "Log Out"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
