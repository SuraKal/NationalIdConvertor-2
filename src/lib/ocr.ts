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

function preprocessForOCR(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Step 1: Grayscale + strong contrast + gamma correction
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = Math.pow(gray / 255, 0.85) * 255; // slight gamma
    gray = Math.min(255, Math.max(0, (gray - 70) * 2.4 + 30));
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  // Step 2: Simple adaptive threshold (helps with uneven lighting/shadows)
  const tempData = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let sum = 0;
      let count = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          sum += tempData[(ny * width + nx) * 4];
          count++;
        }
      }
      const localAvg = sum / count;
      const threshold = localAvg * 0.92; // slightly below average
      const val = data[i] > threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

async function autoOrientAndPreprocess(
  img: HTMLImageElement,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // Use OSD to detect orientation (0, 90, 180, 270)
  const osdWorker = await Tesseract.createWorker("osd", 1, {
    logger: () => {},
  });

  const osdResult = await osdWorker.recognize(canvas.toDataURL("image/png"));
  const angle = osdResult.data.orientation || 0;
  await osdWorker.terminate();

  if (angle === 0) {
    preprocessForOCR(canvas);
    return canvas;
  }

  // Rotate the canvas
  const isSideways = angle % 180 === 90;
  const rotated = document.createElement("canvas");
  rotated.width = isSideways ? canvas.height : canvas.width;
  rotated.height = isSideways ? canvas.width : canvas.height;

  const rCtx = rotated.getContext("2d")!;
  rCtx.translate(rotated.width / 2, rotated.height / 2);
  rCtx.rotate((angle * Math.PI) / 180);
  rCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  preprocessForOCR(rotated);
  return rotated;
}

function extractRegionFromCanvas(
  canvas: HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): string {
  const crop = document.createElement("canvas");
  const x = Math.floor(canvas.width * xRatio);
  const y = Math.floor(canvas.height * yRatio);
  const w = Math.floor(canvas.width * wRatio);
  const h = Math.floor(canvas.height * hRatio);

  crop.width = w;
  crop.height = h;
  crop.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return crop.toDataURL("image/png");
}

function extractAndRotateRegionCWFromCanvas(
  canvas: HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): HTMLCanvasElement {
  const x = Math.floor(canvas.width * xRatio);
  const y = Math.floor(canvas.height * yRatio);
  const w = Math.floor(canvas.width * wRatio);
  const h = Math.floor(canvas.height * hRatio);

  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  crop.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);

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
        if (!seen.has(d)) {
          seen.add(d);
          dates.push(d);
        }
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

function classifyDate(date: string): "ethiopian" | "gregorian" {
  if (/[A-Za-z]{3,}/.test(date)) return "gregorian";
  const yearMatch = date.match(/\d{4}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    if (year <= 2025) return "ethiopian"; // Updated threshold for 2026
    return "gregorian";
  }
  return "ethiopian";
}

function assignDates(
  dates: string[],
  ethField: string,
  gregField: string,
  result: ExtractedData,
) {
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
    profile_image_color: "",
    barcode_image: "",
    barcode_value: "",
    qr_code_image: "",
    phone_number: "",
    nationality: "",
    nationality_amharic: "",
    fin_number: "",
    address: {
      region: "",
      region_amharic: "",
      zone: "",
      zone_amharic: "",
      woreda: "",
      woreda_amharic: "",
    },
  };
}

