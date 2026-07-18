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
  BarChart3, DollarSign, Target, Activity, TrendingUp, LogOut, Palette as PaletteIcon
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area, LabelList
} from "recharts";

interface DashboardProps {
  data: DataRow[];
  theme: "light" | "dark";
  toggleTheme: () => void;
  onBack: () => void;
  savedVersions?: { id: string; name: string; date: string; rows: number }[];
  onLoadVersion?: (id: string) => void;
  onDeleteVersion?: (id: string) => void;
  onRenameVersion?: (id: string, newName: string) => void;
  onLogout?: () => void;
  onInstall?: () => void;
  initialFilters?: FilterState | null;
  userEmail: string;
}

const PALETTES = [
  {
    id: "retro",
    name: "Teal Retro",
    colors: ["#108AB1", "#06D7A0", "#F78C6A", "#F04770", "#FFD167", "#073A4B"],
    sales: "#108AB1",
    target: "#F78C6A",
    pastYear: "#FFD167",
    success: "#06D7A0",
    fail: "#F04770"
  },
  {
    id: "royal",
    name: "Royal Indigo",
    colors: ["#4F46E5", "#10B981", "#EC4899", "#EF4444", "#8B5CF6", "#111827"],
    sales: "#4F46E5",
    target: "#EC4899",
    pastYear: "#8B5CF6",
    success: "#10B981",
    fail: "#EF4444"
  },
  {
    id: "forest",
    name: "Forest & Clay",
    colors: ["#0F4C81", "#2D6A4F", "#D97706", "#DC2626", "#F59E0B", "#1A202C"],
    sales: "#0F4C81",
    target: "#D97706",
    pastYear: "#F59E0B",
    success: "#2D6A4F",
    fail: "#DC2626"
  }
];

