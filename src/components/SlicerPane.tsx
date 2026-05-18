import React, { useState } from "react";
import { FilterState, DataRow } from "../types";
import { ChevronLeft, ChevronRight, FilterX, History, Filter, Trash2, Edit2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SlicerPaneProps {
  data: DataRow[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  savedVersions?: { id: string; name: string; date: string; rows: number }[];
  onLoadVersion?: (id: string) => void;
  onDeleteVersion?: (id: string) => void;
  onRenameVersion?: (id: string, newName: string) => void;
}

export function SlicerPane({ data, filters, setFilters, isExpanded, setIsExpanded, savedVersions = [], onLoadVersion, onDeleteVersion, onRenameVersion }: SlicerPaneProps) {
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
      onDeleteVersion && onDeleteVersion(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setEditingId(null);
    }
  };
  const getUniqueValues = (key: keyof DataRow) => {
    const values = Array.from(new Set(data.map(d => String(d[key]))));
    if (key === "Month") {
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return values.sort((a, b) => {
        const indexA = MONTHS.findIndex(m => a.toLowerCase().startsWith(m.toLowerCase()));
        const indexB = MONTHS.findIndex(m => b.toLowerCase().startsWith(m.toLowerCase()));
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
      });
    }
    return values.sort();
  };

  const toggleFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => {
      const current = prev[key];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter(v => v !== value) };
      }
      return { ...prev, [key]: [...current, value] };
    });
  };

  const clearFilters = () => {
    setFilters({
      Region: [],
      "BU Line": [],
      "Brand Name": [],
      "Therapy Area": [],
      Category: [],
      Month: []
    });
  };

  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0);

  const filterConfigs: { key: keyof FilterState; label: string }[] = [
    { key: "Region", label: "Region" },
    { key: "BU Line", label: "BU Line" },
    { key: "Therapy Area", label: "Therapy Area" },
    { key: "Category", label: "Category" },
    { key: "Month", label: "Month" },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 transition-all duration-[400ms] ease-in-out flex flex-col relative ${isExpanded ? 'w-64 border-r border-gray-200 dark:border-gray-700 shadow-xl' : 'w-0 overflow-visible'}`}>
      <div className={`transition-all duration-300 flex items-center ${isExpanded ? 'p-4 border-b border-gray-200 dark:border-gray-700 justify-between' : 'absolute left-0 top-4 z-20'}`}>
        {isExpanded && <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Filter size={18} className="text-blue-600" />
          Filters
        </h2>}
        <button 
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`group flex items-center justify-center transition-all duration-300 ${
            isExpanded 
              ? 'p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900' 
              : 'w-10 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-r-xl shadow-lg border-y border-r border-blue-700/50 flex'
          }`}
          title={isExpanded ? "Collapse Filters" : "Open Filters"}
        >
          {isExpanded ? (
            <ChevronLeft size={20} />
          ) : (
            <Filter size={18} className="animate-in fade-in zoom-in duration-300" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
          >
            {hasActiveFilters && (
              <button 
                type="button"
                onClick={clearFilters}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors"
              >
                <FilterX size={16} />
                Clear Filters
              </button>
            )}

            {filterConfigs.map(({ key, label }) => {
               const options = getUniqueValues(key as keyof DataRow);
               return (
                 <div key={key}>
                   <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wider">{label}</h3>
                   <div className="space-y-1">
                     {options.map(opt => (
                       <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                         <input 
                           type="checkbox"
                           checked={filters[key].includes(opt)}
                           onChange={() => toggleFilter(key, opt)}
                           className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                         />
                         <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors truncate">
                           {opt}
                         </span>
                       </label>
                     ))}
                   </div>
                 </div>
               );
            })}

            {savedVersions && savedVersions.length > 0 && (
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                 <div className="flex items-center gap-2 mb-3 text-gray-900 dark:text-gray-100">
                    <History size={18} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Saved Versions</h3>
                 </div>
                 <div className="space-y-2">
                   {savedVersions.map(v => (
                     <div key={v.id} className="group/version relative flex w-full">
                       {editingId === v.id ? (
                         <div className="w-full text-left p-2 rounded-lg border border-blue-500 text-sm bg-gray-50 dark:bg-gray-800/50 block">
                            <div className="flex items-center gap-1 mb-1">
                              <input
                                type="text"
                                value={editName}
                                autoFocus
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameSubmit(v.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="flex-1 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs font-semibold text-gray-900 dark:text-gray-100 min-w-0"
                              />
                              <button onClick={() => handleRenameSubmit(v.id)} className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-500">{new Date(v.date).toLocaleDateString()}</div>
                         </div>
                       ) : (
                         <>
                           <button
                             type="button"
                             onClick={() => onLoadVersion && onLoadVersion(v.id)}
                             className="w-full text-left p-2 pr-16 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 text-sm bg-gray-50 dark:bg-gray-800/50 transition-colors"
                           >
                             <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-xs">{v.name}</div>
                             <div className="text-[10px] text-gray-500">{new Date(v.date).toLocaleDateString()} {new Date(v.date).toLocaleTimeString()} • {v.rows} rows</div>
                           </button>
                           <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1">
                             {onRenameVersion && !confirmDeleteId && (
                               <button
                                 type="button"
                                 onClick={(e) => { e.stopPropagation(); startRename(v.id, v.name); }}
                                 className="text-gray-400 hover:text-blue-500 transition-colors p-1 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100"
                                 title="Rename Version"
                               >
                                 <Edit2 size={12} />
                               </button>
                             )}
                             
                             <div className="flex items-center gap-1">
                               {confirmDeleteId === v.id && (
                                 <button
                                   type="button"
                                   onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                   className="text-gray-400 hover:text-gray-600 transition-colors bg-white dark:bg-gray-800 p-1 rounded-md shadow-sm border border-gray-200 dark:border-gray-700"
                                   title="Cancel"
                                 >
                                   <X size={12} />
                                 </button>
                               )}
                               {onDeleteVersion && (
                                 <button
                                   type="button"
                                   onClick={(e) => { e.stopPropagation(); handleDeleteClick(v.id); }}
                                   className={`transition-all p-1 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-1 ${
                                     confirmDeleteId === v.id 
                                       ? "bg-red-500 text-white border-red-500 opacity-100" 
                                       : "text-gray-400 hover:text-red-500 bg-white dark:bg-gray-800 opacity-60 hover:opacity-100"
                                   }`}
                                   title={confirmDeleteId === v.id ? "Click again to confirm delete" : "Delete Version"}
                                 >
                                   <Trash2 size={12} />
                                   {confirmDeleteId === v.id && <span className="text-[10px] font-bold">Delete?</span>}
                                 </button>
                               )}
                             </div>
                           </div>
                         </>
                       )}
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
