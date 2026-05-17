import React, { useState } from "react";
import { Footer } from "../components/Footer";
import { Mail, ArrowRight, Sun, Moon } from "lucide-react";
import { motion } from "motion/react";

interface LoginProps {
  onLogin: (email: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export function Login({ onLogin, theme, toggleTheme }: LoginProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@gmail.com")) {
      setError("Please use a valid @gmail.com email address.");
      return;
    }
    setError("");
    onLogin(email);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700"
        >
          <div className="p-8 text-center bg-blue-600 dark:bg-blue-700 text-white">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">BI Sales Dashboard</h1>
            <p className="text-blue-100">Enterprise Analytics Platform</p>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Sign in with Google Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail size={20} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 outline-none transition-all"
                    placeholder="name@gmail.com"
                  />
                </div>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:ring-4 focus:ring-blue-500/20"
              >
                Continue to Dashboard
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
      <Footer theme={theme} />
    </div>
  );
}
