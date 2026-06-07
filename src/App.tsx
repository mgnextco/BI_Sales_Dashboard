import React, { useState, useEffect } from "react";
import { Login } from "./pages/Login";
import { Intro } from "./pages/Intro";
import { Dashboard } from "./pages/Dashboard";
import { AccessPendingScreen } from "./components/AccessPendingScreen";
import { FileSpreadsheet } from "lucide-react";
import { DataRow, FilterState } from "./types";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc 
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { saveLocalDataset, getLocalDataset, deleteLocalDataset } from "./lib/localDataStore";

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
  const [userProfile, setUserProfile] = useState<{ role: string; name: string; approved?: boolean; rejected?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
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
  
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>(() => {
    const stored = localStorage.getItem("sales_bi_saved_versions_metadata");
    try {
      return stored ? JSON.parse(stored).map((v: any) => ({ ...v, data: [] })) : [];
    } catch (e) {
      return [];
    }
  });
  const [uploadProgress, setUploadProgress] = useState<{
    active: boolean;
    stepName: string;
    percentage: number;
    fileName: string;
  } | null>(null);

  // 1. Establish Firebase Authentication session listener or Local Guest session
  useEffect(() => {
    const isLocalAuth = localStorage.getItem("sales_bi_local_auth") === "true";
    if (isLocalAuth) {
      const email = localStorage.getItem("sales_bi_user") || "admin@gmail.com";
      setUserEmail(email);
      
      const cleanEmail = email.trim().toLowerCase();
      const isOwnerEmail = cleanEmail === "michel.gamal.honor@gmail.com" || cleanEmail === "admin@gmail.com" || cleanEmail === "admin@mgnext.com";
      
      let localProfile = {
        role: isOwnerEmail ? "Administrator" : "Viewer",
        name: cleanEmail === "admin@gmail.com" ? "Default Administrator" : "Michel Gamal",
        approved: true
      };

      try {
        const storedUsersStr = localStorage.getItem("sales_bi_all_users");
        if (storedUsersStr) {
          const allLocalUsers = JSON.parse(storedUsersStr);
          const found = allLocalUsers.find((u: any) => u.email.trim().toLowerCase() === cleanEmail);
          if (found) {
            localProfile = {
              role: found.role || (isOwnerEmail ? "Administrator" : "Viewer"),
              name: found.name || (cleanEmail === "admin@gmail.com" ? "Default Administrator" : "Michel Gamal"),
              approved: found.approved !== false // default true for local fallback
            };
          }
        }
      } catch (err) {
        console.warn("Failed to retrieve profile particulars from local storage directory:", err);
      }

      setUserProfile(localProfile);
      if (view === "login") {
        setView("intro");
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserEmail(currentUser.email);
        localStorage.setItem("sales_bi_user", currentUser.email || "");
        
        // Retrieve custom user profile document from Firestore to map their access role
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          const isOwnerEmail = currentUser.email === "michel.gamal.honor@gmail.com" || currentUser.email === "admin@gmail.com" || currentUser.email === "admin@mgnext.com";
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile({ 
              role: data.role, 
              name: data.name, 
              approved: isOwnerEmail ? true : (data.approved !== false) 
            });
          } else {
            // Default role fallback
            setUserProfile({ 
              role: isOwnerEmail ? "Administrator" : "Viewer", 
              name: currentUser.displayName || "User",
              approved: isOwnerEmail,
              rejected: !isOwnerEmail
            });
          }
        } catch (e) {
          console.error("Failed to query user profile from Firestore:", e);
          const isOwnerEmail = currentUser.email === "michel.gamal.honor@gmail.com" || currentUser.email === "admin@gmail.com" || currentUser.email === "admin@mgnext.com";
          setUserProfile({ 
            role: isOwnerEmail ? "Administrator" : "Viewer", 
            name: currentUser.displayName || "User",
            approved: isOwnerEmail
          });
        }

        // Auto-redirect if starting on Login view
        if (view === "login") {
          setView("intro");
        }
      } else {
        const stillLocal = localStorage.getItem("sales_bi_local_auth") === "true";
        if (!stillLocal) {
          setUserEmail(null);
          setUserProfile(null);
          localStorage.removeItem("sales_bi_user");
          setView("login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [view]);

  // 2. Fetch Report Versions from Firestore or Local Cache
  useEffect(() => {
    if (!userEmail || loading) {
      return;
    }

    const loadVersions = async () => {
      const isLocalAuth = localStorage.getItem("sales_bi_local_auth") === "true";
      
      // Load from local storage cache first to show instantly
      const localMetaStr = localStorage.getItem("sales_bi_saved_versions_metadata");
      if (localMetaStr) {
        try {
          const parsed = JSON.parse(localMetaStr);
          setSavedVersions(parsed.map((v: any) => ({ ...v, data: [] })));
        } catch (_) {}
      }

      // If in guest mode, skip remote database fetch
      if (isLocalAuth || !auth.currentUser) {
        return;
      }

      const uid = auth.currentUser?.uid;
      const email = auth.currentUser?.email;
      const isAdminUser = userProfile?.role === "Administrator" || email === "michel.gamal.honor@gmail.com" || email === "admin@gmail.com" || email === "admin@mgnext.com";
      
      const versionsPath = "versions";
      try {
        let q;
        if (isAdminUser) {
          // Fetch only metadata documents (which contain layout, name, and meta details without raw block arrays)
          q = query(collection(db, versionsPath), where("isMetadata", "==", true));
        } else {
          // Fetch only metadata documents owned by this user
          q = query(collection(db, versionsPath), where("ownerUid", "==", uid), where("isMetadata", "==", true));
        }

        const snapshot = await getDocs(q);
        const fetched: SavedVersion[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          fetched.push({
            id: docSnap.id,
            name: data.name,
            date: data.date,
            rows: data.rows,
            data: [], // empty during list load, will be lazy loaded!
            filters: data.filters || null
          });
        });

        // 100% Backward Compatibility: Fallback for existing old-style documents if no new-style documents exist yet
        if (fetched.length === 0) {
          const fallbackQ = isAdminUser
            ? collection(db, versionsPath)
            : query(collection(db, versionsPath), where("ownerUid", "==", uid));
          const fallbackSnapshot = await getDocs(fallbackQ);
          fallbackSnapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data.isData) return; // Skip data documents
            fetched.push({
              id: docSnap.id,
              name: data.name,
              date: data.date,
              rows: data.rows,
              data: data.data || [],
              filters: data.filters || null
            });
          });
        }
        
        // Order descending by creation/save date
        fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSavedVersions(fetched);

        // Sync lightweight list to local storage
        const lightweight = fetched.map(v => ({
          id: v.id,
          name: v.name,
          date: v.date,
          rows: v.rows,
          filters: v.filters
        }));
        localStorage.setItem("sales_bi_saved_versions_metadata", JSON.stringify(lightweight));
      } catch (err) {
        console.warn("Failed to query versions from Firestore. Continuing with offline index:", err);
      }
    };

    loadVersions();
  }, [userEmail, userProfile, loading]);

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

  const handleDataLoaded = async (data: DataRow[], fileName: string = "Uploaded Data") => {
    // Start of process
    setUploadProgress({
      active: true,
      stepName: "Verifying document structure & headers...",
      percentage: 15,
      fileName
    });

    await new Promise(resolve => setTimeout(resolve, 600));

    setUploadProgress({
      active: true,
      stepName: `Parsing and processing ${data.length.toLocaleString()} records...`,
      percentage: 35,
      fileName
    });

    setDataset(data);
    
    // Create new dashboard data version under ownership model
    const versionId = Date.now().toString();
    const uid = auth.currentUser?.uid || "anonymous";
    const email = userEmail || auth.currentUser?.email || "anonymous@gmail.com";
    const isLocalAuth = localStorage.getItem("sales_bi_local_auth") === "true";
    
    const metadataPayload = {
      id: versionId,
      name: fileName,
      date: new Date().toISOString(),
      rows: data.length,
      filters: null,
      ownerUid: uid,
      ownerEmail: email,
      isMetadata: true
    };

    try {
      setUploadProgress({
        active: true,
        stepName: "Saving dataset securely locally in your browser...",
        percentage: 60,
        fileName
      });
      
      // Save the raw dataset details locally using IndexedDB (linked securely to this user)
      await saveLocalDataset(uid, versionId, data);
      
      if (!isLocalAuth && auth.currentUser) {
        setUploadProgress({
          active: true,
          stepName: "Synchronizing report metadata to Firestore index...",
          percentage: 85,
          fileName
        });
        
        // Save ONLY the lightweight metadata document inside the Firestore collection
        await setDoc(doc(db, "versions", versionId), metadataPayload);
      }
      
      const newLocalVersion: SavedVersion = {
        id: metadataPayload.id,
        name: metadataPayload.name,
        date: metadataPayload.date,
        rows: metadataPayload.rows,
        data: data,
        filters: metadataPayload.filters
      };
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setSavedVersions(prev => {
        const updated = [newLocalVersion, ...prev];
        const lightweight = updated.map(v => ({
          id: v.id,
          name: v.name,
          date: v.date,
          rows: v.rows,
          filters: v.filters
        }));
        localStorage.setItem("sales_bi_saved_versions_metadata", JSON.stringify(lightweight));
        return updated;
      });
    } catch (err) {
      console.warn("Failed to synchronize report metadata (saving locally instead):", err);
      
      const newLocalVersion: SavedVersion = {
        id: metadataPayload.id,
        name: metadataPayload.name,
        date: metadataPayload.date,
        rows: metadataPayload.rows,
        data: data,
        filters: metadataPayload.filters
      };
      setSavedVersions(prev => {
        const updated = [newLocalVersion, ...prev];
        const lightweight = updated.map(v => ({
          id: v.id,
          name: v.name,
          date: v.date,
          rows: v.rows,
          filters: v.filters
        }));
        localStorage.setItem("sales_bi_saved_versions_metadata", JSON.stringify(lightweight));
        return updated;
      });
    }

    setUploadProgress({
      active: true,
      stepName: "Compiling business intelligence analytics...",
      percentage: 95,
      fileName
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    setUploadProgress(null);
    setView("dashboard");
  };

  const handleLoadVersion = async (id: string) => {
    const v = savedVersions.find(v => v.id === id);
    const name = v ? v.name : "Saved Report";
    const filters = v ? v.filters : null;

    // Check if the dataset is already fully loaded in memory for this version
    if (v && v.data && v.data.length > 0) {
      setDataset(v.data);
      setInitialFilters(filters);
      setView("dashboard");
      return;
    }

    setUploadProgress({
      active: true,
      stepName: "Accessing local browser database cache...",
      percentage: 20,
      fileName: name
    });

    const uid = auth.currentUser?.uid || "anonymous";

    try {
      await new Promise(resolve => setTimeout(resolve, 200));

      // Attempt fast local load from IndexedDB
      const localRecords = await getLocalDataset(uid, id);
      if (localRecords && localRecords.length > 0) {
        setUploadProgress({
          active: true,
          stepName: "Loading cached records from IndexedDB...",
          percentage: 60,
          fileName: name
        });
        await new Promise(resolve => setTimeout(resolve, 150));

        setDataset(localRecords);
        setInitialFilters(filters);
        setSavedVersions(prev => prev.map(item => item.id === id ? { ...item, data: localRecords } : item));
        
        setUploadProgress({
          active: true,
          stepName: "Compiling business intelligence analytics...",
          percentage: 95,
          fileName: name
        });
        await new Promise(resolve => setTimeout(resolve, 150));
        
        setView("dashboard");
        return;
      }

      // Fallback: If not found locally, load from Firestore
      setUploadProgress({
        active: true,
        stepName: "Local cache empty. Attempting Firestore fallback download...",
        percentage: 45,
        fileName: name
      });

      // Try reading the optimized separate _data document from Firestore
      const dataDocSnap = await getDoc(doc(db, "versions", id + "_data"));
      if (dataDocSnap.exists()) {
        const payload = dataDocSnap.data();
        const records = payload.data || [];
        
        // Cache locally for next times
        try {
          await saveLocalDataset(uid, id, records);
        } catch (dbErr) {
          console.error("Failed to write to IndexedDB:", dbErr);
        }

        setDataset(records);
        setInitialFilters(filters);
        
        setSavedVersions(prev => prev.map(item => item.id === id ? { ...item, data: records } : item));
        
        setUploadProgress({
          active: true,
          stepName: "Compiling business intelligence analytics...",
          percentage: 95,
          fileName: name
        });
        await new Promise(resolve => setTimeout(resolve, 150));

        setView("dashboard");
      } else {
        // 100% Backward Compatibility: Fallback for older direct-save documents
        const mainDocSnap = await getDoc(doc(db, "versions", id));
        if (mainDocSnap.exists()) {
          const payload = mainDocSnap.data();
          const records = payload.data || [];
          
          // Cache locally for next times
          try {
            await saveLocalDataset(uid, id, records);
          } catch (dbErr) {
            console.error("Failed to write to IndexedDB:", dbErr);
          }

          setDataset(records);
          setInitialFilters(filters);
          
          setSavedVersions(prev => prev.map(item => item.id === id ? { ...item, data: records } : item));
          
          setUploadProgress({
            active: true,
            stepName: "Compiling business intelligence analytics...",
            percentage: 95,
            fileName: name
          });
          await new Promise(resolve => setTimeout(resolve, 150));

          setView("dashboard");
        } else {
          // Document not found in both local storage and remote Firestore index
          alert(`Could not load files: This dataset doesn't exist locally or on Firestore.`);
        }
      }
    } catch (err) {
      console.error("Failed to lazy load dataset:", err);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDeleteVersion = async (id: string) => {
    const uid = auth.currentUser?.uid || "anonymous";
    const isLocalAuth = localStorage.getItem("sales_bi_local_auth") === "true";
    
    try {
      if (!isLocalAuth && auth.currentUser) {
        await deleteDoc(doc(db, "versions", id));
        try {
          await deleteDoc(doc(db, "versions", id + "_data"));
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Failed to delete remote metadata from Firestore:", err);
    }

    try {
      await deleteLocalDataset(uid, id);
    } catch (localDbErr) {
      console.error("Failed to delete local idb dataset:", localDbErr);
    }

    setSavedVersions(prev => {
      const updated = prev.filter(v => v.id !== id);
      const lightweight = updated.map(v => ({
        id: v.id,
        name: v.name,
        date: v.date,
        rows: v.rows,
        filters: v.filters
      }));
      localStorage.setItem("sales_bi_saved_versions_metadata", JSON.stringify(lightweight));
      return updated;
    });
  };

  const handleResetAllDatabase = async () => {
    const uid = auth.currentUser?.uid || "anonymous";
    const email = userEmail || auth.currentUser?.email || "";
    const isLocalAuth = localStorage.getItem("sales_bi_local_auth") === "true";
    const isAdminUser = userProfile?.role === "Administrator" || email === "michel.gamal.honor@gmail.com" || email === "admin@gmail.com" || email === "admin@mgnext.com";

    setUploadProgress({
      active: true,
      stepName: "Initiating database reset schema sequence...",
      percentage: 10,
      fileName: "System Database Reset"
    });

    try {
      if (!isLocalAuth && auth.currentUser) {
        setUploadProgress({
          active: true,
          stepName: "Fetching active Firestore document indexing paths...",
          percentage: 30,
          fileName: "System Database Reset"
        });

        const versionsPath = "versions";
        let q;
        if (isAdminUser) {
          q = collection(db, versionsPath);
        } else {
          q = query(collection(db, versionsPath), where("ownerUid", "==", uid));
        }

        const snapshot = await getDocs(q);
        const docsToDelete: string[] = [];
        snapshot.forEach((docSnap) => {
          docsToDelete.push(docSnap.id);
        });

        if (docsToDelete.length > 0) {
          setUploadProgress({
            active: true,
            stepName: `Purging ${docsToDelete.length} files from remote database...`,
            percentage: 50,
            fileName: "System Database Reset"
          });

          await Promise.all(
            docsToDelete.map(async (docId) => {
              try {
                await deleteDoc(doc(db, "versions", docId));
              } catch (err) {
                console.error(`Error deleting Firestore document ${docId}:`, err);
              }

              try {
                const cleanId = docId.endsWith("_data") ? docId.slice(0, -5) : docId;
                await deleteLocalDataset(uid, cleanId);
              } catch (err) {
                console.error(`Error deleting local idb dataset for ${docId}:`, err);
              }
            })
          );
        }

        // Additionally, purge all users from "users" Firestore collection EXCEPT admin@mgnext.com & michel.gamal.honor@gmail.com
        if (isAdminUser) {
          setUploadProgress({
            active: true,
            stepName: "Purging users list, preserving mgnext admin accounts...",
            percentage: 75,
            fileName: "System Database Reset"
          });
          try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const usersToDelete: string[] = [];
            let hasMgnextAdmin = false;
            let hasOwnerUser = false;

            usersSnapshot.forEach((userSnap) => {
              const userData = userSnap.data();
              const userEmailClean = (userData.email || "").trim().toLowerCase();
              if (userEmailClean === "admin@mgnext.com") {
                hasMgnextAdmin = true;
              } else if (userEmailClean === "michel.gamal.honor@gmail.com") {
                hasOwnerUser = true;
              } else {
                usersToDelete.push(userSnap.id);
              }
            });

            await Promise.all(
              usersToDelete.map(async (userId) => {
                await deleteDoc(doc(db, "users", userId));
              })
            );

            // If the core admin/owner profiles aren't in Firestore anymore, re-seed them as active workspace admins
            if (!hasMgnextAdmin) {
              await setDoc(doc(db, "users", "admin_mgnext_scratch"), {
                uid: "admin_mgnext_scratch",
                email: "admin@mgnext.com",
                name: "MGNext Administrator",
                role: "Administrator",
                approved: true,
                createdAt: new Date().toISOString()
              });
            }
            if (!hasOwnerUser) {
              await setDoc(doc(db, "users", "michel_gamal_scratch"), {
                uid: "michel_gamal_scratch",
                email: "michel.gamal.honor@gmail.com",
                name: "Michel Gamal",
                role: "Administrator",
                approved: true,
                createdAt: new Date().toISOString()
              });
            }
          } catch (usersErr) {
            console.warn("Failed to purge registered users from Firestore:", usersErr);
          }
        }
      } else {
        // Just clear IndexedDB stores for this user
        try {
          const storedLocal = localStorage.getItem("sales_bi_saved_versions_metadata");
          if (storedLocal) {
            const parsed = JSON.parse(storedLocal);
            await Promise.all(parsed.map((item: any) => deleteLocalDataset(uid, item.id)));
          }
        } catch (_) {}
      }

      // Synchronize and apply user list cleanup to local storage offline fallback
      try {
        const storedUsersStr = localStorage.getItem("sales_bi_all_users") || "[]";
        let allLocalUsers = JSON.parse(storedUsersStr);
        if (!Array.isArray(allLocalUsers)) allLocalUsers = [];

        const hasMgnext = allLocalUsers.some((u: any) => (u.email || "").trim().toLowerCase() === "admin@mgnext.com");
        const hasMichelLocal = allLocalUsers.some((u: any) => (u.email || "").trim().toLowerCase() === "michel.gamal.honor@gmail.com");

        const newFiltered: any[] = [];
        if (hasMgnext) {
          const match = allLocalUsers.find((u: any) => (u.email || "").trim().toLowerCase() === "admin@mgnext.com");
          newFiltered.push(match);
        } else {
          newFiltered.push({
            email: "admin@mgnext.com",
            passwordHash: "Admin123!",
            name: "MGNext Administrator",
            role: "Administrator",
            approved: true,
            createdAt: new Date().toISOString()
          });
        }

        if (hasMichelLocal) {
          const match = allLocalUsers.find((u: any) => (u.email || "").trim().toLowerCase() === "michel.gamal.honor@gmail.com");
          newFiltered.push(match);
        } else {
          newFiltered.push({
            email: "michel.gamal.honor@gmail.com",
            passwordHash: "Password123!",
            name: "Michel Gamal",
            role: "Administrator",
            approved: true,
            createdAt: new Date().toISOString()
          });
        }
        localStorage.setItem("sales_bi_all_users", JSON.stringify(newFiltered));
      } catch (err) {
        console.warn("localStorage user purge error:", err);
      }

      setUploadProgress({
        active: true,
        stepName: "Flushing all local workbook memory caches...",
        percentage: 90,
        fileName: "System Database Reset"
      });

      // Clear local memory states
      setSavedVersions([]);
      setDataset([]);
      setInitialFilters(null);

      // Clear temporary local storage artifacts
      localStorage.removeItem("sales_bi_dataset");
      localStorage.removeItem("sales_bi_filters");
      localStorage.removeItem("sales_bi_saved_versions_metadata");

      await new Promise(resolve => setTimeout(resolve, 400));
    } catch (err) {
      console.error("Critical error resetting database:", err);
      alert(`Could not fully reset database: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleRenameVersion = async (id: string, newName: string) => {
    const isLocalAuth = localStorage.getItem("sales_bi_local_auth") === "true";
    try {
      if (!isLocalAuth && auth.currentUser) {
        await updateDoc(doc(db, "versions", id), { name: newName });
      }
    } catch (err) {
      console.warn("Failed to rename report version in Firestore:", err);
    }

    setSavedVersions(prev => {
      const updated = prev.map(v => v.id === id ? { ...v, name: newName } : v);
      const lightweight = updated.map(v => ({
        id: v.id,
        name: v.name,
        date: v.date,
        rows: v.rows,
        filters: v.filters
      }));
      localStorage.setItem("sales_bi_saved_versions_metadata", JSON.stringify(lightweight));
      return updated;
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (signOutErr) {
      console.error("SignOut Failed:", signOutErr);
    }
    
    setUserEmail(null);
    setUserProfile(null);
    setDataset([]);
    setView("login");
    setInitialFilters(null);
    localStorage.removeItem("sales_bi_user");
    localStorage.removeItem("sales_bi_view");
    localStorage.removeItem("sales_bi_dataset");
    localStorage.removeItem("sales_bi_filters");
    localStorage.removeItem("sales_bi_local_auth");
    localStorage.removeItem("sales_bi_saved_versions_metadata");
  };

  const checkStatus = async () => {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const isOwnerEmail = auth.currentUser.email === "michel.gamal.honor@gmail.com" || auth.currentUser.email === "admin@gmail.com" || auth.currentUser.email === "admin@mgnext.com";
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile({ 
          role: data.role, 
          name: data.name, 
          approved: isOwnerEmail ? true : (data.approved !== false) 
        });
      } else {
        setUserProfile({ 
          role: "Viewer", 
          name: auth.currentUser.displayName || "User", 
          approved: isOwnerEmail,
          rejected: !isOwnerEmail
        });
      }
    } catch (e) {
      console.error("Error re-checking user approval status:", e);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-12 h-12 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wider text-slate-600 dark:text-slate-300">Loading BI Sales Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased">
      {view === "login" && (
        <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
      )}
      
      {view !== "login" && userProfile && userProfile.approved === false && (
        <AccessPendingScreen 
          userProfile={userProfile}
          onLogout={handleLogout}
          theme={theme}
          onCheckStatus={checkStatus}
        />
      )}
      
      {view === "intro" && (userProfile?.approved !== false) && (
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
          onResetDatabase={handleResetAllDatabase}
          userProfile={userProfile}
        />
      )}

      {view === "dashboard" && (userProfile?.approved !== false) && (
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

      {uploadProgress && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 ${theme === "dark" ? "bg-slate-950/95 text-slate-100" : "bg-white/95 text-slate-800"} backdrop-blur-md transition-all duration-300`}>
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl flex flex-col items-center text-center">
            {/* Spinning/Animating Header Visual */}
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileSpreadsheet className="w-8 h-8 animate-bounce" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-2">Importing Sales Intelligence Data</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate w-full max-w-xs mb-6">
              File: <span className="font-semibold text-blue-600 dark:text-blue-400">{uploadProgress.fileName}</span>
            </p>

            {/* Custom Fluid Progress Bar */}
            <div className="w-full bg-slate-150 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3 relative">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </div>

            <div className="w-full flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
              <span>{uploadProgress.stepName}</span>
              <span className="text-blue-600 dark:text-blue-400">{uploadProgress.percentage}%</span>
            </div>

            <div className="text-xs text-slate-400 dark:text-slate-500 italic max-w-xs leading-relaxed">
              Large datasets require moments to compile indices and securely synchronize with your Cloud Run + Firestore repository.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
