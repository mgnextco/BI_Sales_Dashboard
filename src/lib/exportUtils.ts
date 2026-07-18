import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import pptxgen from "pptxgenjs";
import { DataRow, PPTSlideConfig } from "../types";

const getElementImage = async (elementId: string, isDark: boolean, format: 'png' | 'jpeg' = 'png', scale: number = 2) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");
  
  const bgColor = isDark ? '#111827' : '#ffffff';
  const isFullDashboard = elementId === "dashboard-content";
  
  // To capture full scrollable area, we use the scrollHeight/Width only for the full page PDF.
  // For individual charts, we capture their exact natural on-screen size to prevent distortion.
  const options: any = { 
    pixelRatio: scale, 
    backgroundColor: bgColor, 
    skipFonts: true,
    quality: 0.95,
    filter: (node: any) => {
      if (node.classList && node.classList.contains('download-action-container')) {
        return false;
      }
      return true;
    }
  };

  if (isFullDashboard) {
    options.width = element.scrollWidth;
    options.height = element.scrollHeight;
    options.style = {
      overflow: 'visible',
      height: element.scrollHeight + 'px'
    };
  } else {
    const rect = element.getBoundingClientRect();
    options.width = rect.width;
    options.height = rect.height;
    options.style = {
      transform: 'none',
      margin: '0',
      padding: '0'
    };
  }
  
  const imgData = format === 'jpeg' 
    ? await htmlToImage.toJpeg(element, options)
    : await htmlToImage.toPng(element, options);
    
  if (!imgData || imgData === 'data:,') throw new Error("Failed to generate image data");
  return imgData;
};

export const exportToPDF = async (elementId: string, isDark: boolean, filename: string = "dashboard.pdf") => {
  try {
    const imgData = await getElementImage(elementId, isDark, 'jpeg', 1.0);
    
    const img = new Image();
    img.src = imgData;
    await new Promise((resolve) => img.onload = resolve);

    const pdf = new jsPDF({
      orientation: img.width > img.height ? "landscape" : "portrait",
      unit: "px",
      format: [img.width, img.height]
    });
    
    pdf.addImage(imgData, "JPEG", 0, 0, img.width, img.height, undefined, 'FAST');
    pdf.save(filename);
  } catch (error) {
    console.error("PDF Export Error: ", error);
  }
};

