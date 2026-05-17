import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import pptxgen from "pptxgenjs";
import { DataRow } from "../types";

const getElementImage = async (elementId: string, isDark: boolean, format: 'png' | 'jpeg' = 'png', scale: number = 2) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");
  
  const bgColor = isDark ? '#111827' : '#f9fafb';
  
  // To capture full scrollable area, we use the scrollHeight/Width
  const options = { 
    pixelRatio: scale, 
    backgroundColor: bgColor, 
    skipFonts: true,
    quality: 0.85,
    width: element.scrollWidth,
    height: element.scrollHeight,
    style: {
      overflow: 'visible',
      height: element.scrollHeight + 'px'
    }
  };
  
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

    // Create PDF with dimensions matching the captured full scrollable content
    // Use pixels to avoid conversion rounding and ensure 1:1 match
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
  chartsElementsIds: string[], 
  data: DataRow[],
  isDark: boolean,
  filename: string = "Sales_Business_Intelligence.pptx"
) => {
  try {
    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9";

    let slide = pres.addSlide();
    slide.background = { color: isDark ? "1f2937" : "ffffff" };
    slide.addText("BI Sales Dashboard", {
      x: 1, y: 2, w: "80%", h: 2,
      fontSize: 44, color: isDark ? "60a5fa" : "003366", bold: true, align: "center"
    });
    slide.addText(`Extracted on ${new Date().toLocaleString()}`, {
      x: 1, y: 4, w: "80%", h: 1,
      fontSize: 18, color: "666666", align: "center"
    });

    for (const [index, id] of chartsElementsIds.entries()) {
      try {
        const imgData = await getElementImage(id, isDark, 'png', 2);
        let s = pres.addSlide();
        s.background = { color: isDark ? "111827" : "f9fafb" };
        s.addImage({ data: imgData, x: 0.5, y: 1, w: 5, h: 4 });
        s.addText(`Chart Insight ${index + 1}`, { x: 0.5, y: 0.2, w: "90%", h: 0.8, fontSize: 24, color: isDark ? "e5e7eb" : "333333", bold: true });
        
        const sampleData = data.slice(0, 5).map(row => [
          row.Region, String(row["Sales Value"])
        ]);
        
        if (sampleData.length > 0) {
           s.addTable(
             [["Region", "Sales"] as string[], ...sampleData as string[][]] as any,
             { x: 6, y: 1, w: 3.5, colW: [1.5, 2], border: { type: "solid", color: "CCCCCC", pt: 1 }, fill: { color: "F7F7F7" } }
           );
        }
      } catch (e) {
        console.warn(`Could not export chart ${id}`, e);
      }
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
