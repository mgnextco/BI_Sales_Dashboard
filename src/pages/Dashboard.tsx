import React, { useState, useMemo, useEffect } from "react";
import { DataRow, FilterState } from "../types";
import { Footer } from "../components/Footer";
import { SlicerPane } from "../components/SlicerPane";
import { motion, AnimatePresence } from "motion/react";
import { formatAbbreviatedValue } from "../lib/utils";
import { exportToPDF, exportToPPTX, exportChartImage, exportChartCSV } from "../lib/exportUtils";
import { generateInsights } from "../lib/gemini";
import { 
  Sun, Moon, Download, FileText, Presentation, 
  Save, Expand, X, BrainCircuit, Loader2, Image as ImageIcon, FileSpreadsheet, ArrowLeft, Smartphone,
  BarChart3, DollarSign, Target, Activity, TrendingUp
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area
} from "recharts";

interface DashboardProps {
  data: DataRow[];
  theme: "light" | "dark";
  toggleTheme: () => void;
  onSaveVersion: (filters: FilterState) => void;
  onBack: () => void;
  savedVersions?: { id: string; date: string; rows: number }[];
  onLoadVersion?: (id: string) => void;
  onInstall?: () => void;
  initialFilters?: FilterState | null;
  userEmail: string;
}

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e", "#84cc16"];

