import React, { useState, useEffect } from "react";
import { Login } from "./pages/Login";
import { Intro } from "./pages/Intro";
import { Dashboard } from "./pages/Dashboard";
import { DataRow, FilterState } from "./types";

interface SavedVersion {
  id: string;
  name: string;
  date: string;
  rows: number;
  data: DataRow[];
  filters: FilterState | null;
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem("sales_bi_user"));
  const [view, setView] = useState<"login" | "intro" | "dashboard">(() => (localStorage.getItem("sales_bi_view") as any) || "login");
  const [dataset, setDataset] = useState<DataRow[]>(() => {
    const stored = localStorage.getItem("sales_bi_dataset");
    try {
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [initialFilters, setInitialFilters] = useState<FilterState | null>(() => {
    const stored = localStorage.getItem("sales_bi_filters");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);

  // Load versions from local storage when email is set
  useEffect(() => {
    if (userEmail) {
      localStorage.setItem("sales_bi_user", userEmail);
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
    } else {
      localStorage.removeItem("sales_bi_user");
    }
  }, [userEmail]);

  // Sync view to local storage
  useEffect(() => {
    localStorage.setItem("sales_bi_view", view);
  }, [view]);

  // Sync dataset to local storage
  useEffect(() => {
    if (dataset.length > 0) {
      localStorage.setItem("sales_bi_dataset", JSON.stringify(dataset));
    } else {
      localStorage.removeItem("sales_bi_dataset");
    }
  }, [dataset]);

  // Sync filters to local storage
  useEffect(() => {
    if (initialFilters) {
      localStorage.setItem("sales_bi_filters", JSON.stringify(initialFilters));
    } else {
      localStorage.removeItem("sales_bi_filters");
    }
  }, [initialFilters]);

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

  const handleDataLoaded = (data: DataRow[], fileName: string = "Uploaded Data") => {
    setDataset(data);
    
    // Automatically save a new version upon load
    const newVersion: SavedVersion = {
      id: Date.now().toString(),
      name: fileName,
      date: new Date().toISOString(),
      rows: data.length,
      data: [...data],
      filters: null
    };
    setSavedVersions(prev => [newVersion, ...prev]);

    setView("dashboard");
  };

  const handleLoadVersion = (id: string) => {
    const v = savedVersions.find(v => v.id === id);
    if (v) {
      setDataset(v.data);
      setInitialFilters(v.filters);
      setView("dashboard");
    }
  };

  const handleDeleteVersion = (id: string) => {
    setSavedVersions(prev => prev.filter(v => v.id !== id));
  };

  const handleRenameVersion = (id: string, newName: string) => {
    setSavedVersions(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
  };

  const handleLogout = () => {
    setUserEmail(null);
    setDataset([]);
    setView("login");
    setInitialFilters(null);
    localStorage.removeItem("sales_bi_user");
    localStorage.removeItem("sales_bi_view");
    localStorage.removeItem("sales_bi_dataset");
    localStorage.removeItem("sales_bi_filters");
  };

  return (
    <div className="font-sans antialiased">
      {view === "login" && (
        <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
      )}
      
      {view === "intro" && (
        <Intro 
          onDataLoaded={handleDataLoaded} 
          savedVersions={savedVersions.map(v => ({ id: v.id, name: v.name || "Untitled", date: v.date, rows: v.rows }))}
          onLoadVersion={handleLoadVersion}
          onDeleteVersion={handleDeleteVersion}
          onRenameVersion={handleRenameVersion}
          onLogout={handleLogout}
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
          onBack={() => {
            setView("intro");
            setInitialFilters(null);
          }}
          savedVersions={savedVersions.map(v => ({ id: v.id, name: v.name || "Untitled", date: v.date, rows: v.rows }))}
          onLoadVersion={handleLoadVersion}
          onDeleteVersion={handleDeleteVersion}
          onRenameVersion={handleRenameVersion}
          onLogout={handleLogout}
          onInstall={installPrompt ? handleInstall : undefined}
          initialFilters={initialFilters}
          userEmail={userEmail || ""}
        />
      )}
    </div>
  );
}