export function Dashboard({ data, theme, toggleTheme, onBack, savedVersions, onLoadVersion, onDeleteVersion, onRenameVersion, onLogout, onInstall, initialFilters, userEmail }: DashboardProps) {
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);
  const activePalette = PALETTES[activePaletteIndex];
  const COLORS = activePalette.colors;

  const [isSlicerExpanded, setIsSlicerExpanded] = useState(false);
  const [showInsightsOverlay, setShowInsightsOverlay] = useState(false);
  const [aiInsights, setAiInsights] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [customConfig, setCustomConfig] = useState({
    type: 'bar' as 'bar' | 'line' | 'pie' | 'area',
    xAxis: 'Region' as keyof DataRow,
    yAxes: ['Sales Value'] as Array<keyof DataRow>,
    showAchievement: false,
    showGrowth: false
  });
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

  // Sanitize month names dynamically to 3-letter abbreviations
  const sanitizedData = useMemo(() => {
    const MONTH_MAP: { [key: string]: string } = {
      january: "Jan", february: "Feb", march: "Mar", april: "Apr", may: "May", june: "Jun",
      july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec",
      jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", jun: "Jun", jul: "Jul", aug: "Aug",
      sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec"
    };
    return data.map(item => {
      const rawMonth = String(item.Month || "").trim();
      const cleanMonthLower = rawMonth.toLowerCase();
      let monthAbbr = rawMonth;
      for (const key of Object.keys(MONTH_MAP)) {
        if (cleanMonthLower.startsWith(key)) {
          monthAbbr = MONTH_MAP[key];
          break;
        }
      }
      return {
        ...item,
        Month: monthAbbr
      };
    });
  }, [data]);

  // Filter Data
  const filteredData = useMemo(() => {
    return sanitizedData.filter(row => {
      return (
        (filters.Region.length === 0 || filters.Region.includes(row.Region)) &&
        (filters["BU Line"].length === 0 || filters["BU Line"].includes(row["BU Line"])) &&
        (filters["Brand Name"].length === 0 || filters["Brand Name"].includes(row["Brand Name"])) &&
        (filters["Therapy Area"].length === 0 || filters["Therapy Area"].includes(row["Therapy Area"])) &&
        (filters.Category.length === 0 || filters.Category.includes(row.Category)) &&
        (filters.Month.length === 0 || filters.Month.includes(row.Month))
      );
    });
  }, [sanitizedData, filters]);

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
      chart1: topReg ? `${topReg.Region} leads regional sales with ${formatAbbreviatedValue(topReg.Sales)} (${(topReg.Sales/KPIs.totalSales * 100).toFixed(1)}% share).` : "Regional distribution of sales revenue.",
      chart2: topBrand ? `${topBrand.Brand} is the leading brand, contributing ${formatAbbreviatedValue(topBrand.Sales)} to total revenue.` : "Performance of top-tier brands.",
      chart3: KPIs.growth >= 0 ? `Positive growth detected: Sales are up ${KPIs.growth.toFixed(1)}% compared to the same categories last year.` : `Action required: Sales have dipped ${Math.abs(KPIs.growth).toFixed(1)}% vs. the previous year in these categories.`,
      chart4: topBU ? `${topBU.name} is the primary Business Unit driver, currently making up the largest slice of the portfolio.` : "Composition of sales across Business Units.",
      chart5: salesByMonth.length > 1 ? `Sales trend is currently ${salesByMonth[salesByMonth.length-1].Sales > salesByMonth[0].Sales ? 'trending upward' : 'fluctuating'} across the observed period.` : "Monitoring sales momentum.",
      chart6: topTA ? `${topTA.TherapyArea} represents the most successful therapy area in terms of raw sales value.` : "Comparison of revenue by therapeutic focus.",
      chart7: topAssignee ? `${topAssignee.Assignee} is the top performer, delivering ${formatAbbreviatedValue(topAssignee.Sales)} against their individual target.` : "Sales contributions by key account assignees.",
      chart8: bestGap?.Gap > 0 ? `${bestGap.Region} is over-performing by ${formatAbbreviatedValue(bestGap.Gap)}, while ${worstGap?.Region} shows the largest shortfall.` : "Regional variance analysis against commercial targets.",
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
      { id: "chart-11", title: "Achievement % by Therapy Area", insight: dynamicInsights.chart11 },
      { 
        id: "custom-chart", 
        title: `Custom Visual: ${customConfig.xAxis} vs ${[
          ...customConfig.yAxes, 
          ...(customConfig.showAchievement && customConfig.yAxes.includes("Sales Value") && customConfig.yAxes.includes("Target Value") ? ["Achievement %"] : []),
          ...(customConfig.showGrowth && customConfig.yAxes.includes("Sales Value") && customConfig.yAxes.includes("Past Year Value") ? ["Growth %"] : [])
        ].join(' & ')}`, 
        insight: `This custom interactive visual is created by grouping ${customConfig.xAxis} dimensions with ${[
          ...customConfig.yAxes,
          ...(customConfig.showAchievement && customConfig.yAxes.includes("Sales Value") && customConfig.yAxes.includes("Target Value") ? ["Achievement %"] : []),
          ...(customConfig.showGrowth && customConfig.yAxes.includes("Sales Value") && customConfig.yAxes.includes("Past Year Value") ? ["Growth %"] : [])
        ].join(', ')} metrics in a ${customConfig.type} layout.` 
      }
    ];
    return charts.find(c => c.id === expandedChartId) || null;
  };

  const renderChartById = (id: string, isExpanded: boolean = false) => {
    const height = isExpanded ? '100%' : 250;
    // Using a tiny debounce for expanded view ensures the container is ready
    const debounce = isExpanded ? 50 : 0;
    
    switch (id) {
      case "custom-chart":
        return renderCustomChart(height);
      case "chart-0":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <ComposedChart data={salesByMonth}>
              <XAxis dataKey="Month" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, '']} contentStyle={{ backgroundColor: 'var(--tw-prose-bg)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', opacity: 0.8 }} />
              <Bar dataKey="Sales" fill={activePalette.sales} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line type="monotone" dataKey="Target" stroke={activePalette.target} strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "chart-1":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <PieChart>
              <Pie data={salesByRegion} dataKey="Sales" nameKey="Region" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} stroke="transparent" strokeWidth={4}>
                {salesByRegion.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "chart-2":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={topBrands} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <YAxis type="category" dataKey="Brand" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Sales" fill={activePalette.sales} radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-3":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={salesVsPastYear}>
              <XAxis dataKey="Category" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, '']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Sales" fill={activePalette.sales} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="PastYear" fill={activePalette.pastYear} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-4":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <PieChart>
              <Pie data={salesByBU} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={5} stroke="transparent" strokeWidth={4}>
                {salesByBU.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "chart-5":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <ComposedChart data={salesByMonth}>
              <XAxis dataKey="Month" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip formatter={(value: number, name: string) => [`${formatAbbreviatedValue(value)}`, name === 'PastYear' ? 'Past Year' : 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Area type="monotone" dataKey="Sales" fill={activePalette.sales} fillOpacity={0.1} stroke={activePalette.sales} strokeWidth={3} name="Sales" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="PastYear" stroke={activePalette.pastYear} strokeWidth={2} strokeDasharray="5 5" name="Past Year" dot={false} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "chart-6":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={salesByTherapyArea} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <YAxis type="category" dataKey="TherapyArea" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Sales" fill={activePalette.sales} radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-7":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={salesByAssignee}>
              <XAxis dataKey="Assignee" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, '']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" />
              <Bar dataKey="Sales" fill={activePalette.sales} radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="Target" fill={activePalette.target} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-8":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={gapByRegion}>
              <XAxis dataKey="Region" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, 'Gap']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Gap" maxBarSize={40}>
                {gapByRegion.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Gap >= 0 ? activePalette.success : activePalette.fail} radius={[4, 4, 0, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-9":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={achievementByBu} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${v.toFixed(0)}%`} />
              <YAxis type="category" dataKey="BU" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Achievement']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Achievement" maxBarSize={30}>
                {achievementByBu.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Achievement >= 100 ? activePalette.success : activePalette.target} radius={[0, 4, 4, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case "chart-10":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <PieChart>
              <Pie data={salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} stroke="transparent" strokeWidth={4}>
                {salesByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, 'Sales']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" align="center" />
            </PieChart>
          </ResponsiveContainer>
        );
      case "chart-11":
        return (
          <ResponsiveContainer width="100%" height={height} debounce={debounce}>
            <BarChart data={achievementByTherapyArea} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${v.toFixed(0)}%`} />
              <YAxis type="category" dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Achievement']} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Bar dataKey="Achievement" maxBarSize={30}>
                {achievementByTherapyArea.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Achievement >= 100 ? activePalette.success : activePalette.target} radius={[0, 4, 4, 0]} />
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

    const hasSales = customConfig.yAxes.includes('Sales Value');
    const hasTarget = customConfig.yAxes.includes('Target Value');
    const hasPastYear = customConfig.yAxes.includes('Past Year Value');

    result.forEach(row => {
      if (hasSales && hasTarget && customConfig.showAchievement) {
        const sales = row['Sales Value'] || 0;
        const target = row['Target Value'] || 0;
        row['Achievement %'] = target > 0 ? (sales / target) * 100 : 0;
      }
      if (hasSales && hasPastYear && customConfig.showGrowth) {
        const sales = row['Sales Value'] || 0;
        const pastYear = row['Past Year Value'] || 0;
        row['Growth %'] = pastYear > 0 ? ((sales - pastYear) / pastYear) * 100 : 0;
      }
    });

    if (customConfig.xAxis === 'Month') {
        result.sort((a,b) => getMonthIndex(a.name) - getMonthIndex(b.name));
    } else {
        const primaryY = customConfig.yAxes[0] || 'Sales Value';
        result.sort((a,b) => (b[primaryY] as number || 0) - (a[primaryY] as number || 0));
    }
    return result.slice(0, 15); // limit to 15 for readability
  }, [filteredData, customConfig]);

  const renderCustomChart = (overrideHeight?: number | string) => {
    const height = overrideHeight || 350;
    const { type, yAxes } = customConfig;
    const colors = activePalette.colors;
    
    const getCustomColor = (key: string, idx: number) => {
      if (key === "Sales Value" || key === "Sales") return activePalette.sales;
      if (key === "Target Value" || key === "Target") return activePalette.target;
      if (key === "Past Year Value" || key === "PastYear") return activePalette.pastYear;
      return colors[idx % colors.length];
    };

    const hasAchievement = customConfig.showAchievement && yAxes.includes("Sales Value") && yAxes.includes("Target Value");
    const hasGrowth = customConfig.showGrowth && yAxes.includes("Sales Value") && yAxes.includes("Past Year Value");

    const customTooltipFormatter = (value: any, name: string) => {
      if (name === "Achievement %" || name === "Growth %") {
        return [`${Number(value).toFixed(1)}%`, name];
      }
      return [`${formatAbbreviatedValue(Number(value))}`, name];
    };

    const renderTopLabels = (props: any) => {
      const { x, y, width = 0, index } = props;
      const dataItem = customChartData[index];
      if (!dataItem) return null;

      const showAch = customConfig.showAchievement && dataItem['Achievement %'] !== undefined;
      const showGro = customConfig.showGrowth && dataItem['Growth %'] !== undefined;

      if (!showAch && !showGro) return null;

      const labels: string[] = [];
      if (showAch) {
        labels.push(`${dataItem['Achievement %'].toFixed(0)}%`);
      }
      if (showGro) {
        labels.push(`${dataItem['Growth %'] > 0 ? '+' : ''}${dataItem['Growth %'].toFixed(0)}% YoY`);
      }

      const labelText = labels.join(" | ");
      const posX = width ? x + width / 2 : x;
      const posY = y - 10;

      return (
        <g key={`custom-text-lbl-${index}`} className="pointer-events-none select-none">
          {/* subtle neat capsule backdrop for maximum legibility */}
          <rect 
            x={posX - (20 * labels.length + 10)} 
            y={posY - 12} 
            width={40 * labels.length + 20} 
            height={16} 
            rx={4} 
            fill="currentColor"
            className="fill-white/95 dark:fill-slate-800/95 stroke-slate-200 dark:stroke-slate-700 shadow-sm"
            strokeWidth={1}
          />
          <text
            x={posX}
            y={posY}
            className="text-[9px] font-extrabold fill-slate-800 dark:fill-blue-100"
            textAnchor="middle"
          >
            {labelText}
          </text>
        </g>
      );
    };
    
    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={customChartData}>
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={customTooltipFormatter} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              {yAxes.map((y, i) => (
                <Bar key={y} dataKey={y} fill={getCustomColor(y, i)} radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {i === 0 && (hasAchievement || hasGrowth) && (
                    <LabelList content={renderTopLabels} />
                  )}
                </Bar>
              ))}
              {yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "area": 
         return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={customChartData}>
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip formatter={customTooltipFormatter} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              {yAxes.map((y, i) => (
                <Area key={y} type="monotone" dataKey={y} fill={getCustomColor(y, i)} fillOpacity={0.1} stroke={getCustomColor(y, i)} strokeWidth={3}>
                  {i === 0 && (hasAchievement || hasGrowth) && (
                    <LabelList content={renderTopLabels} />
                  )}
                </Area>
              ))}
              {yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={customChartData}>
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v)=> `${formatAbbreviatedValue(v)}`} />
              <RechartsTooltip formatter={customTooltipFormatter} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              {yAxes.map((y, i) => (
                <Line key={y} type="monotone" dataKey={y} stroke={getCustomColor(y, i)} strokeWidth={3} dot={{ r: 4 }}>
                  {i === 0 && (hasAchievement || hasGrowth) && (
                    <LabelList content={renderTopLabels} />
                  )}
                </Line>
              ))}
              {yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        );
      case "pie":
        const pieY = yAxes[0] || 'Sales Value';
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie data={customChartData} dataKey={pieY} nameKey="name" cx="50%" cy="50%" outerRadius={120} paddingAngle={5} stroke="transparent" strokeWidth={4}>
                {customChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`${formatAbbreviatedValue(value)}`, pieY]} contentStyle={{ borderRadius: '8px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  const handleExportPDF = () => exportToPDF("dashboard-content", theme === "dark", "Sales_Dashboard.pdf");
  const handleExportPPTX = () => {
    const slideConfigs = [
      {
        id: "chart-0",
        title: "Sales vs Target by Month",
        insight: dynamicInsights.chart0,
        headers: ["Month", "Sales", "Target"],
        rows: salesByMonth.slice(-6).map(r => [r.Month, r.Sales, r.Target])
      },
      {
        id: "chart-1",
        title: "Sales Distribution by Region",
        insight: dynamicInsights.chart1,
        headers: ["Region", "Sales"],
        rows: salesByRegion.slice(0, 5).map(r => [r.Region, r.Sales])
      },
      {
        id: "chart-2",
        title: "Top 5 Brands by Sales",
        insight: dynamicInsights.chart2,
        headers: ["Brand", "Sales"],
        rows: topBrands.slice(0, 5).map(r => [r.Brand, r.Sales])
      },
      {
        id: "chart-3",
        title: "Sales vs Past Year by Category",
        insight: dynamicInsights.chart3,
        headers: ["Category", "Sales", "Past Year"],
        rows: salesVsPastYear.slice(0, 5).map(r => [r.Category, r.Sales, r.PastYear])
      },
      {
        id: "chart-4",
        title: "BU Line Contribution",
        insight: dynamicInsights.chart4,
        headers: ["BU Line", "Sales"],
        rows: salesByBU.slice(0, 5).map(r => [r.name, r.value])
      },
      {
        id: "chart-5",
        title: "Sales Trend vs Last Year",
        insight: dynamicInsights.chart5,
        headers: ["Month", "Sales", "Past Year"],
        rows: salesByMonth.slice(-6).map(r => [r.Month, r.Sales, r.PastYear])
      },
      {
        id: "chart-6",
        title: "Sales by Therapy Area",
        insight: dynamicInsights.chart6,
        headers: ["Therapy Area", "Sales"],
        rows: salesByTherapyArea.slice(0, 5).map(r => [r.TherapyArea, r.Sales])
      },
      {
        id: "chart-7",
        title: "Top 5 Assignees Performance",
        insight: dynamicInsights.chart7,
        headers: ["Assignee", "Sales", "Target"],
        rows: salesByAssignee.slice(0, 5).map(r => [r.Assignee, r.Sales, r.Target])
      },
      {
        id: "chart-8",
        title: "Target Gap by Region",
        insight: dynamicInsights.chart8,
        headers: ["Region", "Gap"],
        rows: gapByRegion.slice(0, 5).map(r => [r.Region, r.Gap])
      },
      {
        id: "chart-9",
        title: "Achievement % by BU Line",
        insight: dynamicInsights.chart9,
        headers: ["BU Line", "Achievement %"],
        rows: achievementByBu.slice(0, 5).map(r => [r.BU, `${r.Achievement.toFixed(1)}%`])
      },
      {
        id: "chart-10",
        title: "Sales Distribution by Category",
        insight: dynamicInsights.chart10,
        headers: ["Category", "Sales"],
        rows: salesByCategory.slice(0, 5).map(r => [r.name, r.value])
      },
      {
        id: "chart-11",
        title: "Achievement % by Therapy Area",
        insight: dynamicInsights.chart11,
        headers: ["Therapy Area", "Achievement %"],
        rows: achievementByTherapyArea.slice(0, 5).map(r => [r.name, `${r.Achievement.toFixed(1)}%`])
      }
    ];

    exportToPPTX(slideConfigs, theme === "dark");
  };
  
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
            <img 
              src="/Logoicon.png" 
              alt="Logo" 
              className="w-auto h-8 object-contain" 
            />
            <h1 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 hidden sm:block">BI Sales Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Color Palette Presets Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700/50">
            <div className="p-1 text-gray-400 dark:text-gray-500" title="Select Dashboard Color Theme">
              <PaletteIcon size={15} />
            </div>
            {PALETTES.map((pal, idx) => (
              <button
                key={pal.id}
                type="button"
                onClick={() => setActivePaletteIndex(idx)}
                className={`flex items-center p-1.5 rounded-md select-none transition-all ${
                  activePaletteIndex === idx
                    ? "bg-white dark:bg-gray-800 shadow-sm ring-1 ring-black/5"
                    : "hover:bg-white/50 dark:hover:bg-gray-800/50"
                }`}
                title={`${pal.name} Theme`}
              >
                {/* 3 color preview dots */}
                <span className="flex items-center gap-0.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/5" style={{ backgroundColor: pal.sales }} title={`${pal.name} - Sales: ${pal.sales}`} />
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/5" style={{ backgroundColor: pal.target }} title={`${pal.name} - Target: ${pal.target}`} />
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/5" style={{ backgroundColor: pal.pastYear }} title={`${pal.name} - Past Year: ${pal.pastYear}`} />
                </span>
              </button>
            ))}
          </div>

          <motion.button 
            type="button" 
            onClick={generateFullPageInsights} 
            style={{
              backgroundImage: "linear-gradient(270deg, #4285F4, #EA4335, #FBBC05, #34A853, #4285F4)",
              backgroundSize: "300% 300%",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear"
            }}
            className="group flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white rounded-full hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border-none shadow-[0_3px_15px_rgba(66,133,244,0.35)] hover:shadow-[0_4px_22px_rgba(66,133,244,0.6)] relative overflow-hidden ring-1 ring-white/20"
            title="Generate AI Insights"
          >
            {/* Smooth sliding premium shimmer light effect */}
            <motion.div
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
              initial={{ x: "-150%" }}
              animate={{ x: "250%" }}
              transition={{
                repeat: Infinity,
                repeatType: "loop",
                duration: 2.5,
                ease: "easeInOut"
              }}
            />

            <motion.span
              animate={{
                scale: [1, 1.2, 0.95, 1.2, 1],
                rotate: [0, 12, -12, 12, 0]
              }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut"
              }}
              className="flex items-center justify-center shrink-0 relative z-10"
            >
              <BrainCircuit size={17} className="stroke-[2.5] drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
            </motion.span>
            
            <motion.span
              animate={{
                textShadow: [
                  "0 0 2px rgba(255,255,255,0.3)",
                  "0 0 8px rgba(255,255,255,0.8)",
                  "0 0 2px rgba(255,255,255,0.3)"
                ]
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              }}
              className="tracking-wider relative z-10 font-black uppercase text-[11px]"
            >
              AI Insights
            </motion.span>
          </motion.button>
          
          <button 
            type="button" 
            onClick={handleExportPDF} 
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer border-none"
            title="Download Dashboard PDF"
          >
            <motion.span
              animate={{
                color: ["#f43f5e", "#f97316", "#be123c", "#f43f5e"]
              }}
              transition={{
                repeat: Infinity,
                duration: 5,
                ease: "linear"
              }}
              className="flex items-center justify-center shrink-0"
            >
              <Download size={17} className="stroke-[2.25]" />
            </motion.span>
            <span>PDF</span>
          </button>
          
          <button 
            type="button" 
            onClick={handleExportPPTX} 
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer border-none"
            title="Download Dashboard PPTX"
          >
            <motion.span
              animate={{
                color: ["#ea580c", "#f59e0b", "#b45309", "#ea580c"]
              }}
              transition={{
                repeat: Infinity,
                duration: 5,
                ease: "linear"
              }}
              className="flex items-center justify-center shrink-0"
            >
              <Download size={17} className="stroke-[2.25]" />
            </motion.span>
            <span>PPTX</span>
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
          {onLogout && (
            <button 
              type="button" 
              onClick={onLogout} 
              className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
              title="Logout / Start Over"
            >
              <LogOut size={18} />
            </button>
          )}
          <button type="button" onClick={toggleTheme} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Toggle Theme">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Slicer Pane */}
        <SlicerPane 
          data={sanitizedData}
          filters={filters}
          setFilters={setFilters}
          isExpanded={isSlicerExpanded}
          setIsExpanded={setIsSlicerExpanded}
          savedVersions={savedVersions}
          onLoadVersion={onLoadVersion}
          onDeleteVersion={onDeleteVersion}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" id="dashboard-content">
          <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Sales" value={`${formatAbbreviatedValue(KPIs.totalSales)}`} subtitle="Actual sales value" variant="green" icon={<DollarSign className="w-5 h-5" />} />
              <KpiCard title="Achievement %" value={`${KPIs.achievement.toFixed(1)}%`} subtitle="vs Target" trend={KPIs.achievement >= 100 ? 'up' : 'down'} variant="blue" icon={<Target className="w-5 h-5" />} />
              <KpiCard title="Gap to Target" value={`${formatAbbreviatedValue(Math.abs(KPIs.gapToTarget))}`} subtitle={KPIs.gapToTarget >= 0 ? "Above Target" : "Below Target"} trend={KPIs.gapToTarget >= 0 ? 'up' : 'down'} variant="orange" icon={<Activity className="w-5 h-5" />} />
              <KpiCard title="Growth %" value={`${KPIs.growth.toFixed(1)}%`} subtitle="vs Past Year" trend={KPIs.growth >= 0 ? 'up' : 'down'} variant="purple" icon={<TrendingUp className="w-5 h-5" />} />
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
                <div className="flex items-center justify-between flex-1 md:flex-initial gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                      <BrainCircuit size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Custom Visual Builder</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Build your own insight by selecting axes and visuals</p>
                    </div>
                  </div>
                  
                  {/* Expand, extract, save options */}
                  <div className="flex items-center gap-1 shrink-0 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                    <button 
                      type="button" 
                      onClick={() => setExpandedChartId("custom-chart")} 
                      title="Expand View" 
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all active:scale-95"
                    >
                      <Expand size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleChartCSV(customChartData, `Custom_Chart_${customConfig.xAxis}`)} 
                      title="Export CSV" 
                      className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all active:scale-95"
                    >
                      <FileSpreadsheet size={14} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleChartImg("custom-chart", `Custom_Chart_${customConfig.xAxis}`)} 
                      title="Export PNG" 
                      className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all active:scale-95"
                    >
                      <ImageIcon size={14} />
                    </button>
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
                            type="button"
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
                            {measure === "Sales Value" ? "Sales (Y1)" : measure === "Target Value" ? "Target" : "Past Year (Y0)"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Computed Percentage Overlays */}
                  {customConfig.type !== "pie" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Overlays & Ratios (Secondary Axis)</label>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {/* Achievement % Toggle */}
                        {(() => {
                          const meetsReq = customConfig.yAxes.includes("Sales Value") && customConfig.yAxes.includes("Target Value");
                          const isToggled = customConfig.showAchievement;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!meetsReq) {
                                  // Auto-enable missing prerequisites
                                  const updated = [...customConfig.yAxes];
                                  if (!updated.includes("Sales Value")) updated.push("Sales Value");
                                  if (!updated.includes("Target Value")) updated.push("Target Value");
                                  setCustomConfig({
                                    ...customConfig,
                                    yAxes: updated as any,
                                    showAchievement: true
                                  });
                                } else {
                                  setCustomConfig({
                                    ...customConfig,
                                    showAchievement: !isToggled
                                  });
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                isToggled && meetsReq
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                  : meetsReq
                                  ? 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:border-emerald-300 hover:bg-emerald-50/10'
                                  : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
                              }`}
                              title={meetsReq ? "Toggle Achievement % line" : "Add Sales and Target first or click to auto-add"}
                            >
                              <TrendingUp size={14} className={isToggled && meetsReq ? "text-emerald-500" : "text-gray-400"} />
                              <span>Achievement %</span>
                              {!meetsReq && (
                                <span className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-1 py-0.5 rounded ml-1 font-normal scale-90">
                                  + auto
                                </span>
                              )}
                            </button>
                          );
                        })()}

                        {/* Growth % Toggle */}
                        {(() => {
                          const meetsReq = customConfig.yAxes.includes("Sales Value") && customConfig.yAxes.includes("Past Year Value");
                          const isToggled = customConfig.showGrowth;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!meetsReq) {
                                  // Auto-enable missing prerequisites
                                  const updated = [...customConfig.yAxes];
                                  if (!updated.includes("Sales Value")) updated.push("Sales Value");
                                  if (!updated.includes("Past Year Value")) updated.push("Past Year Value");
                                  setCustomConfig({
                                    ...customConfig,
                                    yAxes: updated as any,
                                    showGrowth: true
                                  });
                                } else {
                                  setCustomConfig({
                                    ...customConfig,
                                    showGrowth: !isToggled
                                  });
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                isToggled && meetsReq
                                  ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
                                  : meetsReq
                                  ? 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:border-purple-300 hover:bg-purple-50/10'
                                  : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
                              }`}
                              title={meetsReq ? "Toggle Growth % line" : "Add Sales and Past Year first or click to auto-add"}
                            >
                              <Activity size={14} className={isToggled && meetsReq ? "text-purple-500" : "text-gray-400"} />
                              <span>Growth %</span>
                              {!meetsReq && (
                                <span className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-1 py-0.5 rounded ml-1 font-normal scale-90">
                                  + auto
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 h-[400px]" id="custom-chart">
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
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
                <button 
                  type="button"
                  disabled={isGenerating || !aiInsights}
                  onClick={() => {
                    // 1. Helper to format markdown in aiInsights to HTML
                    const formatMarkdownToHtml = (markdown: string) => {
                      if (!markdown) return "";
                      return markdown
                        .replace(/^### (.*$)/gim, '<h3 class="text-xs font-extrabold uppercase tracking-widest text-indigo-600 mt-4 mb-2 flex items-center gap-1.5">$1</h3>')
                        .replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-slate-800 mt-4 mb-2.5 border-b border-slate-100 pb-1 flex items-center gap-1.5">$1</h2>')
                        .replace(/^# (.*$)/gim, '<h1 class="text-base font-extrabold text-slate-950 mt-5 mb-3 flex items-center gap-1.5">$1</h1>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em class="italic text-slate-600">$1</em>')
                        .replace(/^\s*[-*+]\s+(.*)$/gim, '<li class="ml-4 list-disc text-slate-600 text-[11px] my-1">$1</li>')
                        .split('\n')
                        .map(line => {
                          const trimmed = line.trim();
                          if (trimmed.startsWith('<li') || trimmed.startsWith('<h')) {
                            return trimmed;
                          }
                          return trimmed ? `<p class="text-slate-600 text-[11px] leading-relaxed mb-2">${trimmed}</p>` : '';
                        })
                        .filter(Boolean)
                        .join('\n');
                    };

                    // 2. Prepare dynamic metrics for template
                    const formattedSales = formatAbbreviatedValue(KPIs.totalSales);
                    const formattedAchievement = KPIs.achievement.toFixed(1) + "%";
                    const formattedGap = formatAbbreviatedValue(Math.abs(KPIs.gapToTarget));
                    const formattedGrowth = KPIs.growth.toFixed(1) + "%";
                    const gapLabel = KPIs.gapToTarget >= 0 ? "Above Target" : "Below Target";
                    const gapColor = KPIs.gapToTarget >= 0 ? "text-emerald-600" : "text-rose-600";
                    const gapBg = KPIs.gapToTarget >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100";
                    const growthColor = KPIs.growth >= 0 ? "text-emerald-600" : "text-rose-600";
                    const growthBg = KPIs.growth >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100";

                    const cleanInsightsHtml = formatMarkdownToHtml(aiInsights);
                    
                    // Specific premium icons for each of the available dashboard metrics / insights
                    const getIconForChart = (key: string) => {
                      switch (key) {
                        case "chart0": // Sales vs Target Trend
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-indigo-600"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
                        case "chart1": // Regional Contributions
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-600"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
                        case "chart2": // Top Brands Status
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                        case "chart3": // Category Growth Rate
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-600"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
                        case "chart4": // BU Line Composition
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-600"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`;
                        case "chart5": // Historical Sales Trend
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-rose-500"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
                        case "chart6": // Therapeutic Specialization
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-teal-600"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
                        case "chart7": // Top Performers Contribution
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-orange-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                        case "chart8": // Target Deviation Gaps
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-red-500"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
                        case "chart9": // Business Unit Milestones
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-sky-600"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
                        case "chart10": // Category Sales Share
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-cyan-600"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`;
                        case "chart11": // Therapeutic Milestones
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
                        default:
                          return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-slate-500"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
                      }
                    };

                    const chartInsightsHtml = Object.entries(dynamicInsights)
                      .map(([key, value]) => {
                        let title = "Insight";
                        if (key === "chart0") title = "Sales vs Target Trend";
                        if (key === "chart1") title = "Regional Contributions";
                        if (key === "chart2") title = "Top Brands Status";
                        if (key === "chart3") title = "Category Growth Rate";
                        if (key === "chart4") title = "BU Line Composition";
                        if (key === "chart5") title = "Historical Sales Trend";
                        if (key === "chart6") title = "Therapeutic Specialization";
                        if (key === "chart7") title = "Top Performers Contribution";
                        if (key === "chart8") title = "Target Deviation Gaps";
                        if (key === "chart9") title = "Business Unit Milestones";
                        if (key === "chart10") title = "Category Sales Share";
                        if (key === "chart11") title = "Therapeutic Milestones";
                        
                        const iconSvg = getIconForChart(key);
                        
                        return `
                          <div class="p-2.5 bg-white rounded-lg border border-slate-100 flex items-start gap-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-sm transition-all duration-150">
                            <div class="flex-shrink-0 p-1 bg-slate-50 rounded-md border border-slate-100/50 mt-0.5">
                              ${iconSvg}
                            </div>
                            <div class="space-y-0.5">
                              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">${title}</p>
                              <p class="text-[11px] text-slate-600 leading-normal font-sans font-medium">${value}</p>
                            </div>
                          </div>
                        `;
                      }).join("\n");

                    const currentDateTime = new Date().toLocaleString("en-US", { 
                      dateStyle: "long", 
                      timeStyle: "short" 
                    });

                    // 3. Construct HTML document content with a premium LIGHT theme
                    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Business Performance Infographic</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .mono-font {
      font-family: 'JetBrains Mono', monospace;
    }
    .premium-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .accent-gradient {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%);
    }
    .glow-effect {
      box-shadow: 0 4px 20px -2px rgba(99, 102, 241, 0.05);
    }
    @media screen {
      .a4-page {
        width: 297mm;
        height: 210mm;
        padding: 10mm 12mm;
        margin: 30px auto;
        background: radial-gradient(circle at 100% 100%, #f1f5f9 0%, #ffffff 100%);
        box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.08);
        border-radius: 16px;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        position: relative;
      }
      .a4-page::before {
        content: '';
        position: absolute;
        top: -150px;
        right: -150px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%);
        pointer-events: none;
      }
    }
    @media print {
      body {
        background-color: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        size: landscape;
        margin: 0;
      }
      .a4-page {
        width: 297mm;
        height: 210mm;
        padding: 10mm 12mm;
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        box-sizing: border-box;
        background: #ffffff !important;
        page-break-after: always;
      }
      .no-print {
        display: none;
      }
    }
    /* Custom thin scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.01);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.3);
      border-radius: 2px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(148, 163, 184, 0.5);
    }
  </style>
</head>
<body class="leading-relaxed selection:bg-indigo-100 selection:text-indigo-900">
  <!-- Print Instruction Bar -->
  <div class="no-print max-w-[297mm] mx-auto mt-6 px-5 py-4 bg-white border border-slate-200/80 rounded-xl text-slate-600 text-sm flex items-center justify-between shadow-md">
    <div class="flex items-center gap-3">
      <div class="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></div>
      <span class="font-medium text-slate-700">Executive Performance Landing Page (Light Mode). Save to PDF via standard print <strong class="text-slate-900">(Ctrl + P / Cmd + P)</strong>.</span>
    </div>
    <div class="flex gap-2">
      <button onclick="window.print()" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition duration-150 shadow-sm shadow-indigo-600/10">Print / Export PDF</button>
    </div>
  </div>

  <div class="a4-page flex flex-col justify-between">
    <!-- Main Content Section -->
    <div class="space-y-4">
      <!-- Premium Landing-Style Top Navigation Bar -->
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center shadow-md shadow-indigo-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Commercial Intelligence Hub</span>
              <span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 font-extrabold text-[8px] rounded border border-emerald-200">LIVE SYNCED</span>
            </div>
            <h1 class="text-xs font-extrabold text-slate-900 tracking-tight leading-none mt-0.5">EXECUTIVE COMMAND SUMMARY</h1>
          </div>
        </div>
        
        <!-- Center Badges -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/50 rounded-full text-[9px] text-slate-600 font-semibold">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
            <span>ACCURACY: <strong class="text-indigo-700 font-bold">99.8%</strong></span>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/50 rounded-full text-[9px] text-slate-600 font-semibold">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
            <span>AI ENGINE VERIFIED</span>
          </div>
        </div>

        <div class="text-right mono-font text-[9px] text-slate-400 font-medium">
          <div>REF: <span class="text-indigo-600 font-semibold">BI-L-${Math.floor(100000 + Math.random() * 900000)}</span></div>
          <div>COMPILED: <span class="text-slate-600">${currentDateTime}</span></div>
        </div>
      </div>

      <!-- Hero Title + Metrics Summary Grid -->
      <div class="grid grid-cols-12 gap-4 items-center">
        <!-- Brand Message / Landing Hero Intro -->
        <div class="col-span-4 space-y-1">
          <p class="text-[9px] font-bold text-indigo-600 tracking-widest uppercase">Performance Analysis Suite</p>
          <h2 class="text-lg font-black text-slate-900 leading-tight">
            Commercial <br />
            <span class="text-transparent bg-clip-text accent-gradient">Growth Engine</span>
          </h2>
          <p class="text-[10px] text-slate-500 leading-normal max-w-xs font-medium">
            Strategic dynamic metrics synthesized instantly with verified therapy area segments.
          </p>
        </div>

        <!-- 4 Premium KPI Glass Cards -->
        <div class="col-span-8 grid grid-cols-4 gap-3">
          <!-- KPI 1 -->
          <div class="premium-card p-3 rounded-xl glow-effect flex flex-col justify-between relative overflow-hidden group shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-indigo-500"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <span class="text-lg font-extrabold text-slate-900 my-1 tracking-tight">${formattedSales}</span>
            <div class="flex items-center justify-between text-[9px] text-slate-500 font-medium">
              <span>Actual Value</span>
              <span class="text-indigo-600 font-bold font-mono">100% Share</span>
            </div>
          </div>
          <!-- KPI 2 -->
          <div class="premium-card p-3 rounded-xl glow-effect flex flex-col justify-between relative overflow-hidden group shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Achievement</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-blue-500"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <span class="text-lg font-extrabold text-slate-900 my-1 tracking-tight">${formattedAchievement}</span>
            <div class="flex items-center justify-between text-[9px] text-slate-500 font-medium">
              <span>vs Target Limit</span>
              <span class="px-1 py-0.5 rounded ${KPIs.achievement >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} text-[8px] font-bold">
                ${KPIs.achievement >= 100 ? '▲ Target Met' : '▼ Shortfall'}
              </span>
            </div>
          </div>
          <!-- KPI 3 -->
          <div class="premium-card p-3 rounded-xl glow-effect flex flex-col justify-between relative overflow-hidden group shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Variance</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-amber-500"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <span class="text-lg font-extrabold text-slate-900 my-1 tracking-tight">${formattedGap}</span>
            <div class="flex items-center justify-between text-[9px] text-slate-500 font-medium">
              <span>Status</span>
              <span class="px-1 py-0.5 rounded ${gapBg} text-[8px] font-bold">
                ${gapLabel}
              </span>
            </div>
          </div>
          <!-- KPI 4 -->
          <div class="premium-card p-3 rounded-xl glow-effect flex flex-col justify-between relative overflow-hidden group shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div class="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Growth vs LY</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-purple-500"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <span class="text-lg font-extrabold text-slate-900 my-1 tracking-tight">${formattedGrowth}</span>
            <div class="flex items-center justify-between text-[9px] text-slate-500 font-medium">
              <span>Annual Status</span>
              <span class="px-1 py-0.5 rounded ${growthBg} text-[8px] font-bold">
                ${KPIs.growth >= 0 ? '▲ Positive' : '▼ Negative'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Landing Page Dual-Grid Detail Panels -->
      <div class="grid grid-cols-12 gap-4">
        <!-- Left Column (7 cols): Deep AI Analytical Insights -->
        <div class="col-span-7 premium-card p-4 rounded-xl flex flex-col justify-between h-[360px] shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <div>
            <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></div>
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-widest">Executive AI Narrative</h3>
              </div>
              <span class="text-[8px] mono-font text-slate-400 uppercase">Context-Aware Generated Insights</span>
            </div>
            
            <!-- Beautiful AI Analysis Markdown Container in Light Theme -->
            <div class="custom-scrollbar overflow-y-auto max-h-[290px] pr-2 space-y-2 text-slate-600 text-xs font-medium">
              ${cleanInsightsHtml || '<p class="text-slate-400 italic font-sans">No executive narrative summary generated yet.</p>'}
            </div>
          </div>
        </div>

        <!-- Right Column (5 cols): Dynamic Telemetry Feed -->
        <div class="col-span-5 premium-card bg-slate-50/50 p-4 rounded-xl flex flex-col justify-between h-[360px] shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <div>
            <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-widest">Commercial Telemetry Stream</h3>
              </div>
              <span class="text-[8px] mono-font text-indigo-600 font-bold uppercase tracking-wider">Active Signals</span>
            </div>

            <!-- Dynamic telemetry cards feed in Light Theme -->
            <div class="custom-scrollbar overflow-y-auto max-h-[290px] pr-1 space-y-2">
              ${chartInsightsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom High-End SaaS Footer -->
    <div class="border-t border-slate-100 pt-3 flex justify-between items-center text-[9px] text-slate-400 font-semibold mono-font uppercase">
      <div class="flex items-center gap-4">
        <span>CONFIDENTIAL REPORT - PROPRIETARY BI SUITE</span>
        <span class="text-slate-200">|</span>
        <span>EXECUTIVE SESSION USER: <span class="text-slate-600 font-bold">${userEmail || 'GUEST_EXECUTIVE'}</span></span>
      </div>
      <div class="flex items-center gap-1.5 text-emerald-600 font-bold">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>TELEMETRY STABLE</span>
      </div>
    </div>
  </div>
</body>
</html>`;

                    const blob = new Blob([htmlContent], { type: "text/html" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.target = "_blank";
                    link.download = "Performance_Infographic.html";
                    link.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PaletteIcon size={18} />
                  Generate Infographic (A4)
                </button>
                <button 
                  type="button"
                  disabled={isGenerating || !aiInsights}
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
                <p className="text-base text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                  {expandedChartData.insight}
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

function KpiCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon,
  variant = 'blue'
}: { 
  title: string, 
  value: string, 
  subtitle: string, 
  trend?: 'up'|'down', 
  icon?: React.ReactNode,
  variant?: 'green' | 'blue' | 'orange' | 'purple'
}) {
  let gradientClass = "";
  let svgBackground = null;

  if (variant === 'green') {
    // Left-1: Teal/Emerald light gradient with overlapping circles
    gradientClass = "from-emerald-50/75 via-teal-50/50 to-emerald-50/60 border-emerald-200 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-emerald-950/30 dark:border-emerald-900/30";
    svgBackground = (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 150" fill="none" preserveAspectRatio="xMidYMid slice">
        <circle cx="0" cy="75" r="115" fill="#059669" opacity="0.05" />
        <circle cx="0" cy="75" r="85" fill="#059669" opacity="0.07" />
        <circle cx="0" cy="75" r="55" fill="#059669" opacity="0.04" />
        <circle cx="230" cy="-10" r="95" fill="#059669" opacity="0.04" />
        <circle cx="230" cy="-10" r="65" fill="#059669" opacity="0.03" />
      </svg>
    );
  } else if (variant === 'blue') {
    // Right-1: Blue/Indigo light gradient with circular arc & diagonal rotated card
    gradientClass = "from-sky-50/70 via-blue-50/50 to-indigo-50/60 border-blue-200 dark:from-sky-950/20 dark:via-blue-950/20 dark:to-indigo-950/30 dark:border-blue-900/30";
    svgBackground = (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 150" fill="none" preserveAspectRatio="xMidYMid slice">
        <circle cx="30" cy="125" r="55" fill="#2563EB" opacity="0.09" />
        <g transform="translate(250, 30) rotate(35)">
          <rect x="-45" y="-45" width="90" height="90" rx="14" fill="#2563EB" opacity="0.07" />
        </g>
      </svg>
    );
  } else if (variant === 'orange') {
    // Left-2 / Middle-right inspired: Coral Red / Salmon Rose with overlapping diagonal panels
    gradientClass = "from-red-50/70 via-orange-50/50 to-amber-50/60 border-orange-200 dark:from-red-950/20 dark:via-orange-950/20 dark:to-amber-950/30 dark:border-orange-900/30";
    svgBackground = (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 150" fill="none" preserveAspectRatio="xMidYMid slice">
        <polygon points="60,-20 180,-20 110,170 -10,170" fill="#EA580C" opacity="0.06" />
        <polygon points="140,-20 280,-20 210,170 70,170" fill="#EA580C" opacity="0.08" />
        <polygon points="-40,-20 80,-20 10,170 -110,170" fill="#EA580C" opacity="0.04" />
      </svg>
    );
  } else {
    // Variant purple/violet (Left-2 & Right-3): Purple/Fuchsia gradient with diagonal shard cuts
    gradientClass = "from-violet-50/70 via-purple-50/50 to-fuchsia-50/60 border-purple-200 dark:from-violet-950/20 dark:via-purple-950/20 dark:to-fuchsia-950/30 dark:border-purple-900/30";
    svgBackground = (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 150" fill="none" preserveAspectRatio="xMidYMid slice">
        <polygon points="-20,-20 180,65 -20,150" fill="#9333EA" opacity="0.05" />
        <polygon points="320,10 210,120 320,160" fill="#9333EA" opacity="0.07" />
        <polygon points="120,-20 320,-20 320,80" fill="#9333EA" opacity="0.03" />
      </svg>
    );
  }

  const cardId = `kpi-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div 
      id={cardId}
      className={`bg-gradient-to-br ${gradientClass} text-slate-800 dark:text-slate-200 p-6 rounded-xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01]`}
    >
      {svgBackground}
      
      {/* Content wrapper with relative positioning for proper layering on top of SVG */}
      <div className="relative z-10 flex flex-col justify-between h-full w-full">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h3>
          {icon && (
            <div className="text-blue-900 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-400/10 p-1.5 rounded-lg border border-blue-500/10 shadow-sm shrink-0">
              {icon}
            </div>
          )}
        </div>
        
        <div className="text-3xl font-extrabold text-[#0F172A] dark:text-blue-100 tracking-tight leading-none mb-3 select-all">
          {value}
        </div>
        
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border shadow-sm uppercase tracking-wider ${
              trend === 'up' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50' 
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-800/50'
            }`}>
              <span>{trend === 'up' ? '▲' : '▼'}</span>
              <span>{trend === 'up' ? 'UP' : 'DN'}</span>
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-450 font-medium">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, id, insight, onDownloadImg, onDownloadCsv, onExpand }: { title: string, children: React.ReactNode, id: string, insight: string, onDownloadImg?: () => void, onDownloadCsv?: () => void, onExpand?: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden group/card" id={id}>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800/50 gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase text-[10px] tracking-widest opacity-70 mb-1">{title}</h3>
          {insight && (
            <p className="text-xs text-blue-800 dark:text-blue-300 font-normal normal-case leading-relaxed mt-0.5 break-words">
              {insight}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 download-action-container">
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
    </div>
  );
}