export function Dashboard({ data, theme, toggleTheme, onSaveVersion, onBack, savedVersions, onLoadVersion, onInstall, initialFilters, userEmail }: DashboardProps) {
  const [isSlicerExpanded, setIsSlicerExpanded] = useState(true);
  const [showInsightsOverlay, setShowInsightsOverlay] = useState(false);
  const [aiInsights, setAiInsights] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters || {
    Region: [],
    "BU Line": [],
    "Brand Name": [],
    "Therapy Area": [],
    Category: [],
    Month: []
  });

  // Update filters if initialFilters changes (e.g. loading a different version)
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  // Filter Data
  const filteredData = useMemo(() => {
    return data.filter(row => {
      return (
        (filters.Region.length === 0 || filters.Region.includes(row.Region)) &&
        (filters["BU Line"].length === 0 || filters["BU Line"].includes(row["BU Line"])) &&
        (filters["Brand Name"].length === 0 || filters["Brand Name"].includes(row["Brand Name"])) &&
        (filters["Therapy Area"].length === 0 || filters["Therapy Area"].includes(row["Therapy Area"])) &&
        (filters.Category.length === 0 || filters.Category.includes(row.Category)) &&
        (filters.Month.length === 0 || filters.Month.includes(row.Month))
      );
    });
  }, [data, filters]);

  // Aggregations
  const KPIs = useMemo(() => {
    const totalSales = filteredData.reduce((acc, row) => acc + row["Sales Value"], 0);
    const totalTarget = filteredData.reduce((acc, row) => acc + row["Target Value"], 0);
    const totalPastYear = filteredData.reduce((acc, row) => acc + row["Past Year Value"], 0);
    
    const achievement = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    const gapToTarget = totalSales - totalTarget;
    const growth = totalPastYear > 0 ? ((totalSales - totalPastYear) / totalPastYear) * 100 : 0;

    return { totalSales, achievement, gapToTarget, growth };
  }, [filteredData]);

  // Chart Data Processors
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const getMonthIndex = (m: string) => {
    const idx = MONTHS.findIndex(mon => m.toLowerCase().startsWith(mon.toLowerCase()));
    return idx === -1 ? 99 : idx;
  };

  const salesByMonth = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d.Month) || { Month: d.Month, Sales: 0, Target: 0, PastYear: 0 };
      existing.Sales += d["Sales Value"];
      existing.Target += d["Target Value"];
      existing.PastYear += d["Past Year Value"];
      map.set(d.Month, existing);
    });
    return Array.from(map.values()).sort((a, b) => getMonthIndex(a.Month) - getMonthIndex(b.Month));
  }, [filteredData]);

  const salesByRegion = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d.Region) || { Region: d.Region, Sales: 0 };
      existing.Sales += d["Sales Value"];
      map.set(d.Region, existing);
    });
    return Array.from(map.values());
  }, [filteredData]);

  const salesByBU = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d["BU Line"]) || { name: d["BU Line"], value: 0 };
      existing.value += d["Sales Value"];
      map.set(d["BU Line"], existing);
    });
    return Array.from(map.values());
  }, [filteredData]);

  const topBrands = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d["Brand Name"]) || { Brand: d["Brand Name"], Sales: 0 };
      existing.Sales += d["Sales Value"];
      map.set(d["Brand Name"], existing);
    });
    return Array.from(map.values()).sort((a, b) => b.Sales - a.Sales).slice(0, 5);
  }, [filteredData]);
  
  const salesVsPastYear = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
       const existing = map.get(d.Category) || { Category: d.Category, Sales: 0, PastYear: 0 };
       existing.Sales += d["Sales Value"];
       existing.PastYear += d["Past Year Value"];
       map.set(d.Category, existing);
    });
    return Array.from(map.values());
  }, [filteredData]);

  const salesByTherapyArea = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d["Therapy Area"]) || { TherapyArea: d["Therapy Area"], Sales: 0 };
      existing.Sales += d["Sales Value"];
      map.set(d["Therapy Area"], existing);
    });
    return Array.from(map.values()).sort((a, b) => b.Sales - a.Sales);
  }, [filteredData]);

  const salesByAssignee = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d.Assignees) || { Assignee: d.Assignees, Sales: 0, Target: 0 };
      existing.Sales += d["Sales Value"];
      existing.Target += d["Target Value"];
      map.set(d.Assignees, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.Sales - a.Sales).slice(0, 10);
  }, [filteredData]);

  const gapByRegion = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d.Region) || { Region: d.Region, Gap: 0 };
      existing.Gap += (d["Sales Value"] - d["Target Value"]);
      map.set(d.Region, existing);
    });
    return Array.from(map.values());
  }, [filteredData]);

  const achievementByBu = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d["BU Line"]) || { BU: d["BU Line"], Sales: 0, Target: 0 };
      existing.Sales += d["Sales Value"];
      existing.Target += d["Target Value"];
      map.set(d["BU Line"], existing);
    });
    return Array.from(map.values()).map(x => ({
      ...x,
      Achievement: x.Target > 0 ? (x.Sales / x.Target) * 100 : 0
    })).sort((a,b) => b.Achievement - a.Achievement);
  }, [filteredData]);

  const salesByCategory = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d.Category) || { name: d.Category, value: 0 };
      existing.value += d["Sales Value"];
      map.set(d.Category, existing);
    });
    return Array.from(map.values());
  }, [filteredData]);

  const achievementByTherapyArea = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const existing = map.get(d["Therapy Area"]) || { name: d["Therapy Area"], Sales: 0, Target: 0 };
      existing.Sales += d["Sales Value"];
      existing.Target += d["Target Value"];
      map.set(d["Therapy Area"], existing);
    });
    return Array.from(map.values()).map(x => ({
      name: x.name,
      Achievement: x.Target > 0 ? (x.Sales / x.Target) * 100 : 0
    })).sort((a,b) => b.Achievement - a.Achievement);
  }, [filteredData]);

  const generateFullPageInsights = async () => {
    setShowInsightsOverlay(true);
    if (aiInsights) return;
    
    setIsGenerating(true);
    const summaryText = `
      Dashboard Summary:
      Total Sales: ${KPIs.totalSales}
      Target: ${KPIs.totalSales - KPIs.gapToTarget}
      Achievement: ${KPIs.achievement.toFixed(2)}%
      Growth vs Past Year: ${KPIs.growth.toFixed(2)}%
      
      Top Region: ${salesByRegion.sort((a,b)=>b.Sales - a.Sales)[0]?.Region}
      Top BU: ${salesByBU.sort((a,b)=>b.value - a.value)[0]?.name}
      Top Brand: ${topBrands[0]?.Brand}
      
      Please provide a brief, professional, corporate business analysis of these high-level figures. 
      Focus on trends, potential risks, and recommendations. Keep it under 200 words. Do not use markdown headers, just plain paragraphs.
    `;
    const response = await generateInsights(summaryText);
    setAiInsights(response);
    setIsGenerating(false);
  };

  useEffect(() => {
    setAiInsights("");
  }, [filters]);

  const dynamicInsights = useMemo(() => {
    const findTop = (arr: any[], key: string, valKey: string) => [...arr].sort((a, b) => b[valKey] - a[valKey])[0];

    const topMonthlyPerf = [...salesByMonth].sort((a,b) => (a.Sales/a.Target) - (b.Sales/b.Target)).reverse()[0];
    const topReg = findTop(salesByRegion, "Region", "Sales");
    const topBrand = topBrands[0];
    const topBU = findTop(salesByBU, "name", "value");
    const topTA = findTop(salesByTherapyArea, "TherapyArea", "Sales");
    const topAssignee = findTop(salesByAssignee, "Assignee", "Sales");
    const topAchBU = achievementByBu[0];
    const topAchTA = achievementByTherapyArea[0];

    const regGap = [...gapByRegion].sort((a,b) => b.Gap - a.Gap);
    const bestGap = regGap[0];
    const worstGap = regGap[regGap.length - 1];

    return {
      chart0: topMonthlyPerf ? `${topMonthlyPerf.Month} achieved the highest target completion at ${(topMonthlyPerf.Sales/topMonthlyPerf.Target * 100).toFixed(1)}%.` : "Monitoring sales vs targets over time.",
      chart1: topReg ? `${topReg.Region} leads regional sales with $${formatAbbreviatedValue(topReg.Sales)} (${(topReg.Sales/KPIs.totalSales * 100).toFixed(1)}% share).` : "Regional distribution of sales revenue.",
      chart2: topBrand ? `${topBrand.Brand} is the leading brand, contributing $${formatAbbreviatedValue(topBrand.Sales)} to total revenue.` : "Performance of top-tier brands.",
      chart3: KPIs.growth >= 0 ? `Positive growth detected: Sales are up ${KPIs.growth.toFixed(1)}% compared to the same categories last year.` : `Action required: Sales have dipped ${Math.abs(KPIs.growth).toFixed(1)}% vs. the previous year in these categories.`,
      chart4: topBU ? `${topBU.name} is the primary Business Unit driver, currently making up the largest slice of the portfolio.` : "Composition of sales across Business Units.",
      chart5: salesByMonth.length > 1 ? `Sales trend is currently ${salesByMonth[salesByMonth.length-1].Sales > salesByMonth[0].Sales ? 'trending upward' : 'fluctuating'} across the observed period.` : "Monitoring sales momentum.",
      chart6: topTA ? `${topTA.TherapyArea} represents the most successful therapy area in terms of raw sales value.` : "Comparison of revenue by therapeutic focus.",
      chart7: topAssignee ? `${topAssignee.Assignee} is the top performer, delivering $${formatAbbreviatedValue(topAssignee.Sales)} against their individual target.` : "Sales contributions by key account assignees.",
      chart8: bestGap?.Gap > 0 ? `${bestGap.Region} is over-performing by $${formatAbbreviatedValue(bestGap.Gap)}, while ${worstGap?.Region} shows the largest shortfall.` : "Regional variance analysis against commercial targets.",
      chart9: topAchBU ? `${topAchBU.BU} reflects peak efficiency with ${topAchBU.Achievement.toFixed(1)}% target achievement.` : "Benchmarking BU efficiency.",
      chart10: findTop(salesByCategory, "name", "value") ? `${findTop(salesByCategory, "name", "value").name} is the currently dominant sales category.` : "Product category breakdown.",
      chart11: topAchTA ? `${topAchTA.name} is exceeding target expectations with an achievement of ${topAchTA.Achievement.toFixed(1)}%.` : "Identifying therapy areas with high target completion."
    };
  }, [salesByMonth, salesByRegion, topBrands, salesByBU, salesByTherapyArea, salesByAssignee, gapByRegion, achievementByBu, achievementByTherapyArea, salesByCategory, KPIs]);

  const getExpandedChartData = () => {
    if (!expandedChartId) return null;
    const charts = [
      { id: "chart-0", title: "Sales vs Target by Month", insight: dynamicInsights.chart0 },
      { id: "chart-1", title: "Sales Distribution by Region", insight: dynamicInsights.chart1 },
      { id: "chart-2", title: "Top 5 Brands by Sales", insight: dynamicInsights.chart2 },
      { id: "chart-3", title: "Sales vs Past Year by Category", insight: dynamicInsights.chart3 },
      { id: "chart-4", title: "BU Line Contribution", insight: dynamicInsights.chart4 },
      { id: "chart-5", title: "Sales Trend vs Last Year", insight: dynamicInsights.chart5 },
      { id: "chart-6", title: "Sales by Therapy Area", insight: dynamicInsights.chart6 },
      { id: "chart-7", title: "Top 10 Assignees Performance", insight: dynamicInsights.chart7 },
      { id: "chart-8", title: "Target Gap by Region", insight: dynamicInsights.chart8 },
      { id: "chart-9", title: "Achievement % by BU Line", insight: dynamicInsights.chart9 },
      { id: "chart-10", title: "Sales Distribution by Category", insight: dynamicInsights.chart10 },
      { id: "chart-11", title: "Achievement % by Therapy Area", insight: dynamicInsights.chart11 }
    ];
    return charts.find(c => c.id === expandedChartId) || null;
  };

  const renderChartById = (id: string, isExpanded: boolean = false) => {
    const height = isExpanded ? '100%' : 250;
    // Using a tiny debounce for expanded view ensures the container is ready
    const debounce = isExpanded ? 50 : 0;
    
    switch (id) {
      case "chart-0":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <ComposedChart data={salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="Month" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, '']} contentStyle={{ backgroundColor: 'var(--tw-prose-bg)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', opacity: 0.8 }} />
              <Bar dataKey="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line type="monotone" dataKey="Target" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "chart-1":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <PieChart>
              <Pie data={salesByRegion} dataKey="Sales" nameKey="Region" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                {salesByRegion.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "chart-2":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={topBrands} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" opacity={0.1} />
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <YAxis type="category" dataKey="Brand" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Sales" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-3":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={salesVsPastYear}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="Category" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, '']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="PastYear" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-4":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <PieChart>
              <Pie data={salesByBU} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                {salesByBU.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "chart-5":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <ComposedChart data={salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="Month" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip formatter={(value: number, name: string) => [`$${formatAbbreviatedValue(value)}`, name === 'PastYear' ? 'Past Year' : 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Area type="monotone" dataKey="Sales" fill="#2563eb" fillOpacity={0.1} stroke="#2563eb" strokeWidth={3} name="Sales" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="PastYear" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" name="Past Year" dot={false} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "chart-6":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={salesByTherapyArea} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" opacity={0.1} />
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <YAxis type="category" dataKey="TherapyArea" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Sales" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-7":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={salesByAssignee}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="Assignee" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, '']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" />
              <Bar dataKey="Sales" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="Target" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-8":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={gapByRegion}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="Region" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, 'Gap']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Gap" maxBarSize={40}>
                {gapByRegion.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Gap >= 0 ? '#10b981' : '#ef4444'} radius={[4, 4, 0, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-9":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={achievementByBu} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" opacity={0.1} />
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${v.toFixed(0)}%`} />
              <YAxis type="category" dataKey="BU" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Achievement']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Achievement" maxBarSize={30}>
                {achievementByBu.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Achievement >= 100 ? '#10b981' : '#f59e0b'} radius={[0, 4, 4, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-10":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <PieChart>
              <Pie data={salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                {salesByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" align="center" />
            </PieChart>
          </ResponsiveContainer>
        );
      case "chart-11":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={achievementByTherapyArea} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" opacity={0.1} />
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${v.toFixed(0)}%`} />
              <YAxis type="category" dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Achievement']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Achievement" maxBarSize={30}>
                {achievementByTherapyArea.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Achievement >= 100 ? '#10b981' : '#f59e0b'} radius={[0, 4, 4, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  const expandedChartData = getExpandedChartData();

  const [customConfig, setCustomConfig] = useState({
    type: 'bar' as 'bar' | 'line' | 'pie' | 'area',
    xAxis: 'Region' as keyof DataRow,
    yAxes: ['Sales Value'] as Array<keyof DataRow>
  });

  const customChartData = useMemo(() => {
    const map = new Map();
    filteredData.forEach(d => {
      const xVal = String(d[customConfig.xAxis]);
      const existing = map.get(xVal) || { name: xVal };
      
      customConfig.yAxes.forEach(yKey => {
        const yVal = Number(d[yKey]) || 0;
        existing[yKey] = (existing[yKey] || 0) + yVal;
      });
      
      map.set(xVal, existing);
    });
    let result = Array.from(map.values());
    if (customConfig.xAxis === 'Month') {
        result.sort((a,b) => getMonthIndex(a.name) - getMonthIndex(b.name));
    } else {
        const primaryY = customConfig.yAxes[0] || 'Sales Value';
        result.sort((a,b) => (b[primaryY] as number || 0) - (a[primaryY] as number || 0));
    }
    return result.slice(0, 15); // limit to 15 for readability
  }, [filteredData, customConfig]);

  const renderCustomChart = () => {
    const height = 350;
    const { type, yAxes } = customConfig;
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
    
    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={customChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number, name: string) => [`$${formatAbbreviatedValue(value)}`, name]} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              {yAxes.map((y, i) => (
                <Bar key={y} dataKey={y} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={50} />
              ))}
              {yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            </BarChart>
          </ResponsiveContainer>
        );
      case "area": // Use for "Trend" if type is area or columns 
         return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={customChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip formatter={(value: number, name: string) => [`$${formatAbbreviatedValue(value)}`, name]} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              {yAxes.map((y, i) => (
                <Area key={y} type="monotone" dataKey={y} fill={colors[i % colors.length]} fillOpacity={0.1} stroke={colors[i % colors.length]} strokeWidth={3} />
              ))}
              {yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={customChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `$${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip formatter={(value: number, name: string) => [`$${formatAbbreviatedValue(value)}`, name]} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              {yAxes.map((y, i) => (
                <Line key={y} type="monotone" dataKey={y} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 4 }} />
              ))}
              {yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            </LineChart>
          </ResponsiveContainer>
        );
      case "pie":
        const pieY = yAxes[0] || 'Sales Value';
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie data={customChartData} dataKey={pieY} nameKey="name" cx="50%" cy="50%" outerRadius={120}>
                {customChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`$${formatAbbreviatedValue(value)}`, pieY]} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  const handleExportPDF = () => exportToPDF("dashboard-content", theme === "dark", "Sales_Dashboard.pdf");
  const handleExportPPTX = () => exportToPPTX(
    ["chart-0", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "chart-7", "chart-8", "chart-9", "chart-10", "chart-11"], 
    filteredData,
    theme === "dark"
  );
  
  const handleChartImg = (id: string, name: string) => exportChartImage(id, theme === "dark", `${name}.png`);
  const handleChartCSV = (data: any[], name: string) => exportChartCSV(data, `${name}.csv`);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 px-6 bg-white dark:bg-gray-800 shadow-[0_1px_3px_rgb(0,0,0,0.05)] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="p-2 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Back to Home / Upload">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <BarChart3 size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 hidden sm:block">BI Sales Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button type="button" onClick={generateFullPageInsights} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
            <BrainCircuit size={16} />
            AI Insights
          </button>
          
          <button type="button" onClick={handleExportPDF} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Export Dashboard PDF">
            <FileText size={18} />
          </button>
          <button type="button" onClick={handleExportPPTX} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Export Dashboard PPTX">
            <Presentation size={18} />
          </button>
          <button type="button" onClick={() => onSaveVersion(filters)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-lg transition-colors" title="Save Version">
            <Save size={16} />
            Save Version
          </button>
          
          {onInstall && (
            <button 
              type="button" 
              onClick={onInstall} 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400 rounded-lg transition-colors animate-pulse" 
              title="Install for Offline Use"
            >
              <Smartphone size={16} />
              Android Offline
            </button>
          )}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
          <div className="hidden lg:flex flex-col items-end px-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Account</span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{userEmail}</span>
          </div>
          <button type="button" onClick={toggleTheme} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Toggle Theme">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Slicer Pane */}
        <SlicerPane 
          data={data}
          filters={filters}
          setFilters={setFilters}
          isExpanded={isSlicerExpanded}
          setIsExpanded={setIsSlicerExpanded}
          savedVersions={savedVersions}
          onLoadVersion={onLoadVersion}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" id="dashboard-content">
          <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Sales" value={`$${formatAbbreviatedValue(KPIs.totalSales)}`} subtitle="Actual sales value" icon={<DollarSign className="w-7 h-7" />} />
              <KpiCard title="Achievement %" value={`${KPIs.achievement.toFixed(1)}%`} subtitle="vs Target" trend={KPIs.achievement >= 100 ? 'up' : 'down'} icon={<Target className="w-7 h-7" />} />
              <KpiCard title="Gap to Target" value={`$${formatAbbreviatedValue(Math.abs(KPIs.gapToTarget))}`} subtitle={KPIs.gapToTarget >= 0 ? "Above Target" : "Below Target"} trend={KPIs.gapToTarget >= 0 ? 'up' : 'down'} icon={<Activity className="w-7 h-7" />} />
              <KpiCard title="Growth %" value={`${KPIs.growth.toFixed(1)}%`} subtitle="vs Past Year" trend={KPIs.growth >= 0 ? 'up' : 'down'} icon={<TrendingUp className="w-7 h-7" />} />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              
              <ChartCard 
                title="Sales vs Target by Month" 
                id="chart-0" 
                insight={dynamicInsights.chart0}
                onDownloadImg={() => handleChartImg("chart-0", "Sales_Month")}
                onDownloadCsv={() => handleChartCSV(salesByMonth, "Sales_Month")}
                onExpand={() => setExpandedChartId("chart-0")}
              >
                {renderChartById("chart-0")}
              </ChartCard>

              <ChartCard 
                title="Sales Distribution by Region" 
                id="chart-1" 
                insight={dynamicInsights.chart1}
                onDownloadImg={() => handleChartImg("chart-1", "Sales_Region")}
                onDownloadCsv={() => handleChartCSV(salesByRegion, "Sales_Region")}
                onExpand={() => setExpandedChartId("chart-1")}
              >
                {renderChartById("chart-1")}
              </ChartCard>

              <ChartCard 
                title="Top 5 Brands by Sales" 
                id="chart-2" 
                insight={dynamicInsights.chart2}
                onDownloadImg={() => handleChartImg("chart-2", "Sales_Brands")}
                onDownloadCsv={() => handleChartCSV(topBrands, "Sales_Brands")}
                onExpand={() => setExpandedChartId("chart-2")}
              >
                {renderChartById("chart-2")}
              </ChartCard>

              <ChartCard 
                title="Sales vs Past Year by Category" 
                id="chart-3" 
                insight={dynamicInsights.chart3}
                onDownloadImg={() => handleChartImg("chart-3", "Sales_Category")}
                onDownloadCsv={() => handleChartCSV(salesVsPastYear, "Sales_Category")}
                onExpand={() => setExpandedChartId("chart-3")}
              >
                {renderChartById("chart-3")}
              </ChartCard>
              
              <ChartCard 
                title="BU Line Contribution" 
                id="chart-4" 
                insight={dynamicInsights.chart4}
                onDownloadImg={() => handleChartImg("chart-4", "Sales_BU")}
                onDownloadCsv={() => handleChartCSV(salesByBU, "Sales_BU")}
                onExpand={() => setExpandedChartId("chart-4")}
              >
                {renderChartById("chart-4")}
              </ChartCard>

              <ChartCard 
                title="Sales Trend vs Last Year" 
                id="chart-5" 
                insight={dynamicInsights.chart5}
                onDownloadImg={() => handleChartImg("chart-5", "Sales_Trend")}
                onDownloadCsv={() => handleChartCSV(salesByMonth, "Sales_Trend")}
                onExpand={() => setExpandedChartId("chart-5")}
              >
                {renderChartById("chart-5")}
              </ChartCard>

              <ChartCard 
                title="Sales by Therapy Area" 
                id="chart-6" 
                insight={dynamicInsights.chart6}
                onDownloadImg={() => handleChartImg("chart-6", "Sales_Therapy")}
                onDownloadCsv={() => handleChartCSV(salesByTherapyArea, "Sales_Therapy")}
                onExpand={() => setExpandedChartId("chart-6")}
              >
                {renderChartById("chart-6")}
              </ChartCard>

              <ChartCard 
                title="Top 10 Assignees Performance" 
                id="chart-7" 
                insight={dynamicInsights.chart7}
                onDownloadImg={() => handleChartImg("chart-7", "Assignees_Performance")}
                onDownloadCsv={() => handleChartCSV(salesByAssignee, "Assignees_Performance")}
                onExpand={() => setExpandedChartId("chart-7")}
              >
                {renderChartById("chart-7")}
              </ChartCard>

              <ChartCard 
                title="Target Gap by Region" 
                id="chart-8" 
                insight={dynamicInsights.chart8}
                onDownloadImg={() => handleChartImg("chart-8", "Gap_Region")}
                onDownloadCsv={() => handleChartCSV(gapByRegion, "Gap_Region")}
                onExpand={() => setExpandedChartId("chart-8")}
              >
                {renderChartById("chart-8")}
              </ChartCard>

              <ChartCard 
                title="Achievement % by BU Line" 
                id="chart-9" 
                insight={dynamicInsights.chart9}
                onDownloadImg={() => handleChartImg("chart-9", "Achievement_BU")}
                onDownloadCsv={() => handleChartCSV(achievementByBu, "Achievement_BU")}
                onExpand={() => setExpandedChartId("chart-9")}
              >
                {renderChartById("chart-9")}
              </ChartCard>

              <ChartCard 
                title="Sales Distribution by Category" 
                id="chart-10" 
                insight={dynamicInsights.chart10}
                onDownloadImg={() => handleChartImg("chart-10", "Sales_Category_Dist")}
                onDownloadCsv={() => handleChartCSV(salesByCategory, "Sales_Category_Dist")}
                onExpand={() => setExpandedChartId("chart-10")}
              >
                {renderChartById("chart-10")}
              </ChartCard>

              <ChartCard 
                title="Achievement % by Therapy Area" 
                id="chart-11" 
                insight={dynamicInsights.chart11}
                onDownloadImg={() => handleChartImg("chart-11", "Achievement_Therapy")}
                onDownloadCsv={() => handleChartCSV(achievementByTherapyArea, "Achievement_Therapy")}
                onExpand={() => setExpandedChartId("chart-11")}
              >
                {renderChartById("chart-11")}
              </ChartCard>

            </div>

            {/* Custom Chart Builder */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden mt-8">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Custom Visual Builder</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Build your own insight by selecting axes and visuals</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Chart Type</label>
                    <select 
                      value={customConfig.type} 
                      onChange={(e) => setCustomConfig({...customConfig, type: e.target.value as any})}
                      className="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="bar">Columns / Bars</option>
                      <option value="line">Trendline</option>
                      <option value="area">Area Chart</option>
                      <option value="pie">Pie Chart</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400">X-Axis (Dimension)</label>
                    <select 
                      value={customConfig.xAxis} 
                      onChange={(e) => setCustomConfig({...customConfig, xAxis: e.target.value as any})}
                      className="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Region">Region</option>
                      <option value="BU Line">BU Line</option>
                      <option value="Brand Name">Brand</option>
                      <option value="Therapy Area">Therapy Area</option>
                      <option value="Category">Category</option>
                      <option value="Assignees">Assignees</option>
                      <option value="Month">Month</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Y-Axis (Measures)</label>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {["Sales Value", "Target Value", "Past Year Value"].map(measure => {
                        const isSelected = customConfig.yAxes.includes(measure as any);
                        return (
                          <button
                            key={measure}
                            onClick={() => {
                              let newAxes = [...customConfig.yAxes];
                              if (isSelected) {
                                 newAxes = newAxes.filter(a => a !== measure);
                                 if (newAxes.length === 0) newAxes = [measure as any];
                              } else {
                                 newAxes.push(measure as any);
                              }
                              setCustomConfig({ ...customConfig, yAxes: newAxes });
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full border flex flex-shrink-0 items-center justify-center transition-colors ${
                              isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500'
                            }`}>
                               {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            {measure}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 h-[400px]">
                {renderCustomChart()}
              </div>
            </div>

            <div className="pt-8">
               <Footer theme={theme} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Overlay */}
      <AnimatePresence>
        {showInsightsOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <BrainCircuit size={20} />
                  <h3 className="font-bold text-lg">AI Executive Insights</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowInsightsOverlay(false)}
                  className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-black/20 rounded-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto font-serif text-lg leading-relaxed text-gray-700 dark:text-gray-300 flex-1">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-4 text-purple-600 dark:text-purple-400">
                    <Loader2 size={32} className="animate-spin" />
                    <p className="font-sans text-sm font-medium animate-pulse">Analyzing dashboard metrics...</p>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{aiInsights}</div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800/50">
                <button 
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                     const blob = new Blob([aiInsights], { type: "text/plain" });
                     const link = document.createElement("a");
                     link.href = URL.createObjectURL(blob);
                     link.target = "_blank";
                     link.download = "Executive_Insights.txt";
                     link.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download size={18} />
                  Download Notes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand Chart Lightbox */}
      <AnimatePresence>
        {expandedChartId && expandedChartData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
            onClick={() => setExpandedChartId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl aspect-[16/10] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Expand size={20} className="text-blue-500" />
                  {expandedChartData.title}
                </h3>
                <button 
                  type="button"
                  onClick={() => setExpandedChartId(null)}
                  className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full transition-all hover:scale-110 active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 p-8 min-h-0 bg-white dark:bg-gray-950">
                <div className="w-full h-full" key={expandedChartId}>
                  {renderChartById(expandedChartId, true)}
                </div>
              </div>
              <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                <p className="text-base text-blue-600 dark:text-blue-400 font-medium">
                  💡 Analysis: {expandedChartData.insight}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

function KpiCard({ title, value, subtitle, trend, icon }: { title: string, value: string, subtitle: string, trend?: 'up'|'down', icon?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        {icon && (
          <div className="text-blue-500 dark:text-blue-400 opacity-80">
            {icon}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{value}</div>
      <div className="flex items-center gap-2">
        {trend && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trend === 'up' ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'}`}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, children, id, insight, onDownloadImg, onDownloadCsv, onExpand }: { title: string, children: React.ReactNode, id: string, insight: string, onDownloadImg?: () => void, onDownloadCsv?: () => void, onExpand?: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden group/card" id={id}>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase text-[10px] tracking-widest opacity-70">{title}</h3>
        <div className="flex items-center gap-1">
          {onExpand && (
            <button type="button" onClick={onExpand} title="Expand View" className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-all active:scale-95">
              <Expand size={14} />
            </button>
          )}
          {onDownloadCsv && (
            <button type="button" onClick={onDownloadCsv} title="Export CSV" className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-all active:scale-95">
              <FileSpreadsheet size={14} />
            </button>
          )}
          {onDownloadImg && (
            <button type="button" onClick={onDownloadImg} title="Export PNG" className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-all active:scale-95">
              <ImageIcon size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="p-4 flex-1">
        {children}
      </div>
      <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/20">
        <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">💡 Insight: {insight}</p>
      </div>
    </div>
  );
}
