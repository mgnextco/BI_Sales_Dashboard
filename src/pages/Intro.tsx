import React, { useRef, useState } from "react";
import { Footer } from "../components/Footer";
import { Upload, Download, FileSpreadsheet, ChevronRight, AlertCircle, History, Sun, Moon, Smartphone, BarChart3, Trash2, Edit2, Check, X, LogOut } from "lucide-react";
import { motion } from "motion/react";
import Papa from "papaparse";
import { DataRow } from "../types";

interface IntroProps {
  onDataLoaded: (data: DataRow[], fileName?: string) => void;
  savedVersions: { id: string; name: string; date: string; rows: number }[];
  onLoadVersion: (id: string) => void;
  onDeleteVersion: (id: string) => void;
  onRenameVersion?: (id: string, newName: string) => void;
  onLogout?: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onInstall?: () => void;
  userEmail: string;
}

const TEMPLATE_HEADERS = ["Region", "BU Line", "Brand Name", "Therapy Area", "Category", "Assignees", "Month", "Sales Value", "Target Value", "Past Year Value"];

const DUMMY_DATA = `Region,BU Line,Brand Name,Therapy Area,Category,Assignees,Month,Sales Value,Target Value,Past Year Value
West,BU Oncology,Eliquis,Gastroenterology,Biosimilar,George Miller,February,48646.58,34111.97,8000.63
North,BU Pharma,Lipitor,Neurology,Generic,Fiona Gallagher,April,36863.39,45555.63,33054.99
North,BU Oncology,Eliquis,Oncology,Generic,Diana Prince,April,9878.57,44296.08,34796.78
West,BU Oncology,Opdivo,Cardiology,Original,Fiona Gallagher,June,6304.59,43198.29,31189.29
East,BU Pharma,Keytruda,Immunology,Original,Edward Norton,January,39793.12,20236.55,8721.85
North,BU Consumer Health,Humira,Neurology,Biosimilar,Bob Smith,May,30737.6,41186.55,33493.22
West,BU Vaccines,Aspirin,Neurology,Original,Charlie Davis,June,48093.29,39965.51,15046.5
South,BU Consumer Health,Nexium,Oncology,Generic,Hannah Abbott,January,39425.28,27757.49,11705.24
West,BU Consumer Health,Keytruda,Oncology,Generic,George Miller,February,46889.99,41213.23,44771.6
Central,BU Oncology,Enbrel,Immunology,Biosimilar,Hannah Abbott,February,18870.66,8857.41,8358.8
West,BU Oncology,Stelara,Gastroenterology,Generic,Hannah Abbott,June,39640.55,20984.73,9981.19
East,BU Consumer Health,Stelara,Oncology,Generic,Hannah Abbott,April,2662.17,25005.97,24130.36
Central,BU Consumer Health,Enbrel,Immunology,Original,Hannah Abbott,May,34969.04,3894.04,18505.54
East,BU Consumer Health,Lipitor,Immunology,Original,George Miller,May,19902.45,9657.06,37283.6
West,BU Vaccines,Humira,Gastroenterology,Generic,Edward Norton,March,11455.95,43160.91,39443.56
South,BU Vaccines,Humira,Cardiology,Generic,Charlie Davis,February,11460.36,47578.23,42289.4
East,BU Oncology,Nexium,Oncology,Original,Hannah Abbott,March,44466.87,36126.23,8271.97
East,BU Pharma,Revlimid,Gastroenterology,Generic,Bob Smith,February,44917.88,10745.49,43241.23
West,BU Oncology,Opdivo,Respiratory,Generic,Fiona Gallagher,January,38086.04,10380.35,38703.32
West,BU Consumer Health,Humira,Oncology,Biosimilar,Alice Johnson,February,7923.47,30395.32,49786.13
North,BU Vaccines,Opdivo,Neurology,Original,Hannah Abbott,May,27276.56,7111.55,47866.41
Central,BU Vaccines,Revlimid,Oncology,Original,Charlie Davis,February,43149.09,45494.14,11857.97
East,BU Pharma,Eliquis,Cardiology,Original,George Miller,June,4777.94,33696.65,49380.15
North,BU Oncology,Humira,Immunology,Generic,Charlie Davis,April,39207.23,1665.66,39589.7
North,BU Oncology,Opdivo,Oncology,Generic,Diana Prince,June,25043.93,22586.34,25471.39
North,BU Vaccines,Eliquis,Gastroenterology,Generic,Fiona Gallagher,February,1794.91,4837.78,4360.78
North,BU Oncology,Eliquis,Oncology,Original,Hannah Abbott,January,25925.6,42213,3383.15
East,BU Vaccines,Revlimid,Cardiology,Generic,Charlie Davis,February,31656.87,47032.69,27114.6
Central,BU Oncology,Opdivo,Cardiology,Biosimilar,Fiona Gallagher,January,1661.41,35685.34,47154.72
West,BU Oncology,Nexium,Respiratory,Original,Hannah Abbott,June,1530.89,22905.02,8930.73
West,BU Pharma,Opdivo,Respiratory,Biosimilar,Alice Johnson,March,45620.21,43426.21,23522.4
Central,BU Vaccines,Keytruda,Cardiology,Original,Charlie Davis,June,48469.48,34010.88,22170.41
West,BU Pharma,Opdivo,Gastroenterology,Original,Fiona Gallagher,April,15095.14,9357.21,44002.86
West,BU Oncology,Stelara,Respiratory,Generic,Hannah Abbott,February,41147.46,16415.15,35780.16
Central,BU Pharma,Aspirin,Oncology,Biosimilar,Bob Smith,June,1267.53,41104.79,30664.77
West,BU Consumer Health,Aspirin,Neurology,Original,Diana Prince,March,30848.55,26932.45,19536.01
North,BU Consumer Health,Revlimid,Gastroenterology,Biosimilar,Fiona Gallagher,March,39319.04,45151.34,49772.68
South,BU Consumer Health,Nexium,Neurology,Generic,Diana Prince,April,16318.71,47116.73,26539.65
West,BU Consumer Health,Enbrel,Oncology,Original,Hannah Abbott,February,28398.91,46150.57,43399.67
West,BU Vaccines,Keytruda,Cardiology,Generic,Hannah Abbott,June,18132.3,43551.06,47077.79
South,BU Oncology,Humira,Immunology,Original,Edward Norton,May,6505.19,8838.79,19131.69
East,BU Pharma,Lipitor,Immunology,Generic,Edward Norton,April,16343.36,23684.29,43726.05
Central,BU Oncology,Eliquis,Oncology,Original,Hannah Abbott,April,26147.55,14587.29,42691.75
North,BU Pharma,Stelara,Oncology,Generic,Fiona Gallagher,February,12070.36,29118.73,43380.37
South,BU Vaccines,Eliquis,Gastroenterology,Biosimilar,Diana Prince,March,43023.76,19341.9,15798.05
South,BU Oncology,Stelara,Cardiology,Generic,Bob Smith,January,8016.76,1514,44494.05
West,BU Consumer Health,Opdivo,Cardiology,Generic,Bob Smith,February,44175.74,5938.11,13923.27
North,BU Consumer Health,Revlimid,Cardiology,Generic,Diana Prince,April,3832.95,39869.85,35254.78
East,BU Consumer Health,Humira,Neurology,Generic,Hannah Abbott,March,11012.31,32212.92,37601.92
Central,BU Oncology,Opdivo,Neurology,Biosimilar,Diana Prince,April,33426.09,12274.09,38765.76
West,BU Pharma,Nexium,Cardiology,Biosimilar,Alice Johnson,March,11572.46,24343.15,1269.07
East,BU Consumer Health,Keytruda,Immunology,Original,Diana Prince,May,35683.02,2798.88,32762.08
Central,BU Oncology,Humira,Immunology,Original,Bob Smith,April,1993.95,19797.3,22786.7
East,BU Oncology,Humira,Cardiology,Generic,Fiona Gallagher,February,22178.89,27472.68,3903.58
West,BU Pharma,Aspirin,Neurology,Biosimilar,Edward Norton,June,38393.4,25516,34093.37
West,BU Consumer Health,Keytruda,Oncology,Generic,Fiona Gallagher,May,36826.18,25568.07,17928.04
Central,BU Oncology,Enbrel,Neurology,Generic,Diana Prince,January,35964.12,44561.12,6326.84
South,BU Vaccines,Revlimid,Gastroenterology,Original,Alice Johnson,March,42942.55,16692.59,3708.58
South,BU Vaccines,Aspirin,Respiratory,Generic,Diana Prince,March,29620.45,1441.86,18416.86
Central,BU Consumer Health,Nexium,Gastroenterology,Biosimilar,Hannah Abbott,April,20684.05,23664.21,26161.78
North,BU Oncology,Revlimid,Respiratory,Original,Alice Johnson,April,32309.48,11847.33,7033.3
Central,BU Oncology,Enbrel,Respiratory,Original,Bob Smith,February,10259.43,46743.95,32291.37
South,BU Oncology,Keytruda,Neurology,Biosimilar,Bob Smith,April,49485.6,16000.13,22965.89
Central,BU Oncology,Lipitor,Cardiology,Biosimilar,Bob Smith,April,28369.26,32075.46,29467.2
North,BU Vaccines,Nexium,Immunology,Biosimilar,Diana Prince,May,31174.39,47688.31,11570.21
West,BU Oncology,Enbrel,Neurology,Original,Alice Johnson,March,19340.85,11680.91,19723.56
North,BU Vaccines,Keytruda,Respiratory,Generic,Hannah Abbott,February,32455.16,11822.22,22100.37
Central,BU Consumer Health,Humira,Neurology,Generic,Hannah Abbott,May,45558.76,44176.57,6153.98
South,BU Oncology,Revlimid,Oncology,Original,Fiona Gallagher,May,28844.79,23704.65,16887.25
South,BU Pharma,Opdivo,Neurology,Biosimilar,Bob Smith,May,39956.13,36562.97,5211.99
Central,BU Oncology,Enbrel,Respiratory,Generic,Edward Norton,March,40774.35,31454.34,47432.62
Central,BU Consumer Health,Keytruda,Gastroenterology,Generic,Bob Smith,February,13608.71,11877.69,43931.18
North,BU Vaccines,Eliquis,Neurology,Generic,Alice Johnson,April,44299.99,20910.41,35862.43
West,BU Vaccines,Nexium,Cardiology,Generic,Charlie Davis,March,18012.62,46479.27,3199.34
South,BU Oncology,Lipitor,Gastroenterology,Generic,Edward Norton,February,17793.56,5753.29,21559.36
West,BU Vaccines,Aspirin,Gastroenterology,Generic,Fiona Gallagher,May,47081.69,32067.12,27599.38
South,BU Consumer Health,Lipitor,Immunology,Original,Fiona Gallagher,April,8124.43,1141.88,25708.03
East,BU Vaccines,Enbrel,Neurology,Biosimilar,Fiona Gallagher,February,24216.55,49424.95,40292.98
North,BU Oncology,Aspirin,Gastroenterology,Generic,Fiona Gallagher,February,48567.61,42535.76,10060.22
West,BU Pharma,Aspirin,Immunology,Biosimilar,Edward Norton,February,32947.22,31856.96,42931.19
North,BU Pharma,Stelara,Respiratory,Original,Edward Norton,March,37933.9,16607.04,9679.88
South,BU Pharma,Enbrel,Cardiology,Original,Bob Smith,March,13519.04,26789,34235.83
West,BU Vaccines,Opdivo,Immunology,Generic,Diana Prince,January,8503.59,49951.8,20422.14
Central,BU Oncology,Enbrel,Cardiology,Biosimilar,Fiona Gallagher,February,22226.47,32207.07,13970.99
East,BU Oncology,Enbrel,Respiratory,Biosimilar,Hannah Abbott,March,20487.94,35612.2,44130.65
North,BU Consumer Health,Nexium,Oncology,Original,Charlie Davis,January,9493.88,24957.99,49777.74
South,BU Consumer Health,Enbrel,Respiratory,Biosimilar,Alice Johnson,May,29889.47,31773.13,34492.36
Central,BU Vaccines,Enbrel,Oncology,Original,Diana Prince,May,26404.82,30718.39,27108.84
Central,BU Pharma,Nexium,Cardiology,Biosimilar,Fiona Gallagher,January,35544.36,34787.19,22455.82
West,BU Oncology,Nexium,Cardiology,Generic,Bob Smith,March,34064,46229.71,8817.25
North,BU Vaccines,Enbrel,Cardiology,Original,Bob Smith,February,15589.16,47580.77,19298.47
West,BU Pharma,Keytruda,Gastroenterology,Original,Diana Prince,June,15081.14,30084.19,36789.53
West,BU Pharma,Enbrel,Cardiology,Generic,Diana Prince,February,12316.35,36889.25,28122.88
West,BU Vaccines,Revlimid,Cardiology,Original,George Miller,June,26295.73,2085.94,10436.02
Central,BU Consumer Health,Opdivo,Respiratory,Generic,Edward Norton,May,20572.25,20123.35,46522.01
North,BU Vaccines,Stelara,Respiratory,Biosimilar,George Miller,June,37186.04,13111.93,16401.36
North,BU Pharma,Aspirin,Gastroenterology,Generic,Alice Johnson,January,32714.58,37132.65,48203.34
East,BU Vaccines,Stelara,Respiratory,Biosimilar,Edward Norton,March,8608.01,10105.52,40309.14
East,BU Oncology,Opdivo,Immunology,Original,Bob Smith,March,43489.27,46277.12,35264.21
South,BU Pharma,Revlimid,Cardiology,Original,Diana Prince,April,15277.94,9347,21738.81
Central,BU Vaccines,Humira,Immunology,Generic,Bob Smith,March,49652.54,27573.98,49478.27
Central,BU Oncology,Enbrel,Immunology,Generic,Hannah Abbott,January,37943.48,23316.98,7557.98
East,BU Consumer Health,Lipitor,Oncology,Generic,Diana Prince,April,26747.49,7589.04,48259.69
North,BU Oncology,Aspirin,Cardiology,Original,Diana Prince,June,36515.6,1697.07,5136.34`;