export const exportToPPTX = async (
  slides: PPTSlideConfig[],
  isDark: boolean,
  filename: string = "Sales_Business_Intelligence.pptx"
) => {
  try {
    const pres = new pptxgen();
    // Explicitly define and use a guaranteed 13.33 x 7.5 widescreen 16:9 layout
    pres.defineLayout({ name: "CORP_16x9", width: 13.33, height: 7.5 });
    pres.layout = "CORP_16x9";

    // 1. Cover Slide - Redesigned to be exceptionally premium and corporate (60-30-10 Rule)
    let slide = pres.addSlide();
    slide.background = { color: isDark ? "0f172a" : "f8fafc" };

    // Accent strip on the left margin
    slide.addText("", {
      x: 0,
      y: 0,
      w: 0.4,
      h: 7.5,
      fill: { color: isDark ? "06b6d4" : "0ea5e9" }
    });

    slide.addText("BUSINESS INTELLIGENCE PERFORMANCE REVIEW", {
      x: 1.2,
      y: 1.8,
      w: 10.0,
      h: 0.4,
      fontSize: 12,
      bold: true,
      color: isDark ? "38bdf8" : "0ea5e9",
      fontFace: "Segoe UI"
    });

    slide.addText("Executive Sales BI Analysis", {
      x: 1.2,
      y: 2.2,
      w: 10.0,
      h: 1.2,
      fontSize: 44,
      bold: true,
      color: isDark ? "f1f5f9" : "0f172a",
      fontFace: "Segoe UI"
    });

    slide.addText(`Enterprise Analytics Platform • Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, {
      x: 1.2,
      y: 3.6,
      w: 10.0,
      h: 0.5,
      fontSize: 14,
      color: isDark ? "94a3b8" : "64748b",
      fontFace: "Segoe UI"
    });

    const formatNumberWithCommas = (val: any) => {
      const num = Number(val);
      if (isNaN(num)) {
        if (typeof val === 'string') {
          if (val.endsWith('%')) {
            const cleanNum = Number(val.replace('%', ''));
            if (!isNaN(cleanNum)) {
              return cleanNum.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
            }
          }
          return val;
        }
        return String(val);
      }
      if (Number.isInteger(num)) {
        return num.toLocaleString('en-US');
      }
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // 2. Content Slides - Standardized Corporate Consulting Grid Layout
    for (const sCfg of slides) {
      try {
        const imgData = await getElementImage(sCfg.id, isDark, 'png', 2);
        let s = pres.addSlide();
        s.background = { color: isDark ? "0f172a" : "f8fafc" };
        
        // Slide Title (Uppercase actual chart name)
        const slideTitle = sCfg.title ? sCfg.title.toUpperCase() : "SALES BUSINESS INTELLIGENCE";

        // Top Zone: Title (Full width)
        s.addText(slideTitle, { 
          x: 0.6, 
          y: 0.4, 
          w: 12.13, 
          h: 0.4, 
          fontSize: 22, 
          color: isDark ? "f1f5f9" : "0f172a", 
          bold: true,
          fontFace: "Segoe UI"
        });

        s.addText("Enterprise Sales Analysis & Key Performance Metrics", {
          x: 0.6,
          y: 0.8,
          w: 12.13,
          h: 0.25,
          fontSize: 10,
          color: isDark ? "94a3b8" : "64748b",
          fontFace: "Segoe UI"
        });

        // Middle-Left Zone: Chart data block
        s.addImage({ 
          data: imgData, 
          x: 0.6, 
          y: 1.2, 
          w: 5.8, 
          h: 3.2,
          sizing: { type: "contain", w: 5.8, h: 3.2 }
        });

        // Middle-Right Zone: Table data block
        if (sCfg.rows && sCfg.rows.length > 0) {
          const formattedRows = sCfg.rows.map(row => 
            row.map(cell => {
              if (typeof cell === 'number') {
                return formatNumberWithCommas(cell);
              }
              if (typeof cell === 'string' && !isNaN(Number(cell)) && cell.trim() !== '') {
                return formatNumberWithCommas(Number(cell));
              }
              return String(cell);
            })
          );

          // Determine column alignment dynamically: Left for text, Right for numbers
          const colAlignments = sCfg.headers.map((_, colIdx) => {
            let numericCount = 0;
            let totalCount = 0;
            for (const row of sCfg.rows) {
              if (row && row[colIdx] !== undefined) {
                const val = row[colIdx];
                const isNum = typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val.replace(/[%$,]/g, ''))) && val.trim() !== '');
                if (isNum) numericCount++;
                totalCount++;
              }
            }
            return (totalCount > 0 && numericCount / totalCount >= 0.5) ? "right" : "left";
          });

          const tableData = [
            // Header Row with Aligned Headers
            sCfg.headers.map((header, colIdx) => ({
              text: header,
              options: {
                bold: true,
                color: isDark ? "38bdf8" : "0f172a",
                fill: { color: isDark ? "1e293b" : "f1f5f9" },
                align: colAlignments[colIdx],
                fontFace: "Segoe UI",
                fontSize: 10,
                border: [
                  { type: "none" },
                  { type: "none" },
                  { type: "solid", color: isDark ? "475569" : "cbd5e1", pt: 1.5 },
                  { type: "none" }
                ]
              }
            })),
            // Data Rows with Alternating / Soft Row Styles and correct alignments
            ...formattedRows.map((row, rowIdx) => 
              row.map((cell, colIdx) => {
                const isHighValue = rowIdx === 0 && colIdx > 0;
                return {
                  text: String(cell),
                  options: {
                    color: isHighValue 
                      ? (isDark ? "38bdf8" : "0ea5e9") 
                      : (isDark ? "e2e8f0" : "334155"),
                    fill: isHighValue 
                      ? { color: isDark ? "0f273d" : "f0f9ff" } 
                      : { color: isDark ? "0f172a" : "f8fafc" },
                    align: colAlignments[colIdx],
                    fontFace: "Segoe UI",
                    fontSize: 9,
                    border: [
                      { type: "none" },
                      { type: "none" },
                      { type: "solid", color: isDark ? "1e293b" : "e2e8f0", pt: 1 },
                      { type: "none" }
                    ]
                  }
                };
              })
            )
          ];

          const colCount = sCfg.headers.length;
          let colW = [];
          if (colCount === 2) {
            colW = [3.0, 2.9];
          } else if (colCount === 3) {
            colW = [2.1, 1.9, 1.9];
          } else {
            const evenW = 5.9 / colCount;
            colW = Array(colCount).fill(evenW);
          }

          s.addTable(
            tableData as any,
            { 
              x: 6.8, 
              y: 1.2, 
              w: 5.9, 
              colW: colW,
              fontSize: 9
            }
          );
        }

        // Bottom Zone: Insight text block (Full width, padded) via dedicated "Bottom_Insights_Zone" object
        if (sCfg.insight) {
          const Bottom_Insights_Zone = {
            text: sCfg.insight,
            x: 0.6,
            y: 4.65,
            w: 12.13,
            h: 2.2,
            padding: 0.3,
            fillColor: isDark ? "1e293b" : "f1f5f9",
            accentColor: isDark ? "38bdf8" : "0ea5e9",
            headerText: "EXECUTIVE INSIGHT"
          };

          // Card Panel Background
          s.addText("", {
            x: Bottom_Insights_Zone.x,
            y: Bottom_Insights_Zone.y,
            w: Bottom_Insights_Zone.w,
            h: Bottom_Insights_Zone.h,
            fill: { color: Bottom_Insights_Zone.fillColor }
          });

          // Left Accent Strip
          s.addText("", {
            x: Bottom_Insights_Zone.x,
            y: Bottom_Insights_Zone.y,
            w: 0.12,
            h: Bottom_Insights_Zone.h,
            fill: { color: Bottom_Insights_Zone.accentColor }
          });

          // Insight Header Label
          s.addText(Bottom_Insights_Zone.headerText, {
            x: Bottom_Insights_Zone.x + Bottom_Insights_Zone.padding,
            y: Bottom_Insights_Zone.y + 0.1,
            w: Bottom_Insights_Zone.w - (Bottom_Insights_Zone.padding * 2),
            h: 0.3,
            fontSize: 9.5,
            bold: true,
            color: Bottom_Insights_Zone.accentColor,
            fontFace: "Segoe UI"
          });

          // Insight Narrative Content
          s.addText(Bottom_Insights_Zone.text, {
            x: Bottom_Insights_Zone.x + Bottom_Insights_Zone.padding,
            y: Bottom_Insights_Zone.y + 0.4,
            w: Bottom_Insights_Zone.w - (Bottom_Insights_Zone.padding * 2),
            h: Bottom_Insights_Zone.h - 0.5,
            fontSize: 11,
            color: isDark ? "cbd5e1" : "334155",
            valign: "top",
            fontFace: "Segoe UI",
            italic: true
          });
        }
        
      } catch (e) {
        console.warn(`Could not export chart ${sCfg.id}`, e);
      }
    }

    // --- 3. Additional Strategic Business Template Slides (Empty Templates) ---
    try {
      // Common Coordinates & Styles
      const marginX = 0.6;
      const titleW = 12.13;
      const halfColW = 5.8;
      const rightColX = 6.9;

      // Slide A: SWOT Analysis Template
      {
        let sSWOT = pres.addSlide();
        sSWOT.background = { color: isDark ? "0f172a" : "f8fafc" };

        sSWOT.addText("SWOT ANALYSIS", {
          x: marginX,
          y: 0.4,
          w: titleW,
          h: 0.8,
          fontSize: 22,
          bold: true,
          color: isDark ? "f1f5f9" : "0f172a",
          fontFace: "Segoe UI"
        });
        sSWOT.addText("Strategic evaluation of internal capabilities and external market dynamics", {
          x: marginX,
          y: 1.0,
          w: titleW,
          h: 0.4,
          fontSize: 11,
          color: isDark ? "94a3b8" : "64748b",
          fontFace: "Segoe UI"
        });

        const qH = 2.5;
        const y1 = 1.6;
        const y2 = 4.4;

        // Strengths (Top-Left)
        sSWOT.addText("", { x: marginX, y: y1, w: halfColW, h: qH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sSWOT.addText("STRENGTHS (INTERNAL)", { x: marginX + 0.2, y: y1 + 0.15, w: halfColW - 0.4, h: 0.3, fontSize: 12, bold: true, color: isDark ? "34d399" : "059669", fontFace: "Segoe UI" });
        sSWOT.addText("• [Click to enter Strength 1: Core competitive advantage]\n• [Click to enter Strength 2: Proprietary technology or specialized skills]\n• [Click to enter Strength 3: High brand equity or loyal customer base]\n• [Click to enter Strength 4: Strong financial runway or low overhead]", {
          x: marginX + 0.2, y: y1 + 0.5, w: halfColW - 0.4, h: qH - 0.6, fontSize: 10.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top"
        });

        // Weaknesses (Top-Right)
        sSWOT.addText("", { x: rightColX, y: y1, w: halfColW, h: qH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sSWOT.addText("WEAKNESSES (INTERNAL)", { x: rightColX + 0.2, y: y1 + 0.15, w: halfColW - 0.4, h: 0.3, fontSize: 12, bold: true, color: isDark ? "fb7185" : "e11d48", fontFace: "Segoe UI" });
        sSWOT.addText("• [Click to enter Weakness 1: Resource gaps or skill shortages]\n• [Click to enter Weakness 2: Process inefficiencies or legacy tools]\n• [Click to enter Weakness 3: High cost structures or low profit margins]\n• [Click to enter Weakness 4: Gaps in market penetration or product features]", {
          x: rightColX + 0.2, y: y1 + 0.5, w: halfColW - 0.4, h: qH - 0.6, fontSize: 10.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top"
        });

        // Opportunities (Bottom-Left)
        sSWOT.addText("", { x: marginX, y: y2, w: halfColW, h: qH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sSWOT.addText("OPPORTUNITIES (EXTERNAL)", { x: marginX + 0.2, y: y2 + 0.15, w: halfColW - 0.4, h: 0.3, fontSize: 12, bold: true, color: isDark ? "38bdf8" : "0284c7", fontFace: "Segoe UI" });
        sSWOT.addText("• [Click to enter Opportunity 1: Emerging market demands or target demographics]\n• [Click to enter Opportunity 2: Competitor weaknesses or gaps in market supply]\n• [Click to enter Opportunity 3: Partnerships, integrations, or alliance prospects]\n• [Click to enter Opportunity 4: Favorable industry regulations or policy shifts]", {
          x: marginX + 0.2, y: y2 + 0.5, w: halfColW - 0.4, h: qH - 0.6, fontSize: 10.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top"
        });

        // Threats (Bottom-Right)
        sSWOT.addText("", { x: rightColX, y: y2, w: halfColW, h: qH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sSWOT.addText("THREATS (EXTERNAL)", { x: rightColX + 0.2, y: y2 + 0.15, w: halfColW - 0.4, h: 0.3, fontSize: 12, bold: true, color: isDark ? "fb923c" : "ea580c", fontFace: "Segoe UI" });
        sSWOT.addText("• [Click to enter Threat 1: Rapid innovation by direct competitors]\n• [Click to enter Threat 2: Shift in customer preferences or user attrition]\n• [Click to enter Threat 3: Supply chain disruptions or vendor price hikes]\n• [Click to enter Threat 4: Economic headwinds or tightening capital markets]", {
          x: rightColX + 0.2, y: y2 + 0.5, w: halfColW - 0.4, h: qH - 0.6, fontSize: 10.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top"
        });
      }

      // Slide B: Key Issues & Opportunities Template
      {
        let sIssues = pres.addSlide();
        sIssues.background = { color: isDark ? "0f172a" : "f8fafc" };

        sIssues.addText("KEY ISSUES & STRATEGIC OPPORTUNITIES", {
          x: marginX,
          y: 0.4,
          w: titleW,
          h: 0.8,
          fontSize: 22,
          bold: true,
          color: isDark ? "f1f5f9" : "0f172a",
          fontFace: "Segoe UI"
        });
        sIssues.addText("Analysis of critical bottlenecks alongside high-impact strategic avenues for growth", {
          x: marginX,
          y: 1.0,
          w: titleW,
          h: 0.4,
          fontSize: 11,
          color: isDark ? "94a3b8" : "64748b",
          fontFace: "Segoe UI"
        });

        const colH2 = 5.2;

        // Left Column: Key Issues
        sIssues.addText("", { x: marginX, y: 1.6, w: halfColW, h: colH2, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sIssues.addText("", { x: marginX, y: 1.6, w: halfColW, h: 0.5, fill: { color: isDark ? "3f1621" : "fff1f2" } });
        sIssues.addText("CRITICAL ISSUES & CHALLENGES", { x: marginX + 0.3, y: 1.7, w: halfColW - 0.6, h: 0.3, fontSize: 12, bold: true, color: isDark ? "fda4af" : "e11d48", fontFace: "Segoe UI" });
        sIssues.addText(
          "1. RESOURCE CONSTRAINTS & SKILL GAPS\n" +
          "   [Detail the specific bottleneck e.g., engineering constraints, lacking specialized training or hiring delays]\n\n" +
          "2. SYSTEM ACCURACY & DATA SILOS\n" +
          "   [Detail the data integration gaps, manual sync times, or potential report latency issues]\n\n" +
          "3. OPERATIONAL OVERHEAD\n" +
          "   [Detail high manual processing times, excessive review loops, or administrative pain points]\n\n" +
          "4. CUSTOMER CHURN & RETENTION RISKS\n" +
          "   [Detail specific drop-offs in customer lifecycles, user experience friction points, or churn indicators]",
          { x: marginX + 0.3, y: 2.3, w: halfColW - 0.6, h: colH2 - 0.8, fontSize: 10, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top" }
        );

        // Right Column: Opportunities
        sIssues.addText("", { x: rightColX, y: 1.6, w: halfColW, h: colH2, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sIssues.addText("", { x: rightColX, y: 1.6, w: halfColW, h: 0.5, fill: { color: isDark ? "062f4f" : "f0f9ff" } });
        sIssues.addText("STRATEGIC GROWTH OPPORTUNITIES", { x: rightColX + 0.3, y: 1.7, w: halfColW - 0.6, h: 0.3, fontSize: 12, bold: true, color: isDark ? "38bdf8" : "0369a1", fontFace: "Segoe UI" });
        sIssues.addText(
          "1. AI-DRIVEN PROCESS AUTOMATION\n" +
          "   [Opportunity to streamline tedious operations, utilize predictive models, and scale processing throughput]\n\n" +
          "2. CORE MARKET EXPANSION\n" +
          "   [Opportunity to target complementary market segments, unlock regional cohorts, or launch specialized features]\n\n" +
          "3. ENHANCED REPORTING & REVENUE MODEL\n" +
          "   [Opportunity to monetize custom BI views, upsell predictive analytics suites, or bundle dashboard services]\n\n" +
          "4. BRAND INTEGRATION & CO-MARKETING\n" +
          "   [Opportunity to partner with industry giants, establish co-branded utilities, or publish proprietary market reports]",
          { x: rightColX + 0.3, y: 2.3, w: halfColW - 0.6, h: colH2 - 0.8, fontSize: 10, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top" }
        );
      }

      // Slide C: Action Plan Template
      {
        let sAction = pres.addSlide();
        sAction.background = { color: isDark ? "0f172a" : "f8fafc" };

        sAction.addText("STRATEGIC ACTION PLAN", {
          x: marginX,
          y: 0.4,
          w: titleW,
          h: 0.8,
          fontSize: 22,
          bold: true,
          color: isDark ? "f1f5f9" : "0f172a",
          fontFace: "Segoe UI"
        });
        sAction.addText("Roadmap and tactical milestones categorized by initiation phase, rollout schedule, and optimization loops", {
          x: marginX,
          y: 1.0,
          w: titleW,
          h: 0.4,
          fontSize: 11,
          color: isDark ? "94a3b8" : "64748b",
          fontFace: "Segoe UI"
        });

        const cardW = 3.8;
        const cardH = 5.2;
        const stepX1 = 0.6;
        const stepX2 = 4.76;
        const stepX3 = 8.93;

        // Step 1 Card
        sAction.addText("", { x: stepX1, y: 1.6, w: cardW, h: cardH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sAction.addText("", { x: stepX1, y: 1.6, w: cardW, h: 0.4, fill: { color: isDark ? "334155" : "e2e8f0" } });
        sAction.addText("PHASE 1: RESEARCH & INITIATION", { x: stepX1 + 0.2, y: 1.7, w: cardW - 0.4, h: 0.3, fontSize: 11, bold: true, color: isDark ? "f1f5f9" : "0f172a", fontFace: "Segoe UI" });
        sAction.addText(
          "TIMELINE: Weeks 1 - 4\n\n" +
          "• [Task 1.1: Map current data structures and dependencies]\n" +
          "  Owner: [Product Team]\n\n" +
          "• [Task 1.2: Host alignment workshops with regional stakeholders]\n" +
          "  Owner: [Business Lead]\n\n" +
          "• [Task 1.3: Draft engineering schema and verify model accuracy]\n" +
          "  Owner: [Engineering Team]\n\n" +
          "• [Task 1.4: Establish baseline KPIs and target parameters]\n" +
          "  Owner: [Analytics Team]",
          { x: stepX1 + 0.2, y: 2.2, w: cardW - 0.4, h: cardH - 1.2, fontSize: 9.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top" }
        );

        // Step 2 Card
        sAction.addText("", { x: stepX2, y: 1.6, w: cardW, h: cardH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sAction.addText("", { x: stepX2, y: 1.6, w: cardW, h: 0.4, fill: { color: isDark ? "1e3a8a" : "dbeafe" } });
        sAction.addText("PHASE 2: IMPLEMENTATION & ROLLOUT", { x: stepX2 + 0.2, y: 1.7, w: cardW - 0.4, h: 0.3, fontSize: 11, bold: true, color: isDark ? "93c5fd" : "1e40af", fontFace: "Segoe UI" });
        sAction.addText(
          "TIMELINE: Weeks 5 - 12\n\n" +
          "• [Task 2.1: Develop API endpoints and pipeline connectors]\n" +
          "  Owner: [Backend Dev]\n\n" +
          "• [Task 2.2: Build dynamic interactive frontend dashboards]\n" +
          "  Owner: [Frontend Dev]\n\n" +
          "• [Task 2.3: Execute closed-beta pilot tests with 5 top accounts]\n" +
          "  Owner: [Success Team]\n\n" +
          "• [Task 2.4: Iterate on user interface feedback and resolve bugs]\n" +
          "  Owner: [Product/QA Teams]",
          { x: stepX2 + 0.2, y: 2.2, w: cardW - 0.4, h: cardH - 1.2, fontSize: 9.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top" }
        );

        // Step 3 Card
        sAction.addText("", { x: stepX3, y: 1.6, w: cardW, h: cardH, fill: { color: isDark ? "1e293b" : "ffffff" } });
        sAction.addText("", { x: stepX3, y: 1.6, w: cardW, h: 0.4, fill: { color: isDark ? "064e3b" : "d1fae5" } });
        sAction.addText("PHASE 3: EVALUATION & SCALING", { x: stepX3 + 0.2, y: 1.7, w: cardW - 0.4, h: 0.3, fontSize: 11, bold: true, color: isDark ? "6ee7b7" : "065f46", fontFace: "Segoe UI" });
        sAction.addText(
          "TIMELINE: Ongoing / Continuous\n\n" +
          "• [Task 3.1: Monitor real-time system performance and CPU load]\n" +
          "  Owner: [DevOps Lead]\n\n" +
          "• [Task 3.2: Launch global marketing push and public PR campaign]\n" +
          "  Owner: [Marketing Team]\n\n" +
          "• [Task 3.3: Assess actual vs baseline KPIs to track ROI]\n" +
          "  Owner: [Financial Analyst]\n\n" +
          "• [Task 3.4: Incorporate machine learning models for predictions]\n" +
          "  Owner: [AI Engineers]",
          { x: stepX3 + 0.2, y: 2.2, w: cardW - 0.4, h: cardH - 1.2, fontSize: 9.5, color: isDark ? "cbd5e1" : "334155", fontFace: "Segoe UI", valign: "top" }
        );
      }

      // Slide D: Next Period Forecast Template
      {
        let sForecast = pres.addSlide();
        sForecast.background = { color: isDark ? "0f172a" : "f8fafc" };

        sForecast.addText("NEXT PERIOD BUSINESS FORECAST", {
          x: marginX,
          y: 0.4,
          w: titleW,
          h: 0.8,
          fontSize: 22,
          bold: true,
          color: isDark ? "f1f5f9" : "0f172a",
          fontFace: "Segoe UI"
        });
        sForecast.addText("Quantitative metrics projections and core business model assumptions", {
          x: marginX,
          y: 1.0,
          w: titleW,
          h: 0.4,
          fontSize: 11,
          color: isDark ? "94a3b8" : "64748b",
          fontFace: "Segoe UI"
        });

        const forecastHeaders = ["PROJECTION METRIC", "CURRENT PERIOD", "Q1 TARGET", "Q2 PROJECTION", "TARGET GROWTH (%)"];
        const forecastRows = [
          ["Sales Revenue (USD)", "[Click to enter e.g. 5,420,000]", "[Q1 Target e.g. 6,100,000]", "[Q2 Projected e.g. 6,800,000]", "[e.g. +25.4%]"],
          ["Active Subscriptions", "[Click to enter e.g. 12,450]", "[Q1 Target e.g. 14,000]", "[Q2 Projected e.g. 15,900]", "[e.g. +27.7%]"],
          ["Customer Acquisition Cost", "[Click to enter e.g. $145.20]", "[Q1 Target e.g. $138.00]", "[Q2 Projected e.g. $132.00]", "[e.g. -9.1%]"],
          ["Customer Lifetime Value", "[Click to enter e.g. $1,210.00]", "[Q1 Target e.g. $1,250.00]", "[Q2 Projected e.g. $1,300.00]", "[e.g. +7.4%]"],
          ["EBITDA Margin (%)", "[Click to enter e.g. 18.2%]", "[Q1 Target e.g. 19.5%]", "[Q2 Projected e.g. 21.0%]", "[e.g. +15.3%]"]
        ];

        const fcTableData = [
          forecastHeaders.map((header) => ({
            text: header,
            options: {
              bold: true,
              color: isDark ? "38bdf8" : "0f172a",
              fill: { color: isDark ? "1e293b" : "f1f5f9" },
              align: "center",
              fontFace: "Segoe UI",
              fontSize: 10,
              border: [
                { type: "solid", color: isDark ? "334155" : "cbd5e1", pt: 1 }
              ]
            }
          })),
          ...forecastRows.map((row) => 
            row.map((cell, colIdx) => ({
              text: cell,
              options: {
                color: isDark ? "cbd5e1" : "334155",
                fill: { color: isDark ? "1e293b" : "ffffff" },
                align: colIdx === 0 ? "left" : "right",
                fontFace: "Segoe UI",
                fontSize: 10,
                italic: colIdx > 0,
                border: [
                  { type: "solid", color: isDark ? "334155" : "e2e8f0", pt: 1 }
                ]
              }
            }))
          )
        ];

        sForecast.addTable(
          fcTableData as any,
          {
            x: marginX,
            y: 1.6,
            w: titleW,
            colW: [3.13, 2.25, 2.25, 2.25, 2.25]
          }
        );

        sForecast.addText("", {
          x: marginX,
          y: 4.8,
          w: titleW,
          h: 2.0,
          fill: { color: isDark ? "1e293b" : "f1f5f9" }
        });

        sForecast.addText("", {
          x: marginX,
          y: 4.8,
          w: 0.12,
          h: 2.0,
          fill: { color: isDark ? "fbbf24" : "d97706" }
        });

        sForecast.addText("CORE FORECAST ASSUMPTIONS", {
          x: marginX + 0.3,
          y: 4.9,
          w: titleW - 0.6,
          h: 0.3,
          fontSize: 11,
          bold: true,
          color: isDark ? "fbbf24" : "d97706",
          fontFace: "Segoe UI"
        });

        sForecast.addText(
          "• [Assumption 1: Customer churn remains stable at < 1.5% monthly across primary tiers]\n" +
          "• [Assumption 2: Inflation rates adjust as expected without sudden shipping/supplier price fluctuations]\n" +
          "• [Assumption 3: Core API connections and databases scale securely without unexpected infrastructure overhead]\n" +
          "• [Assumption 4: Q1 Marketing campaign converts at minimum benchmark of 2.1% on target demographics]",
          {
            x: marginX + 0.3,
            y: 5.2,
            w: titleW - 0.6,
            h: 1.5,
            fontSize: 10,
            color: isDark ? "cbd5e1" : "334155",
            fontFace: "Segoe UI",
            valign: "top"
          }
        );
      }
    } catch (e) {
      console.warn("Could not append strategic template slides:", e);
    }

    pres.writeFile({ fileName: filename });
  } catch (error) {
    console.error("PPTX Export Error: ", error);
  }
};

export const exportChartImage = async (elementId: string, isDark: boolean, filename: string) => {
  try {
    const imgData = await getElementImage(elementId, isDark, 'png', 2);
    
    const link = document.createElement("a");
    link.download = filename;
    link.href = imgData;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Chart Image Export Error: ", error);
  }
};

export const exportChartCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;
  try {
    const keys = Object.keys(data[0]);
    const csvContent = [
      keys.join(","),
      ...data.map(row => keys.map(k => `"${String(row[k])}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    link.target = "_blank";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error("CSV Export Error: ", error);
  }
};
