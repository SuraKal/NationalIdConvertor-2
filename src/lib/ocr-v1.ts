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

function preprocessForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = Math.min(255, Math.max(0, (gray - 100) * 1.8 + 100));
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function extractRegion(
  img: HTMLImageElement,
  xRatio: number, yRatio: number, wRatio: number, hRatio: number
): string {
  const canvas = document.createElement("canvas");
  const x = Math.floor(img.naturalWidth * xRatio);
  const y = Math.floor(img.naturalHeight * yRatio);
  const w = Math.floor(img.naturalWidth * wRatio);
  const h = Math.floor(img.naturalHeight * hRatio);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function extractRegionCanvas(
  img: HTMLImageElement,
  xRatio: number, yRatio: number, wRatio: number, hRatio: number
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
  xRatio: number, yRatio: number, wRatio: number, hRatio: number
): HTMLCanvasElement {
  const x = Math.floor(img.naturalWidth * xRatio);
  const y = Math.floor(img.naturalHeight * yRatio);
  const w = Math.floor(img.naturalWidth * wRatio);
  const h = Math.floor(img.naturalHeight * hRatio);

  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  crop.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);

  const rotated = document.createElement("canvas");
  rotated.width = h;
  rotated.height = w;
  const ctx = rotated.getContext("2d")!;
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(crop, 0, 0);
  return rotated;
}

function findAllDates(text: string): string[] {
  const dates: string[] = [];
  const sep = `[\/\\-\\.\\ ]`;
  const patterns = [
    new RegExp(`\\d{2}${sep}\\d{2}${sep}\\d{4}`, "g"),
    new RegExp(`\\d{4}${sep}\\d{2}${sep}\\d{2}`, "g"),
    new RegExp(`\\d{4}${sep}[A-Za-z]{3,}${sep}\\d{2}`, "g"),
    new RegExp(`\\d{2}${sep}[A-Za-z]{3,}${sep}\\d{4}`, "g"),
  ];
  const seen = new Set<string>();
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      for (const d of m) {
        if (!seen.has(d)) { seen.add(d); dates.push(d); }
      }
    }
  }
  return dates;
}

function findFAN(text: string): string {
  const cleaned = text.replace(/\s+/g, "");
  const match = cleaned.match(/[0-9]{10,20}/);
  return match ? match[0] : "";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Classify a date as Ethiopian or Gregorian based on heuristics
function classifyDate(date: string): "ethiopian" | "gregorian" {
  // Dates with alphabetical month names (e.g., "2034/Mar/02") are Gregorian
  if (/[A-Za-z]{3,}/.test(date)) return "gregorian";
  // Extract the year (first 4-digit number or last 4-digit number)
  const yearMatch = date.match(/\d{4}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    // Ethiopian years are typically 7-8 years behind Gregorian
    // Current Ethiopian year ~2018, so years <= 2020 are likely Ethiopian
    if (year <= 2020) return "ethiopian";
    return "gregorian";
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
    } else if (!(result as any)[ethField]) {
      (result as any)[ethField] = d;
    } else if (!(result as any)[gregField]) {
      (result as any)[gregField] = d;
    }
  }
}

export function createEmptyResult(): ExtractedData {
  return {
    full_name_amharic: "",
    full_name_english: "",
    date_of_birth_ethiopian: "",
    date_of_birth_gregorian: "",
    sex: "",
    sex_amharic: "",
    date_of_issue_ethiopian: "",
    date_of_issue_gregorian: "",
    date_of_expiry_ethiopian: "",
    date_of_expiry_gregorian: "",
    fan_number: "",
    profile_image: "",
    barcode_image: "",
    barcode_value: "",
    qr_code_image: "",
    phone_number: "",
    nationality: "",
    nationality_amharic: "",
    fin_number: "",
    address: { region: "", region_amharic: "", zone: "", zone_amharic: "", woreda: "", woreda_amharic: "" },
  };
}

