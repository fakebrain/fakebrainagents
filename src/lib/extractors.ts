import type { FileKind } from "./types";

/* ============================================================
   Извлечение содержимого из бинарных контейнеров.
   Тяжёлые библиотеки (jszip, xlsx, pdfjs) подгружаются лениво —
   только когда в конвейер попадает файл соответствующего формата.
   ============================================================ */

export interface DocxResult { text: string; paragraphs: number }
export interface DocResult { text: string; runs: number }
export interface WorkbookResult { rows: string[][]; sheet: string }
export interface PdfResult { text: string; pages: number }

const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/* ---------------- сигнатуры контейнеров ---------------- */

export function checkSignature(kind: FileKind, buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf.slice(0, 8));
  const isZip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  const isCfb = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  const isPdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  if (kind === "docx" || kind === "xlsx") return isZip;
  if (kind === "pdf") return isPdf;
  if (kind === "doc" || kind === "xls") return isCfb;
  return true;
}

export const signatureName = (kind: FileKind): string =>
  kind === "docx" || kind === "xlsx"
    ? "ZIP/OOXML"
    : kind === "pdf"
    ? "%PDF"
    : kind === "doc" || kind === "xls"
    ? "CFB/D0CF11E0"
    : "—";

/* ---------------- DOCX (OOXML) ---------------- */

export async function extractDocx(buf: ArrayBuffer): Promise<DocxResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("word/document.xml не найден — контейнер повреждён");
  const xml = await docFile.async("string");
  const withBreaks = xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new Error("текстовый слой документа пуст");
  const paragraphs =
    (xml.match(/<w:p[ >]/g) ?? []).length || text.split(/\n+/).length;
  return { text, paragraphs };
}

/* ---------------- legacy DOC (эвристика) ---------------- */

export function extractDoc(buf: ArrayBuffer): DocResult {
  const bytes = new Uint8Array(buf);
  const runs: string[] = [];
  let cur = "";
  const flush = () => {
    const t = cur.trim();
    if (t.length >= 8) runs.push(t);
    cur = "";
  };
  /* UTF-16LE — основной поток текста в бинарном Word */
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const ok =
      (code >= 0x20 && code < 0xfff0 && code !== 0x7f) ||
      code === 0x0a ||
      code === 0x09;
    if (ok) cur += String.fromCharCode(code);
    else flush();
  }
  flush();
  let text = runs.join("\n");

  /* ASCII/ANSI-запасной проход, если UTF-16LE дал мало */
  if (text.replace(/\s/g, "").length < 160) {
    cur = "";
    const ascii: string[] = [];
    const flushA = () => {
      const t = cur.trim();
      if (t.length >= 8) ascii.push(t);
      cur = "";
    };
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 0x20 && b < 0x7f) || b === 0x0a || b === 0x09 || b >= 0xc0)
        cur += String.fromCharCode(b);
      else flushA();
    }
    flushA();
    if (ascii.join("").length > text.replace(/\s/g, "").length)
      text = ascii.join("\n");
  }

  const lines = text.split("\n").filter((l) => /[a-zа-яё]{3,}/i.test(l));
  const clean = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 40)
    throw new Error("не удалось извлечь связный текст из legacy-контейнера");
  return { text: clean, runs: lines.length };
}

/* ---------------- Excel: XLSX / XLS ---------------- */

export async function readWorkbook(buf: ArrayBuffer): Promise<WorkbookResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false });
  if (!wb.SheetNames.length) throw new Error("в книге нет листов");
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`лист «${sheetName}» недоступен`);
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown as (string | number | null)[][];
  const clean = rows
    .map((r) => r.map((c) => (c == null ? "" : String(c))))
    .filter((r) => r.some((c) => c.trim() !== ""));
  if (clean.length < 2)
    throw new Error(`лист «${sheetName}» пуст или не содержит строк данных`);
  return { rows: clean, sheet: sheetName };
}

/* ---------------- PDF (pdf.js) ---------------- */

let pdfReady: Promise<void> | null = null;

async function ensurePdfJs(): Promise<typeof import("pdfjs-dist")> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfReady) {
    pdfReady = import("pdfjs-dist/build/pdf.worker.min.mjs?url").then((w) => {
      pdfjs.GlobalWorkerOptions.workerSrc = w.default;
    });
  }
  await pdfReady;
  return pdfjs;
}

