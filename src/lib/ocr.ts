import Tesseract from "tesseract.js";

export interface ExtractedData {
  // Front side
  full_name_amharic: string;
  full_name_english: string;
  date_of_birth_ethiopian: string;
  date_of_birth_gregorian: string;
  sex: string;
  sex_amharic: string;
  date_of_issue_ethiopian: string;
  date_of_issue_gregorian: string;
  date_of_expiry_ethiopian: string;
  date_of_expiry_gregorian: string;
  fan_number: string;
  profile_image: string;
  profile_image_color: string;
  barcode_image: string;
  barcode_value: string;
  // Back side
  qr_code_image: string;
  phone_number: string;
  nationality: string;
  nationality_amharic: string;
  fin_number: string;
  address: {
    region: string;
    region_amharic: string;
    zone: string;
    zone_amharic: string;
    woreda: string;
    woreda_amharic: string;
  };
}

/* ====================== IMPROVED PREPROCESSING ====================== */
function preprocessForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 1. Grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = Math.floor(gray);
  }

  // 2. Auto contrast stretch
  let minGray = 255, maxGray = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = data[i];
    minGray = Math.min(minGray, g);
    maxGray = Math.max(maxGray, g);
  }
  if (maxGray > minGray) {
    const range = maxGray - minGray;
    for (let i = 0; i < data.length; i += 4) {
      let g = Math.floor(((data[i] - minGray) / range) * 255);
      data[i] = data[i + 1] = data[i + 2] = g;
    }
  }

  // 3. Strong contrast boost (tuned for ID cards)
  for (let i = 0; i < data.length; i += 4) {
    let g = data[i] - 128;
    g = g * 2.6 + 128;
    g = Math.max(0, Math.min(255, Math.floor(g)));
    data[i] = data[i + 1] = data[i + 2] = g;
  }

  // 4. Binarization
  const threshold = 105;
  for (let i = 0; i < data.length; i += 4) {
    const bin = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = bin;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function upscaleForOCR(canvas: HTMLCanvasElement, scale: number = 2.1): HTMLCanvasElement {
  if (scale <= 1) return canvas;
  const newW = Math.round(canvas.width * scale);
  const newH = Math.round(canvas.height * scale);
  const scaled = document.createElement("canvas");
  scaled.width = newW;
  scaled.height = newH;
  const ctx = scaled.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, newW, newH);
  return scaled;
}

/* ====================== REGION HELPERS (unchanged + minor tweaks) ====================== */
function extractRegion(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): string {
  const canvas = extractRegionCanvas(img, xRatio, yRatio, wRatio, hRatio);
  return canvas.toDataURL("image/png");
}

function extractRegionCanvas(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const x = Math.floor(img.naturalWidth * xRatio);
  const y = Math.floor(img.naturalHeight * yRatio);
  const w = Math.floor(img.naturalWidth * wRatio);
  const h = Math.floor(img.naturalHeight * hRatio);
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas;
}

function extractAndRotateRegionCW(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): HTMLCanvasElement {
  // ... (your original function unchanged)
  const x = Math.floor(img.naturalWidth * xRatio);
  const y = Math.floor(img.naturalHeight * yRatio);
  const w = Math.floor(img.naturalWidth * wRatio);
  const h = Math.floor(img.naturalHeight * hRatio);

  const crop = document.createElement("canvas");
  crop.width = w; crop.height = h;
  crop.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);

  const rotated = document.createElement("canvas");
  rotated.width = h; rotated.height = w;
  const ctx = rotated.getContext("2d")!;
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(crop, 0, 0);
  return rotated;
}

/* ====================== HELPERS (slightly improved) ====================== */
function findAllDates(text: string): string[] {
  const dates: string[] = [];
  const sep = `[\/\\-\\.\\ ]`;
  const patterns = [
    new RegExp(`\\d{1,2}${sep}\\d{1,2}${sep}\\d{4}`, "g"),
    new RegExp(`\\d{4}${sep}\\d{1,2}${sep}\\d{1,2}`, "g"),
    new RegExp(`\\d{4}${sep}[A-Za-z]{3,}${sep}\\d{1,2}`, "g"),
    new RegExp(`\\d{1,2}${sep}[A-Za-z]{3,}${sep}\\d{4}`, "g"),
  ];
  const seen = new Set<string>();
  for (const p of patterns) {
    const m = text.match(p);
    if (m) m.forEach(d => { if (!seen.has(d)) { seen.add(d); dates.push(d); } });
  }
  return dates;
}

function findFAN(text: string): string {
  const cleaned = text.replace(/\s+/g, "");
  const match = cleaned.match(/\d{14,20}/);   // more strict length
  return match ? match[0] : "";
}

function loadImage(file: File): Promise<HTMLImageElement> { /* your original */ }