export async function extractFrontSide(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  const img = await loadImage(imageFile);
  onProgress?.(5, "Front image loaded, initializing OCR...");

  result.profile_image = extractRegion(img, 0.18, 0.16, 0.50, 0.40);
  result.barcode_image = extractRegion(img, 0.18, 0.87, 0.58, 0.06);

  const worker = await Tesseract.createWorker("amh+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress) {
        onProgress?.(10 + m.progress * 20, "Loading OCR models...");
      }
    },
  });

  onProgress?.(30, "Recognizing main text...");
  const mainCanvas = extractRegionCanvas(img, 0, 0.53, 0.82, 0.40);
  preprocessForOCR(mainCanvas);
  const mainResult = await worker.recognize(mainCanvas.toDataURL("image/png"));
  const mainText = mainResult.data.text;
  console.log("=== Front main text OCR ===\n", mainText);

  const lines = mainText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/[\u1200-\u137F]/.test(line) && !/\d/.test(line) && !line.includes("ወንድ") && !line.includes("ሴት") && !line.includes("ካርድ") && !line.includes("ቁጥር") && !line.includes("FAN") && !result.full_name_amharic) {
      result.full_name_amharic = line;
      continue;
    }
    if (/^[A-Za-z\s.'-]+$/.test(line) && line.length > 3 && !line.includes("FAN") && !line.includes("Male") && !line.includes("Female") && !result.full_name_english) {
      result.full_name_english = line;
      continue;
    }
    if (line.includes("ወንድ") || line.toLowerCase().includes("male")) {
      result.sex = "Male";
      result.sex_amharic = "ወንድ";
      continue;
    }
    if (line.includes("ሴት") || line.toLowerCase().includes("female")) {
      result.sex = "Female";
      result.sex_amharic = "ሴት";
      continue;
    }
    const dates = findAllDates(line);
    if (dates.length > 0) {
      if (!result.date_of_birth_ethiopian && !result.date_of_birth_gregorian) {
        assignDates(dates, "date_of_birth_ethiopian", "date_of_birth_gregorian", result);
        continue;
      }
      if (!result.date_of_expiry_ethiopian && !result.date_of_expiry_gregorian) {
        assignDates(dates, "date_of_expiry_ethiopian", "date_of_expiry_gregorian", result);
        continue;
      }
    }
    const fan = findFAN(line);
    if (fan && fan.length >= 14 && !result.fan_number) {
      result.fan_number = fan;
    }
  }

  onProgress?.(40, "Reading Date of Issue...");
  const vertCanvas = extractAndRotateRegionCW(img, 0.83, 0.05, 0.17, 0.90);
  preprocessForOCR(vertCanvas);
  const vertResult = await worker.recognize(vertCanvas.toDataURL("image/png"));
  let vertText = vertResult.data.text;
  console.log("=== Vertical text OCR (raw) ===\n", vertText);

  // Clean common OCR artifacts in vertical text
  // "12018/086/15" → "2018/06/15": remove stray leading "1" before 4-digit year, fix "0XX" → "0X"
  vertText = vertText.replace(/1(20\d{2})/g, "$1"); // "12018" → "2018", "12026" → "2026"
  vertText = vertText.replace(/0(\d)\1/g, "0$1");   // "066" → "06", "088" → "08" (doubled digit)
  vertText = vertText.replace(/0(\d{2})(?=[\/\-. ])/g, (match, digits) => {
    // "086" → "06" if first digit is 0-9 and second makes it >12 (not a valid month/day pair)
    const num = parseInt(match);
    return num > 31 ? "0" + digits[1] : match;
  });
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