export async function extractPdf(buf: ArrayBuffer): Promise<PdfResult> {
  const pdfjs = await ensurePdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = doc.numPages;
  const parts: string[] = [];
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => {
        if (!("str" in it)) return "";
        return it.str + (it.hasEOL ? "\n" : " ");
      })
      .join("");
    parts.push(line.trim());
    page.cleanup();
  }
  await doc.destroy();
  const text = parts.filter(Boolean).join("\n\n").trim();
  if (!text)
    throw new Error("текстовый слой не найден — вероятно, это скан-изображение");
  return { text, pages };
}

/* ---------------- демо-генераторы ---------------- */

const escXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function generateDemoDocx(): Promise<ArrayBuffer> {
  const JSZip = (await import("jszip")).default;
  const paras = [
    "Техническое задание: мультиагентная система анализа данных",
    "1. Общие положения. Система состоит из шести агентов: оркестратор, агент приёма, агент парсинга, аналитический агент, агент валидации и агент отчётов. Агенты обмениваются сообщениями через очередь задач и работают последовательно в рамках конвейера.",
    "2. Требования к конвейеру. Конвейер должен принимать файлы форматов CSV, JSON, TXT, DOCX, XLSX и PDF, извлекать структурированные данные, рассчитывать статистику и формировать отчёт о качестве. Пропуски, дубликаты и выбросы фиксируются в журнале проблем.",
    "3. Требования к аналитике. Для табличных данных рассчитываются минимальные и максимальные значения, среднее, медиана и стандартное отклонение по каждой колонке. Выбросы определяются по z-оценке с порогом три сигма.",
    "4. Требования к отчётности. По каждому файлу система формирует три выходных артефакта: машиночитаемый анализ в формате JSON, человекочитаемый отчёт в формате Markdown и размеченный исходный файл с флагами по каждой строке.",
    "5. Критерии приёмки. Интегральная оценка качества данных должна рассчитываться по единой шкале от нуля до ста. Время обработки одного файла не должно превышать пяти секунд при объёме до одного мегабайта.",
  ];
  const body = paras
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escXml(p)}</w:t></w:r></w:p>`)
    .join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

export async function generateDemoXlsx(): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    ["Дата", "Регион", "Менеджер", "Товар", "Кол-во", "Сумма", "Скидка %"],
    ["2024-11-01", "Москва", "Иванов", "Ноутбук X1", 2, 189990, 5],
    ["2024-11-01", "Казань", "Петрова", "Монитор 27", 4, 95960, ""],
    ["2024-11-02", "Москва", "Сидоров", "Клавиатура K2", 12, 47880, 10],
    ["2024-11-03", "Сочи", "Иванов", "Ноутбук X1", 1, 94995, 5],
    ["2024-11-03", "Казань", "Петрова", "Мышь M3", 20, 39800, ""],
    ["2024-11-04", "Москва", "Сидоров", "Монитор 27", 3, 71970, 7],
    ["2024-11-04", "Омск", "Кузнецов", "Ноутбук X1", 5, 474975, 12],
    ["2024-11-05", "Сочи", "Иванов", "Мышь M3", 8, 15920, ""],
    ["2024-11-05", "Москва", "Петрова", "Клавиатура K2", 6, 23940, 10],
    ["2024-11-06", "Казань", "Сидоров", "Монитор 27", 2, 47980, ""],
    ["2024-11-06", "Омск", "Кузнецов", "Ноутбук X1", 1, 94995, 5],
    ["2024-11-06", "Омск", "Кузнецов", "Ноутбук X1", 1, 94995, 5],
    ["2024-11-07", "Москва", "Иванов", "Мышь M3", 15, 29850, ""],
    ["2024-11-07", "Сочи", "Петрова", "Ноутбук X1", 3, 284985, 8],
    ["2024-11-08", "Казань", "Сидоров", "Клавиатура K2", 9, 35910, ""],
    ["2024-11-08", "Москва", "Кузнецов", "Монитор 27", 1, 23990, 5],
    ["2024-11-09", "Омск", "Иванов", "Ноутбук X1", 40, 8999999, 50],
    ["2024-11-09", "Сочи", "Петрова", "Мышь M3", 10, 19900, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Продажи");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
