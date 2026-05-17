import React from "react";
import { FilterState, DataRow } from "../types";
import { ChevronLeft, ChevronRight, FilterX, History, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SlicerPaneProps {
  data: DataRow[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  savedVersions?: { id: string; date: string; rows: number }[];
  onLoadVersion?: (id: string) => void;
}

export function SlicerPane({ data, filters, setFilters, isExpanded, setIsExpanded, savedVersions = [], onLoadVersion }: SlicerPaneProps) {
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
                     <button
                       type="button"
                       key={v.id}
                       onClick={() => onLoadVersion && onLoadVersion(v.id)}
                       className="w-full text-left p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 text-sm bg-gray-50 dark:bg-gray-800/50 group transition-colors"
                     >
                       <div className="font-medium text-gray-900 dark:text-gray-100">{new Date(v.date).toLocaleDateString()}</div>
                       <div className="text-xs text-gray-500">{new Date(v.date).toLocaleTimeString()} • {v.rows} rows</div>
                     </button>
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