export async function extractBackSide(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  const img = await loadImage(imageFile);
  onProgress?.(55, "Back image loaded...");

  // QR code: large square in top portion
  result.qr_code_image = extractRegion(img, 0.10, 0.05, 0.80, 0.55);

  const worker = await Tesseract.createWorker("amh+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress) {
        onProgress?.(60 + m.progress * 30, "Reading back side...");
      }
    },
  });

  // Text area below QR code - left side (phone, nationality, address)
  onProgress?.(65, "Recognizing back side text...");
  const textCanvas = extractRegionCanvas(img, 0, 0.58, 0.60, 0.42);
  preprocessForOCR(textCanvas);
  const textResult = await worker.recognize(textCanvas.toDataURL("image/png"));
  const backText = textResult.data.text;
  console.log("=== Back side left OCR ===\n", backText);

  // Right side of back (FIN number area) - positioned next to phone number
  const finCanvas = extractRegionCanvas(img, 0.50, 0.58, 0.50, 0.10);
  preprocessForOCR(finCanvas);
  const finResult = await worker.recognize(finCanvas.toDataURL("image/png"));
  const finText = finResult.data.text;
  console.log("=== Back side FIN OCR ===\n", finText);

  // Extract FIN from right-side text
  const finDigits = finText.replace(/[^\d\s]/g, " ").trim();
  const finMatch = finDigits.match(/\d[\d\s]{10,}/);
  if (finMatch) {
    result.fin_number = finMatch[0].replace(/\s+/g, " ").trim();
  }

  const lines = backText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Phone number - extract digits, allow trailing garbage
    if ((lineLower.includes("phone") || line.includes("ስልክ")) && !result.phone_number) {
      const phoneMatch = line.match(/0\d{9}/);
      if (phoneMatch) {
        result.phone_number = phoneMatch[0];
      } else if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].match(/0\d{9}/);
        if (nextMatch) result.phone_number = nextMatch[0];
      }
      continue;
    }

    // Standalone phone number line (may have trailing chars)
    const phoneInLine = line.replace(/\s/g, "").match(/^(0\d{9})/);
    if (phoneInLine && !result.phone_number) {
      result.phone_number = phoneInLine[1];
      continue;
    }

    // FIN number
    if ((lineLower.includes("fin") || line.includes("ልዩ ቁጥር") || line.includes("ፊን")) && !result.fin_number) {
      const finMatch = line.match(/\d[\d\s]{10,}/);
      if (finMatch) {
        result.fin_number = finMatch[0].trim();
      } else if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].match(/\d[\d\s]{10,}/);
        if (nextMatch) result.fin_number = nextMatch[0].trim();
      }
      continue;
    }

    // Nationality
    if ((lineLower.includes("nationality") || line.includes("ዜግነት")) && !result.nationality) {
      if (lineLower.includes("ethiopian") || line.includes("ኢትዮጵያ")) {
        result.nationality = "Ethiopian";
        result.nationality_amharic = "ኢትዮጵያዊ";
      } else if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.toLowerCase().includes("ethiopian") || next.includes("ኢትዮጵያ")) {
          result.nationality = "Ethiopian";
          result.nationality_amharic = "ኢትዮጵያዊ";
        }
      }
      continue;
    }

    // Direct nationality match
    if ((lineLower.includes("ethiopian") || line.includes("ኢትዮጵያ")) && !result.nationality) {
      result.nationality = "Ethiopian";
      result.nationality_amharic = "ኢትዮጵያዊ";
      continue;
    }

    // Address
    if ((lineLower.includes("address") || line.includes("አድራሻ")) && !result.address.region) {
      const addressLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const addrLine = lines[j];
        if (addrLine.toLowerCase().includes("fin") || addrLine.includes("ፊን") || addrLine.toLowerCase().includes("phone") || addrLine.includes("ስልክ")) break;
        if (addrLine.length > 1) addressLines.push(addrLine);
      }
      const englishLines = addressLines.filter(l => /^[A-Za-z0-9\s.,'\-\/]+$/.test(l) && l.length > 1);
      const amharicLines = addressLines.filter(l => /[\u1200-\u137F]/.test(l));
      if (englishLines.length >= 1) result.address.region = englishLines[0];
      if (englishLines.length >= 2) result.address.zone = englishLines[1];
      if (englishLines.length >= 3) result.address.woreda = englishLines[2];
      if (amharicLines.length >= 1) result.address.region_amharic = amharicLines[0];
      if (amharicLines.length >= 2) result.address.zone_amharic = amharicLines[1];
      if (amharicLines.length >= 3) result.address.woreda_amharic = amharicLines[2];
      continue;
    }
  }

  await worker.terminate();
}

export async function extractIDData(
  frontFile: File,
  backFile: File | null,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractedData> {
  const result = createEmptyResult();

  await extractFrontSide(frontFile, result, onProgress);
  onProgress?.(50, "Front side complete.");

  if (backFile) {
    await extractBackSide(backFile, result, onProgress);
  }

  onProgress?.(100, "Done!");
  return result;
}