function classifyDate(date: string): "ethiopian" | "gregorian" {
  if (/[A-Za-z]{3,}/.test(date)) return "gregorian";
  const yearMatch = date.match(/\d{4}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    return year <= 2035 ? "ethiopian" : "gregorian";   // updated for 2026+
  }
  return "ethiopian";
}

function assignDates(dates: string[], ethField: string, gregField: string, result: ExtractedData) {
  for (const d of dates) {
    const type = classifyDate(d);
    if (type === "ethiopian" && !(result as any)[ethField]) {
      (result as any)[ethField] = d;
    } else if (type === "gregorian" && !(result as any)[gregField]) {
      (result as any)[gregField] = d;
    }
  }
}

export function createEmptyResult(): ExtractedData { /* your original */ }

/* ====================== FRONT SIDE - IMPROVED ====================== */
export async function extractFrontSide(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> {
  const img = await loadImage(imageFile);
  onProgress?.(5, "Front image loaded...");

  result.profile_image = extractRegion(img, 0.29, 0.22, 0.38, 0.28);
  result.barcode_image = extractRegion(img, 0.30, 0.68, 0.38, 0.035);

  const worker = await Tesseract.createWorker("amh+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress) {
        onProgress?.(10 + m.progress * 25, "OCR in progress...");
      }
    },
  });

  // Tighter main text area
  onProgress?.(30, "Recognizing main text...");
  let mainCanvas = extractRegionCanvas(img, 0.05, 0.48, 0.70, 0.40);
  mainCanvas = preprocessForOCR(mainCanvas);
  mainCanvas = upscaleForOCR(mainCanvas, 2.1);
  const mainResult = await worker.recognize(mainCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: 6,   // uniform block of text
  });
  const mainText = mainResult.data.text;
  console.log("=== Front main text OCR ===\n", mainText);

  const lines = mainText.split("\n").map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/[\u1200-\u137F]/.test(line) && !/\d/.test(line) && 
        !line.includes("ወንድ") && !line.includes("ሴት") && 
        !result.full_name_amharic) {
      result.full_name_amharic = line;
      continue;
    }
    if (/^[A-Za-z\s.'-]+$/.test(line) && line.length > 4 && 
        !result.full_name_english) {
      result.full_name_english = line;
      continue;
    }
    if (line.includes("ሴት") || line.toLowerCase().includes("female")) {
      result.sex = "Female"; result.sex_amharic = "ሴት";
    }
    if (line.includes("ወንድ") || line.toLowerCase().includes("male")) {
      result.sex = "Male"; result.sex_amharic = "ወንድ";
    }

    const dates = findAllDates(line);
    if (dates.length > 0) {
      if (!result.date_of_birth_ethiopian && !result.date_of_birth_gregorian) {
        assignDates(dates, "date_of_birth_ethiopian", "date_of_birth_gregorian", result);
      } else if (!result.date_of_expiry_ethiopian && !result.date_of_expiry_gregorian) {
        assignDates(dates, "date_of_expiry_ethiopian", "date_of_expiry_gregorian", result);
      }
    }

    const fan = findFAN(line);
    if (fan && !result.fan_number) result.fan_number = fan;
  }

  // Vertical Date of Issue - tighter + whitelist
  onProgress?.(45, "Reading Date of Issue...");
  let vertCanvas = extractAndRotateRegionCW(img, 0.82, 0.06, 0.155, 0.78);
  vertCanvas = preprocessForOCR(vertCanvas);
  vertCanvas = upscaleForOCR(vertCanvas, 2.2);
  const vertResult = await worker.recognize(vertCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: 7,                     // single line/column
    tessedit_char_whitelist: "0123456789/-. ",
  });
  let vertText = vertResult.data.text;
  vertText = vertText.replace(/1(20\d{2})/g, "$1")
                     .replace(/0(\d)\1/g, "0$1");
  console.log("=== Vertical text OCR (cleaned) ===\n", vertText);

  const vertDates = findAllDates(vertText);
  if (vertDates.length > 0) {
    assignDates(vertDates, "date_of_issue_ethiopian", "date_of_issue_gregorian", result);
  }

  if (!result.fan_number) {
    const fan = findFAN(mainText);
    if (fan) result.fan_number = fan;
  }

  await worker.terminate();
}