export function Intro({ onDataLoaded, savedVersions, onLoadVersion, onDeleteVersion, onRenameVersion, onLogout, theme, toggleTheme, onInstall, userEmail }: IntroProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setConfirmDeleteId(null);
  };

  const handleRenameSubmit = (id: string) => {
    if (editName.trim() && onRenameVersion) {
      onRenameVersion(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      onDeleteVersion(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setEditingId(null);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([DUMMY_DATA], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_intelligence_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        setIsLoading(false);
        const data = results.data as any[];
        
        // Validation
        if (data.length === 0) {
          setError("The uploaded CSV is empty.");
          return;
        }

        const headers = Object.keys(data[0]);
        const missingHeaders = TEMPLATE_HEADERS.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(", ")}`);
          return;
        }

        // Map and validate rows
        const validData: DataRow[] = data.map(row => ({
          Region: String(row["Region"] || "Unknown"),
          "BU Line": String(row["BU Line"] || "Unknown"),
          "Brand Name": String(row["Brand Name"] || "Unknown"),
          "Therapy Area": String(row["Therapy Area"] || "Unknown"),
          Category: String(row["Category"] || "Unknown"),
          Assignees: String(row["Assignees"] || "Unknown"),
          Month: String(row["Month"] || "Unknown"),
          "Sales Value": Number(row["Sales Value"]) || 0,
          "Target Value": Number(row["Target Value"]) || 0,
          "Past Year Value": Number(row["Past Year Value"]) || 0,
        }));

        onDataLoaded(validData, file.name);
      },
      error: (error) => {
        setIsLoading(false);
        setError(`Failed to parse CSV: ${error.message}`);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="px-8 py-6 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <BarChart3 size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">BI Sales Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Account</span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{userEmail}</span>
          </div>
          {onLogout && (
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Logout / Start Over">
              <LogOut size={20} />
            </button>
          )}
          <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-8 items-stretch justify-center p-8 max-w-7xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 flex flex-col"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Upload Data Source</h2>
            <p className="text-gray-500 dark:text-gray-400">Please upload your monthly sales data using the standard CSV template. The dashboard will automatically generate insights upon upload.</p>
          </div>

          <div 
            className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload}
            />
            {isLoading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            ) : (
              <Upload size={48} className="text-blue-500 mb-4" />
            )}
            <h3 className="text-lg font-semibold mb-1">Click or drag file to this area</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Supports .CSV files matching the standard template</p>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Preparation</h3>
            <button 
              onClick={handleDownloadTemplate}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Download CSV Template</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Standard template with defined headers</p>
                </div>
              </div>
              <Download size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </button>
          </div>
        </motion.div>

        {savedVersions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-6">
              <History size={24} className="text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold">Saved Versions</h2>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {savedVersions.map((version) => (
                <div key={version.id} className="relative group/version">
                  {editingId === version.id ? (
                    <div className="w-full text-left p-4 rounded-xl border border-blue-500 hover:shadow-sm bg-gray-50 dark:bg-gray-800/50 block">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={editName}
                          autoFocus
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(version.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={() => handleRenameSubmit(version.id)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500">{new Date(version.date).toLocaleDateString()}</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{version.rows.toLocaleString()} rows</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onLoadVersion(version.id)}
                        className="w-full text-left p-4 pr-[88px] rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-sm bg-gray-50 dark:bg-gray-800/50 transition-all block"
                      >
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{version.name}</span>
                          <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full shrink-0">
                            {new Date(version.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">{new Date(version.date).toLocaleDateString()}</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{version.rows.toLocaleString()} rows</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover/version:text-blue-500 transition-transform group-hover/version:translate-x-1" />
                        </div>
                      </button>
                      
                      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1">
                        {onRenameVersion && !confirmDeleteId && (
                          <button
                            type="button"
                            onClick={() => startRename(version.id, version.name)}
                            className="text-gray-400 hover:text-blue-500 transition-colors bg-white dark:bg-gray-800 p-2 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100"
                            title="Rename Version"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        
                        <div className="flex items-center gap-1">
                          {confirmDeleteId === version.id && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-gray-400 hover:text-gray-600 transition-colors bg-white dark:bg-gray-800 p-2 rounded-full shadow-sm border border-gray-200 dark:border-gray-700"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(version.id)}
                            className={`transition-all p-2 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-1 ${
                              confirmDeleteId === version.id 
                                ? "bg-red-500 text-white border-red-500 opacity-100" 
                                : "text-gray-400 hover:text-red-500 bg-white dark:bg-gray-800 opacity-60 hover:opacity-100"
                            }`}
                            title={confirmDeleteId === version.id ? "Click again to confirm delete" : "Delete Version"}
                          >
                            <Trash2 size={16} />
                            {confirmDeleteId === version.id && <span className="text-[10px] font-bold pr-1">Confirm?</span>}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <Footer theme={theme} />
    </div>
  );
}
