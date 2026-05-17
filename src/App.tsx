import React, { useState, useEffect } from "react";
import { Login } from "./pages/Login";
import { Intro } from "./pages/Intro";
import { Dashboard } from "./pages/Dashboard";
import { DataRow, FilterState } from "./types";

interface SavedVersion {
  id: string;
  date: string;
  rows: number;
  data: DataRow[];
  filters: FilterState;
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [view, setView] = useState<"login" | "intro" | "dashboard">("login");
  const [dataset, setDataset] = useState<DataRow[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [initialFilters, setInitialFilters] = useState<FilterState | null>(null);
  
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);

  // Load versions from local storage when email is set
  useEffect(() => {
    if (userEmail) {
      const storageKey = `sales_bi_versions_${userEmail}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setSavedVersions(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse saved versions", e);
        }
      } else {
        setSavedVersions([]);
      }
    }
  }, [userEmail]);

  // Save to local storage whenever savedVersions changes
  useEffect(() => {
    if (userEmail) {
      const storageKey = `sales_bi_versions_${userEmail}`;
      localStorage.setItem(storageKey, JSON.stringify(savedVersions));
    }
  }, [savedVersions, userEmail]);

  // Toggle theme and install prompt logic
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [theme]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  const handleLogin = (email: string) => {
    setUserEmail(email);
    setView("intro");
  };

  const handleDataLoaded = (data: DataRow[]) => {
    setDataset(data);
    setView("dashboard");
  };

  const handleSaveVersion = (filters: FilterState) => {
    const newVersion: SavedVersion = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      rows: dataset.length,
      data: [...dataset],
      filters: filters
    };
    setSavedVersions(prev => [newVersion, ...prev]);
    alert("Dashboard version saved successfully!");
  };

  const handleLoadVersion = (id: string) => {
    const v = savedVersions.find(v => v.id === id);
    if (v) {
      setDataset(v.data);
      setInitialFilters(v.filters);
      setView("dashboard");
    }
  };

  return (
    <div className="font-sans antialiased">
      {view === "login" && (
        <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
      )}
      
      {view === "intro" && (
        <Intro 
          onDataLoaded={handleDataLoaded} 
          savedVersions={savedVersions.map(v => ({ id: v.id, date: v.date, rows: v.rows }))}
          onLoadVersion={handleLoadVersion}
          theme={theme}
          toggleTheme={toggleTheme}
          onInstall={installPrompt ? handleInstall : undefined}
          userEmail={userEmail || ""}
        />
      )}

      {view === "dashboard" && (
        <Dashboard 
          data={dataset} 
          theme={theme} 
          toggleTheme={toggleTheme} 
          onSaveVersion={handleSaveVersion}
          onBack={() => {
            setView("intro");
            setInitialFilters(null);
          }}
          savedVersions={savedVersions.map(v => ({ id: v.id, date: v.date, rows: v.rows }))}
          onLoadVersion={handleLoadVersion}
          onInstall={installPrompt ? handleInstall : undefined}
          initialFilters={initialFilters}
          userEmail={userEmail || ""}
        />
      )}
    </div>
  );
}