export async function extractFrontSide(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(imageFile);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });

  onProgress?.(5, "Front image loaded, auto-orienting...");

  // Auto-orient + preprocess the full image (handles any rotation)
  const orientedCanvas = await autoOrientAndPreprocess(img);

  const worker = await Tesseract.createWorker("amh+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress !== undefined) {
        onProgress?.(10 + Math.floor(m.progress * 25), "Recognizing text...");
      }
    },
  });

  // Main text area - full width, lower portion (after orientation)
  onProgress?.(35, "Recognizing main front text...");
  const mainCanvas = document.createElement("canvas");
  mainCanvas.width = orientedCanvas.width;
  mainCanvas.height = Math.floor(orientedCanvas.height * 0.48);
  mainCanvas
    .getContext("2d")!
    .drawImage(
      orientedCanvas,
      0,
      Math.floor(orientedCanvas.height * 0.5),
      orientedCanvas.width,
      mainCanvas.height,
      0,
      0,
      mainCanvas.width,
      mainCanvas.height,
    );
  preprocessForOCR(mainCanvas); // extra pass for safety

  const mainResult = await worker.recognize(mainCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // good for unstructured document text
  });
  const mainText = mainResult.data.text;
  console.log("=== Front main text OCR (after auto-orient) ===\n", mainText);

  const lines = mainText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (
      /[\u1200-\u137F]/.test(line) &&
      !/\d/.test(line) &&
      !line.includes("ወንድ") &&
      !line.includes("ሴት") &&
      !line.includes("ካርድ") &&
      !line.includes("ቁጥር") &&
      !line.includes("FAN") &&
      !result.full_name_amharic
    ) {
      result.full_name_amharic = line;
      continue;
    }

    if (
      /^[A-Za-z\s.'-]+$/.test(line) &&
      line.length > 4 &&
      !line.includes("FAN") &&
      !line.includes("Male") &&
      !line.includes("Female") &&
      !result.full_name_english
    ) {
      result.full_name_english = line;
      continue;
    }

    if (line.includes("ሴት") || line.toLowerCase().includes("female")) {
      result.sex = "Female";
      result.sex_amharic = "ሴት";
      continue;
    }
    if (line.includes("ወንድ") || line.toLowerCase().includes("male")) {
      result.sex = "Male";
      result.sex_amharic = "ወንድ";
      continue;
    }

    const dates = findAllDates(line);
    if (dates.length > 0) {
      if (!result.date_of_birth_ethiopian && !result.date_of_birth_gregorian) {
        assignDates(
          dates,
          "date_of_birth_ethiopian",
          "date_of_birth_gregorian",
          result,
        );
        continue;
      }
      if (
        !result.date_of_expiry_ethiopian &&
        !result.date_of_expiry_gregorian
      ) {
        assignDates(
          dates,
          "date_of_expiry_ethiopian",
          "date_of_expiry_gregorian",
          result,
        );
        continue;
      }
    }

    const fan = findFAN(line);
    if (fan && fan.length >= 12 && !result.fan_number) {
      result.fan_number = fan;
    }
  }

  // Vertical Date of Issue (right side column) - now works after full auto-orient
  onProgress?.(65, "Reading Date of Issue...");
  const vertCanvas = extractAndRotateRegionCWFromCanvas(
    orientedCanvas,
    0.82,
    0.04,
    0.18,
    0.92,
  );
  preprocessForOCR(vertCanvas);

  const vertResult = await worker.recognize(vertCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  });
  let vertText = vertResult.data.text;
  console.log("=== Vertical text OCR (raw) ===\n", vertText);

  // Clean common vertical OCR artifacts
  vertText = vertText.replace(/1(20\d{2})/g, "$1");
  vertText = vertText.replace(/0(\d)\1/g, "0$1");
  vertText = vertText.replace(/0(\d{2})(?=[\/\-. ])/g, (match, digits) => {
    const num = parseInt(match);
    return num > 31 ? "0" + digits[1] : match;
  });

  const vertDates = findAllDates(vertText);
  if (vertDates.length > 0) {
    assignDates(
      vertDates,
      "date_of_issue_ethiopian",
      "date_of_issue_gregorian",
      result,
    );
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
  onProgress?: (progress: number, status: string) => void,
): Promise<void> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(imageFile);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });

  onProgress?.(70, "Back image loaded, auto-orienting...");

  const orientedCanvas = await autoOrientAndPreprocess(img);

  const worker = await Tesseract.createWorker("amh+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && m.progress !== undefined) {
        onProgress?.(75 + Math.floor(m.progress * 20), "Reading back side...");
      }
    },
  });

  // Main back text area (below QR area)
  onProgress?.(80, "Recognizing back side text...");
  const textCanvas = document.createElement("canvas");
  textCanvas.width = orientedCanvas.width;
  textCanvas.height = Math.floor(orientedCanvas.height * 0.45);
  textCanvas
    .getContext("2d")!
    .drawImage(
      orientedCanvas,
      0,
      Math.floor(orientedCanvas.height * 0.55),
      orientedCanvas.width,
      textCanvas.height,
      0,
      0,
      textCanvas.width,
      textCanvas.height,
    );
  preprocessForOCR(textCanvas);

  const textResult = await worker.recognize(textCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
  });
  const backText = textResult.data.text;
  console.log("=== Back side OCR (after auto-orient) ===\n", backText);

  // FIN number area (right side)
  const finCanvas = document.createElement("canvas");
  finCanvas.width = Math.floor(orientedCanvas.width * 0.5);
  finCanvas.height = Math.floor(orientedCanvas.height * 0.12);
  finCanvas
    .getContext("2d")!
    .drawImage(
      orientedCanvas,
      Math.floor(orientedCanvas.width * 0.5),
      Math.floor(orientedCanvas.height * 0.55),
      finCanvas.width,
      finCanvas.height,
      0,
      0,
      finCanvas.width,
      finCanvas.height,
    );
  preprocessForOCR(finCanvas);

  const finResult = await worker.recognize(finCanvas.toDataURL("image/png"), {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  });
  const finText = finResult.data.text;
  console.log("=== Back side FIN OCR ===\n", finText);

  const finDigits = finText.replace(/[^\d\s]/g, " ").trim();
  const finMatch = finDigits.match(/\d[\d\s]{10,}/);
  if (finMatch) {
    result.fin_number = finMatch[0].replace(/\s+/g, " ").trim();
  }

  const lines = backText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    const phoneRegex = /(?:\+251|251|09|07)\d{8,9}/;

    if (
      (lineLower.includes("phone") || line.includes("ስልክ")) &&
      !result.phone_number
    ) {
      const cleanedLine = line.replace(/\s/g, "");
      const phoneMatch = cleanedLine.match(phoneRegex);
      if (phoneMatch) {
        result.phone_number = phoneMatch[0];
      } else if (i + 1 < lines.length) {
        const nextClean = lines[i + 1].replace(/\s/g, "");
        const nextMatch = nextClean.match(phoneRegex);
        if (nextMatch) result.phone_number = nextMatch[0];
      }
      continue;
    }

    const standaloneMatch = line.replace(/\s/g, "").match(phoneRegex);
    if (standaloneMatch && !result.phone_number) {
      result.phone_number = standaloneMatch[0];
      continue;
    }

    // FIN number
    if (
      (lineLower.includes("fin") ||
        line.includes("ልዩ ቁጥር") ||
        line.includes("ፊን")) &&
      !result.fin_number
    ) {
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
    if (
      (lineLower.includes("nationality") || line.includes("ዜግነት")) &&
      !result.nationality
    ) {
      if (lineLower.includes("ethiopian") || line.includes("ኢትዮጵያ")) {
        result.nationality = "Ethiopian";
        result.nationality_amharic = "ኢትዮጵያ";
      } else if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (
          next.toLowerCase().includes("ethiopian") ||
          next.includes("ኢትዮጵያ")
        ) {
          result.nationality = "Ethiopian";
          result.nationality_amharic = "ኢትዮጵያ";
        }
      }
      continue;
    }

    if (
      (lineLower.includes("ethiopian") || line.includes("ኢትዮጵያ")) &&
      !result.nationality
    ) {
      result.nationality = "Ethiopian";
      result.nationality_amharic = "ኢትዮጵያዊ";
      continue;
    }

    // Address
    if (
      (lineLower.includes("address") || line.includes("አድራሻ")) &&
      !result.address.region
    ) {
      const addressLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        const addrLine = lines[j];
        if (
          addrLine.toLowerCase().includes("fin") ||
          addrLine.includes("ፊን") ||
          addrLine.toLowerCase().includes("phone") ||
          addrLine.includes("ስልክ")
        )
          break;
        if (addrLine.length > 1) addressLines.push(addrLine);
      }

      const englishLines = addressLines.filter(
        (l) => /^[A-Za-z0-9\s.,'\-\/]+$/.test(l) && l.length > 1,
      );
      const amharicLines = addressLines.filter((l) =>
        /[\u1200-\u137F]/.test(l),
      );

      if (englishLines.length >= 1) result.address.region = englishLines[0];
      if (englishLines.length >= 2) result.address.zone = englishLines[1];
      if (englishLines.length >= 3) result.address.woreda = englishLines[2];

      if (amharicLines.length >= 1)
        result.address.region_amharic = amharicLines[0];
      if (amharicLines.length >= 2)
        result.address.zone_amharic = amharicLines[1];
      if (amharicLines.length >= 3)
        result.address.woreda_amharic = amharicLines[2];

      continue;
    }
  }

  await worker.terminate();
}

export async function extractColorID(
  imageFile: File,
  result: ExtractedData,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(imageFile);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });

  onProgress?.(95, "Extracting color profile...");
  // Note: Color extraction doesn't need OCR or orientation
  result.profile_image_color = extractRegionFromCanvas(
    // For color we use original image (no need for oriented)
    (() => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c;
    })(),
    0.26,
    0.19,
    0.48,
    0.29,
  );
}

export async function extractIDData(
  frontFile: File,
  backFile: File | null,
  colorFile: File | null,
  onProgress?: (progress: number, status: string) => void,
): Promise<ExtractedData> {
  const result = createEmptyResult();

  await extractFrontSide(frontFile, result, onProgress);
  onProgress?.(68, "Front side complete.");

  if (backFile) {
    await extractBackSide(backFile, result, onProgress);
  }

  if (colorFile) {
    await extractColorID(colorFile, result, onProgress);
  }

  onProgress?.(100, "ID extraction completed!");
  return result;
}
