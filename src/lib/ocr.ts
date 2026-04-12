import Tesseract, { PSM } from "tesseract.js";

/* =========================
   YOUR INTERFACE (UNCHANGED)
========================= */

export interface ExtractedData {
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

/* =========================
   GLOBAL WORKER (FIXED + FAST)
========================= */

let worker: Tesseract.Worker | null = null;

async function getWorker() {
  if (!worker) {
    worker = await Tesseract.createWorker("eng+amh", 1);

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
  }
  return worker;
}

/* =========================
   IMAGE HELPERS
========================= */

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

function extractRegionCanvas(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  const x = img.naturalWidth * xRatio;
  const y = img.naturalHeight * yRatio;
  const w = img.naturalWidth * wRatio;
  const h = img.naturalHeight * hRatio;

  canvas.width = w;
  canvas.height = h;

  canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);

  return canvas;
}

function extractRegion(
  img: HTMLImageElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number,
): string {
  return extractRegionCanvas(img, xRatio, yRatio, wRatio, hRatio).toDataURL(
    "image/png",
  );
}

/* =========================
   PREPROCESSING (STRONG)
========================= */

function preprocess(canvas: HTMLCanvasElement, strong = false) {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

    if (strong) {
      gray = gray > 140 ? 255 : 0;
    } else {
      gray = gray > 160 ? 255 : gray < 100 ? 0 : gray;
    }

    d[i] = d[i + 1] = d[i + 2] = gray;
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* =========================
   CLEAN TEXT
========================= */

function clean(text: string) {
  return text
    .replace(/[O]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/[^\w\s\/.\-አ-ፐ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   OCR ENGINE (MULTI PASS)
========================= */

async function runOCR(canvas: HTMLCanvasElement, type: "text" | "number") {
  const w = await getWorker();

  await w.setParameters(
    type === "number"
      ? { tessedit_char_whitelist: "0123456789/.-" }
      : {
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz አ-ፐ",
        },
  );

  let result = await w.recognize(preprocess(canvas, false));

  if (result.data.confidence > 85) {
    return clean(result.data.text);
  }

  result = await w.recognize(preprocess(canvas, true));

  return clean(result.data.text);
}

/* =========================
   HELPERS
========================= */

function findFAN(text: string): string {
  const cleaned = text.replace(/\D/g, "");
  const match = cleaned.match(/\d{12,16}/);
  return match ? match[0] : "";
}

function findAllDates(text: string): string[] {
  return text.match(/\d{2,4}[\/.\-]\d{2}[\/.\-]\d{2,4}/g) || [];
}

/* =========================
   FRONT SIDE (IMPROVED)
========================= */

export async function extractFrontSide(imageFile: File, result: ExtractedData) {
  const img = await loadImage(imageFile);

  // KEEP your original extractions
  result.profile_image = extractRegion(img, 0.31, 0.26, 0.359, 0.2);
  result.barcode_image = extractRegion(img, 0.318, 0.692, 0.32, 0.024);

  const mainCanvas = extractRegionCanvas(img, 0, 0.53, 0.82, 0.4);
  const verticalCanvas = extractRegionCanvas(img, 0.83, 0.05, 0.17, 0.9);

  const [mainText, verticalText] = await Promise.all([
    runOCR(mainCanvas, "text"),
    runOCR(verticalCanvas, "number"),
  ]);

  const lines = mainText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (
      /[\u1200-\u137F]/.test(line) &&
      !/\d/.test(line) &&
      !result.full_name_amharic
    ) {
      result.full_name_amharic = line;
      continue;
    }

    if (/^[A-Za-z\s.'-]+$/.test(line) && !result.full_name_english) {
      result.full_name_english = line;
      continue;
    }

    if (line.includes("ሴት") || line.toLowerCase().includes("female")) {
      result.sex = "Female";
      result.sex_amharic = "ሴት";
    }

    if (line.includes("ወንድ") || line.toLowerCase().includes("male")) {
      result.sex = "Male";
      result.sex_amharic = "ወንድ";
    }

    const dates = findAllDates(line);
    if (dates.length) {
      if (!result.date_of_birth_gregorian)
        result.date_of_birth_gregorian = dates[0];
      else if (!result.date_of_expiry_gregorian)
        result.date_of_expiry_gregorian = dates[0];
    }

    const fan = findFAN(line);
    if (fan && !result.fan_number) {
      result.fan_number = fan;
    }
  }

  const issueDates = findAllDates(verticalText);
  if (issueDates.length) {
    result.date_of_issue_gregorian = issueDates[0];
  }
}

/* =========================
   BACK SIDE (IMPROVED)
========================= */

export async function extractBackSide(imageFile: File, result: ExtractedData) {
  const img = await loadImage(imageFile);

  const textCanvas = extractRegionCanvas(img, 0, 0.58, 1.0, 0.42);
  const text = await runOCR(textCanvas, "text");

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const phoneMatch = line.replace(/\s/g, "").match(/(\+251|251|09|07)\d{8}/);

    if (phoneMatch && !result.phone_number) {
      result.phone_number = phoneMatch[0];
    }

    if (
      (line.toLowerCase().includes("ethiopian") || line.includes("ኢትዮጵያ")) &&
      !result.nationality
    ) {
      result.nationality = "Ethiopian";
      result.nationality_amharic = "ኢትዮጵያዊ";
    }

    const fin = findFAN(line);
    if (fin && !result.fin_number) {
      result.fin_number = fin;
    }
  }
}