/* ====================== BACK SIDE - IMPROVED ====================== */
export async function extractBackSide(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> {
  const img = await loadImage(imageFile);
  onProgress?.(55, "Back image loaded...");

  result.qr_code_image = extractRegion(img, 0.15, 0.18, 0.70, 0.36);

  const worker = await Tesseract.createWorker("amh+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress) {
        onProgress?.(60 + m.progress * 30, "Reading back side...");
      }
    },
  });

  // Tighter text area
  onProgress?.(65, "Recognizing back side text...");
  let textCanvas = extractRegionCanvas(img, 0.04, 0.56, 0.92, 0.40);
  textCanvas = preprocessForOCR(textCanvas);
  textCanvas = upscaleForOCR(textCanvas, 2.0);
  const textResult = await worker.recognize(textCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: 6,
  });
  const backText = textResult.data.text;
  console.log("=== Back side OCR ===\n", backText);

  // FIN - tighter + whitelist
  let finCanvas = extractRegionCanvas(img, 0.48, 0.55, 0.50, 0.11);
  finCanvas = preprocessForOCR(finCanvas);
  finCanvas = upscaleForOCR(finCanvas, 2.1);
  const finResult = await worker.recognize(finCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: 7,
    tessedit_char_whitelist: "0123456789FINfinልዩቁጥር ",
  });
  const finText = finResult.data.text;
  const finDigits = finText.replace(/[^\d]/g, "");
  if (finDigits.length >= 11) result.fin_number = finDigits;

  const lines = backText.split("\n").map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    const phoneRegex = /(?:\+251|251|09|07)\d{8}/;

    // Phone
    if ((lineLower.includes("phone") || line.includes("ስልክ")) && !result.phone_number) {
      const cleaned = line.replace(/\s/g, "");
      let match = cleaned.match(phoneRegex);
      if (!match && i + 1 < lines.length) {
        match = lines[i + 1].replace(/\s/g, "").match(phoneRegex);
      }
      if (match) result.phone_number = match[0];
      continue;
    }

    const standalone = line.replace(/\s/g, "").match(phoneRegex);
    if (standalone && !result.phone_number) {
      result.phone_number = standalone[0];
      continue;
    }

    // FIN (fallback)
    if ((lineLower.includes("fin") || line.includes("ልዩ ቁጥር") || line.includes("ፊን")) && !result.fin_number) {
      const finMatch = line.match(/\d[\d\s]{10,}/);
      if (finMatch) result.fin_number = finMatch[0].replace(/\s/g, "");
      continue;
    }

    // Nationality
    if ((lineLower.includes("nationality") || line.includes("ዜግነት")) && !result.nationality) {
      if (lineLower.includes("ethiopian") || line.includes("ኢትዮጵያ")) {
        result.nationality = "Ethiopian";
        result.nationality_amharic = "ኢትዮጵያ";
      }
      continue;
    }

    if ((lineLower.includes("ethiopian") || line.includes("ኢትዮጵያ")) && !result.nationality) {
      result.nationality = "Ethiopian";
      result.nationality_amharic = "ኢትዮጵያዊ";
      continue;
    }

    // Address
    if ((lineLower.includes("address") || line.includes("አድራሻ")) && !result.address.region) {
      const addressLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        const al = lines[j];
        if (al.toLowerCase().includes("fin") || al.includes("ፊን") || 
            al.toLowerCase().includes("phone") || al.includes("ስልክ")) break;
        if (al.length > 1) addressLines.push(al);
      }
      const englishLines = addressLines.filter(l => /^[A-Za-z0-9\s.,'\-\/]+$/.test(l) && l.length > 1);
      const amharicLines = addressLines.filter(l => /[\u1200-\u137F]/.test(l));

      if (englishLines.length >= 1) result.address.region = englishLines[0];
      if (englishLines.length >= 2) result.address.zone = englishLines[1];
      if (englishLines.length >= 3) result.address.woreda = englishLines[2];
      if (amharicLines.length >= 1) result.address.region_amharic = amharicLines[0];
      if (amharicLines.length >= 2) result.address.zone_amharic = amharicLines[1];
      if (amharicLines.length >= 3) result.address.woreda_amharic = amharicLines[2];
    }
  }

  await worker.terminate();
}

export async function extractColorID(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  const img = await loadImage(imageFile);
  onProgress?.(90, "Extracting color profile...");
  // Extract colored profile image (same region as front profile)
  result.profile_image_color = extractRegion(img, 0.264, 0.19, 0.47, 0.286);
  // result.profile_image_color = extractRegion(img, 0.262, 0.19, 0.50, 0.29);
  // Extract colored QR code (same region as back QR)
}
export async function extractIDData(
  frontFile: File,
  backFile: File | null,
  colorFile: File | null,
  onProgress?: (progress: number, status: string) => void,
): Promise<ExtractedData> {
  const result = createEmptyResult();

  await extractFrontSide(frontFile, result, onProgress);
  onProgress?.(50, "Front side complete.");

  if (backFile) {
    await extractBackSide(backFile, result, onProgress);
  }

  if (colorFile) {
    await extractColorID(colorFile, result, onProgress);
  }

  onProgress?.(100, "Done!");
  return result;
}
