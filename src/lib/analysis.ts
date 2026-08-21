import {
  AnyAnalysis,
  ColumnStats,
  CsvAnalysis,
  FileKind,
  Issue,
  JsonAnalysis,
  MaaFile,
  OutputFile,
  TxtAnalysis,
  fmtNum,
  uid,
} from "./types";

/* ------------------------------------------------ detect */

const TEXT_EXT = ["csv", "tsv", "json", "txt", "md", "log"];

const BINARY_EXT: Record<string, FileKind> = {
  doc: "doc",
  docx: "docx",
  xls: "xls",
  xlsx: "xlsx",
  pdf: "pdf",
};

export function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-zа-яё0-9]+)$/);
  return m ? m[1] : "";
}

export function detectKind(name: string, raw: string, hasBuffer = false): FileKind {
  const ext = extOf(name);
  if (ext in BINARY_EXT) return BINARY_EXT[ext];
  if (raw.includes("\u0000")) return "binary";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "json") return "json";
  if (ext === "txt" || ext === "md" || ext === "log") return "txt";
  const t = raw.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  if ((firstLine.match(/[,;\t]/g) ?? []).length >= 2) return "csv";
  if (ext && !TEXT_EXT.includes(ext)) return "binary";
  if (hasBuffer) return "binary";
  return "txt";
}

/* ------------------------------------------------ csv */

function detectDelimiter(line: string): string {
  let inQ = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ",";
}

function splitCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const MISSING_TOKENS = ["", "-", "—", "null", "n/a", "na", "nan", "нет данных", "none"];

const isMissing = (v: string) => MISSING_TOKENS.includes(v.trim().toLowerCase());

function toNum(v: string, delim: string): number | null {
  let s = v.trim().replace(/[\s\u00A0]/g, "");
  if (s === "" || MISSING_TOKENS.includes(s.toLowerCase())) return null;
  if (delim === ";") s = s.replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isBool = (v: string) =>
  /^(true|false|да|нет|yes|no|0|1)$/i.test(v.trim());

const isDate = (v: string) =>
  /^(\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?|\d{1,2}\.\d{1,2}\.\d{4})$/.test(
    v.trim()
  );

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdDev(nums: number[], mean: number): number {
  if (nums.length < 2) return 0;
  const v = nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export function parseCsvText(raw: string): { rows: string[][]; delimiter: string } {
  const delimiter = detectDelimiter(raw.split(/\r?\n/, 1)[0] ?? ",");
  return { rows: splitCsv(raw, delimiter), delimiter };
}

export function analyzeCsv(raw: string): CsvAnalysis {
  const { rows, delimiter } = parseCsvText(raw);
  return analyzeGrid(rows, { delimiter, numDelim: delimiter });
}

export function analyzeGrid(
  rows: string[][],
  opts: { delimiter?: string; numDelim?: string; sheet?: string } = {}
): CsvAnalysis {
  if (rows.length < 2) throw new Error("Таблица пуста или не содержит строк данных");
  const delimiter = opts.delimiter ?? detectDelimiter(rows[0].join(","));
  const delim = opts.numDelim ?? delimiter;
  const header = rows[0].map((h, i) => h.trim() || `колонка_${i + 1}`);
  const body = rows.slice(1);
  const cols = header.length;

  const columns: ColumnStats[] = header.map((name, ci) => {
    const values = body.map((r) => (ci < r.length ? r[ci] : ""));
    const present = values.filter((v) => !isMissing(v));
    const missing = values.length - present.length;

    const nums = present.map((v) => toNum(v, delim)).filter((n): n is number => n !== null);
    let type: ColumnStats["type"] = "строка";
    if (present.length > 0) {
      if (nums.length === present.length) type = "число";
      else if (present.every(isBool)) type = "булево";
      else if (present.every(isDate)) type = "дата";
    }

    const freq = new Map<string, number>();
    present.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));

    const stat: ColumnStats = {
      name,
      type,
      missing,
      missingPct: values.length ? (missing / values.length) * 100 : 0,
      unique: freq.size,
    };

    if (type === "число" && nums.length) {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      stat.min = Math.min(...nums);
      stat.max = Math.max(...nums);
      stat.mean = mean;
      stat.median = median(nums);
      stat.std = stdDev(nums, mean);
    } else if (type === "строка" || type === "булево") {
      stat.top = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([value, count]) => ({ value: value.slice(0, 18), count }));
    }
    return stat;
  });

  /* duplicates */
  const seen = new Set<string>();
  const dupRowIdx = new Set<number>();
  body.forEach((r, i) => {
    const key = r.map((c) => c.trim().toLowerCase()).join("\u0001");
    if (seen.has(key)) dupRowIdx.add(i);
    else seen.add(key);
  });

  /* anomalies (z-score) */
  const anomalies: CsvAnalysis["anomalies"] = [];
  columns.forEach((col, ci) => {
    if (col.type !== "число" || col.std === undefined || col.std === 0 || col.mean === undefined) return;
    body.forEach((r, ri) => {
      if (ci >= r.length || isMissing(r[ci])) return;
      const n = toNum(r[ci], delim);
      if (n === null) return;
      const z = Math.abs((n - (col.mean as number)) / (col.std as number));
      if (z > 3 && anomalies.length < 14)
        anomalies.push({ row: ri + 2, column: col.name, value: r[ci].trim() });
    });
  });

  const totalMissing = columns.reduce((a, c) => a + c.missing, 0);
  const cells = body.length * cols;
  const missingPct = cells ? (totalMissing / cells) * 100 : 0;
  const dupPct = body.length ? (dupRowIdx.size / body.length) * 100 : 0;
  const mixedCols = columns.filter((c) => c.type === "строка" && c.unique > body.length * 0.9 && body.length > 8).length;

  const quality = Math.round(
    Math.max(
      8,
      Math.min(
        100,
        100 -
          Math.min(35, missingPct * 1.4) -
          Math.min(15, dupPct * 1.2) -
          Math.min(20, anomalies.length * 4) -
          Math.min(10, mixedCols * 3)
      )
    )
  );

  return {
    kind: "csv",
    delimiter,
    rows: body.length,
    cols,
    columns,
    duplicates: dupRowIdx.size,
    anomalies,
    totalMissing,
    missingPct,
    quality,
    preview: rows.slice(0, 9),
    sheet: opts.sheet,
  };
}

/* ------------------------------------------------ json */

export function analyzeJson(raw: string): JsonAnalysis {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "некорректный синтаксис";
    throw new Error(`Ошибка JSON: ${msg}`);
  }

  const counts: Record<string, number> = {
    object: 0, array: 0, string: 0, number: 0, boolean: 0, null: 0,
  };
  const keyFreq = new Map<string, number>();
  let depth = 0;
  let totalNodes = 0;

  const walk = (v: unknown, d: number) => {
    if (totalNodes > 60000) return;
    totalNodes++;
    depth = Math.max(depth, d);
    if (v === null) { counts.null++; return; }
    if (Array.isArray(v)) {
      counts.array++;
      v.forEach((x) => walk(x, d + 1));
      return;
    }
    const t = typeof v;
    if (t === "object") {
      counts.object++;
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        keyFreq.set(k, (keyFreq.get(k) ?? 0) + 1);
        walk(val, d + 1);
      }
    } else if (t === "string") counts.string++;
    else if (t === "number") counts.number++;
    else if (t === "boolean") counts.boolean++;
  };
  walk(data, 1);

  const rootType = Array.isArray(data)
    ? "массив"
    : data === null
    ? "null"
    : typeof data === "object"
    ? "объект"
    : typeof data;

  const topKeys = [...keyFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key, count]) => ({ key, count }));

  /* schema + missing for object / array-of-objects (incl. nested arrays) */
  const schema: JsonAnalysis["schema"] = [];
  const missing: JsonAnalysis["missing"] = [];
  let arrayLen = Array.isArray(data) ? data.length : null;
  let schemaSource: string | null = null;
  let items: Record<string, unknown>[] | null = null;

  const isObj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);

  const typeOf = (v: unknown): string =>
    v === null ? "null" : Array.isArray(v) ? `массив[${v.length}]` : typeof v === "object" ? "объект" : typeof v === "string" ? "строка" : typeof v === "number" ? "число" : typeof v === "boolean" ? "булево" : typeof v;

  if (Array.isArray(data) && data.length && data.slice(0, 50).every(isObj)) {
    items = data as Record<string, unknown>[];
  } else if (isObj(data)) {
    let found: { key: string; arr: Record<string, unknown>[] } | null = null;
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length >= 2 && v.slice(0, 50).every(isObj)) {
        const arr = v as Record<string, unknown>[];
        if (!found || arr.length > found.arr.length) found = { key: k, arr };
      }
    }
    if (found) {
      items = found.arr;
      schemaSource = found.key;
      arrayLen = found.arr.length;
    } else {
      for (const [k, v] of Object.entries(data)) {
        schema.push({ key: k, type: typeOf(v), note: "" });
      }
    }
  }

  if (items) {
    const sample = items.slice(0, 200);
    const keys = new Map<string, { types: Set<string>; n: number }>();
    sample.forEach((obj) =>
      Object.entries(obj).forEach(([k, v]) => {
        const e = keys.get(k) ?? { types: new Set<string>(), n: 0 };
        e.types.add(v === null ? "null" : typeOf(v));
        e.n++;
        keys.set(k, e);
      })
    );
    for (const [k, e] of keys) {
      const miss = sample.filter((o) => !(k in o) || o[k] === null).length;
      schema.push({
        key: k,
        type: [...e.types].filter((t) => t !== "null").join(" | ") || "null",
        note: `${Math.round(((sample.length - miss) / sample.length) * 100)}%`,
      });
      if (miss > 0) missing.push({ key: k, missing: miss, total: sample.length });
    }
  }

  const missCells = missing.reduce((a, m) => a + m.missing, 0);
  const totalCells = schema.length * (arrayLen ?? (schema.length || 1));
  const missPct = totalCells ? (missCells / totalCells) * 100 : 0;
  const nullPct = totalNodes ? (counts.null / totalNodes) * 100 : 0;

  const quality = Math.round(
    Math.max(
      10,
      Math.min(
        100,
        100 - Math.min(30, missPct * 1.6) - Math.min(12, nullPct * 0.8) - (depth > 9 ? 8 : 0)
      )
    )
  );

  const preview = JSON.stringify(data, null, 2).slice(0, 1400);

  return {
    kind: "json", rootType, depth, totalNodes, counts, topKeys, schema, arrayLen, schemaSource, missing, quality, preview,
  };
}

/* ------------------------------------------------ txt */

const STOP = new Set(
  (
    "и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой ним этом мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это ее был при она они их the a an of to and in is it for on with as at by be or are was were from that this which but not you your"
  ).split(/\s+/)
);

export function analyzeTxt(raw: string, sourceNote?: string): TxtAnalysis {
  const text = raw.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  const words = (text.toLowerCase().match(/[a-zа-яё0-9]+(?:[-'][a-zа-яё0-9]+)*/g) ?? []);
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;

  const freq = new Map<string, number>();
  words.forEach((w) => {
    if (w.length < 3 || STOP.has(w)) return;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  });
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  const matched = text.match(/[^.!?…]+[.!?…]+/g);
  const sentences = (matched ? matched.length : nonEmpty.length) || 1;
  const uniqueWords = new Set(words).size;
  const avgWordLen = words.length
    ? words.reduce((a, w) => a + w.length, 0) / words.length
    : 0;
  const avgSentenceLen = words.length / sentences;
  const readingMin = Math.max(1, Math.round(words.length / 180));

  const uniqueRatio = words.length ? uniqueWords / words.length : 0;
  const quality = Math.round(
    Math.max(
      20,
      Math.min(
        100,
        96 -
          (uniqueRatio < 0.3 ? 18 : uniqueRatio < 0.45 ? 8 : 0) -
          (avgSentenceLen > 30 ? 12 : avgSentenceLen > 24 ? 6 : 0) -
          (words.length < 40 ? 15 : 0)
      )
    )
  );

  return {
    kind: "txt",
    chars,
    charsNoSpaces,
    words: words.length,
    uniqueWords,
    lines: nonEmpty.length,
    sentences,
    avgWordLen,
    avgSentenceLen,
    readingMin,
    keywords,
    quality,
    excerpt: text.slice(0, 700),
    sourceNote,
  };
}

export function runAnalysis(kind: FileKind, raw: string): AnyAnalysis {
  if (kind === "csv") return analyzeCsv(raw);
  if (kind === "json") return analyzeJson(raw);
  if (kind === "txt") return analyzeTxt(raw);
  throw new Error("Формат обрабатывается отдельным экстрактором конвейера");
}

/* ------------------------------------------------ issues */

export function buildIssues(file: MaaFile, a: AnyAnalysis): Issue[] {
  const out: Issue[] = [];
  const push = (severity: Issue["severity"], text: string, agent: Issue["agent"] = "validator") =>
    out.push({ id: uid(), fileId: file.id, fileName: file.name, severity, text, agent });

  if (a.kind === "csv") {
    a.columns.forEach((c) => {
      if (c.missingPct >= 2)
        push("warn", `Пропуски в колонке «${c.name}»: ${c.missing} (${fmtNum(c.missingPct)}%)`);
    });
    if (a.duplicates > 0) push("warn", `Найдено полных дубликатов строк: ${a.duplicates}`);
    a.anomalies.slice(0, 5).forEach((an) =>
      push("warn", `Выброс в строке ${an.row}: «${an.column}» = ${an.value}`)
    );
    if (a.rows < 5) push("warn", `Мало данных для устойчивой статистики: ${a.rows} строк`);
  } else if (a.kind === "json") {
    a.missing.slice(0, 5).forEach((m) =>
      push("warn", `Ключ «${m.key}» отсутствует в ${m.missing} из ${m.total} элементов`)
    );
    if (a.counts.null > 0) push("warn", `Null-значений в документе: ${a.counts.null}`);
    if (a.depth > 9) push("warn", `Глубокая вложенность: ${a.depth} уровней`);
  } else {
    if (a.words < 40) push("warn", `Короткий текст: ${a.words} слов — метрики могут быть нестабильны`);
    if (a.avgSentenceLen > 24) push("warn", `Длинные предложения в среднем: ${fmtNum(a.avgSentenceLen)} слов`);
    if (a.uniqueWords / Math.max(1, a.words) < 0.3) push("warn", "Низкое лексическое разнообразие (много повторов)");
  }

  /* форматные предупреждения */
  if (file.meta?.legacy)
    push("warn", "Legacy-формат DOC: текст извлечён эвристически — возможна неполнота");
  if (
    file.kind === "pdf" &&
    file.meta?.pages &&
    a.kind === "txt" &&
    a.chars / file.meta.pages < 250
  )
    push(
      "warn",
      `Низкая плотность текста: ~${Math.round(a.chars / file.meta.pages)} симв./стр. — возможен скан без текстового слоя`
    );
  if ((file.kind === "xlsx" || file.kind === "xls") && a.kind === "csv")
    push("warn", `Проанализирован только первый лист книги: «${file.meta?.sheet ?? "—"}»`);
  return out;
}

/* ------------------------------------------------ outputs */

const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || name;

const escCsv = (v: string, delim: string) =>
  v.includes(delim) || v.includes('"') || v.includes("\n")
    ? `"${v.replace(/"/g, '""')}"`
    : v;

function enrichedCsv(rows: string[][], a: CsvAnalysis): string {
  const flagsByRow = new Map<number, string[]>();
  a.anomalies.forEach((an) => {
    const list = flagsByRow.get(an.row) ?? [];
    list.push(`аномалия: ${an.column}=${an.value}`);
    flagsByRow.set(an.row, list);
  });
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const key = r.map((c) => c.trim().toLowerCase()).join("\u0001");
    if (seen.has(key)) {
      const list = flagsByRow.get(i + 2) ?? [];
      list.push("дубликат строки");
      flagsByRow.set(i + 2, list);
    } else seen.add(key);
  });
  a.columns.forEach((c, ci) => {
    if (c.missing === 0) return;
    rows.slice(1).forEach((r, i) => {
      const v = ci < r.length ? r[ci] : "";
      if (isMissing(v)) {
        const list = flagsByRow.get(i + 2) ?? [];
        list.push(`пропуск: ${c.name}`);
        flagsByRow.set(i + 2, list);
      }
    });
  });
  const out = [
    [...rows[0], "MAA_флаги"].map((h) => escCsv(h, a.delimiter)).join(a.delimiter),
  ];
  rows.slice(1).forEach((r, i) => {
    const flags = (flagsByRow.get(i + 2) ?? []).join(" | ");
    out.push([...r, flags].map((c) => escCsv(c, a.delimiter)).join(a.delimiter));
  });
  return out.join("\n");
}

function enrichedJson(raw: string, a: JsonAnalysis): string {
  let data: unknown = null;
  try { data = JSON.parse(raw); } catch { /* unreachable */ }
  const meta = {
    _maa_meta: {
      generator: "Multi-Agent Analyzer v1.4",
      rootType: a.rootType,
      depth: a.depth,
      nodes: a.totalNodes,
      quality: a.quality,
      missingKeys: a.missing,
    },
  };
  const isObj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  const missMap = new Map(a.missing.map((m) => [m.key, m]));
  const flagItems = (arr: Record<string, unknown>[]) =>
    arr.map((obj) => {
      const miss = [...missMap.keys()].filter((k) => !(k in obj) || obj[k] === null);
      return miss.length ? { ...obj, _maa_flags: miss.map((k) => `отсутствует: ${k}`) } : obj;
    });

  if (Array.isArray(data) && data.every(isObj)) {
    return JSON.stringify({ ...meta, data: flagItems(data as Record<string, unknown>[]) }, null, 2);
  }
  if (isObj(data)) {
    let foundKey: string | null = null;
    let foundArr: Record<string, unknown>[] | null = null;
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length >= 2 && v.slice(0, 50).every(isObj)) {
        const arr = v as Record<string, unknown>[];
        if (!foundArr || arr.length > foundArr.length) {
          foundArr = arr;
          foundKey = k;
        }
      }
    }
    if (foundKey && foundArr) {
      return JSON.stringify(
        { ...meta, data: { ...data, [foundKey]: flagItems(foundArr) } },
        null,
        2
      );
    }
  }
  return JSON.stringify({ ...meta, data }, null, 2);
}

function enrichedTxt(raw: string, a: TxtAnalysis): string {
  const head = [
    "/* ====================================================",
    "   MAA · РАЗМЕТКА АНАЛИЗА (агент отчётов)",
    `   слов: ${a.words} · уникальных: ${a.uniqueWords} · предложений: ${a.sentences}`,
    `   чтение: ~${a.readingMin} мин · качество: ${a.quality}/100`,
    `   ключевые слова: ${a.keywords.slice(0, 8).map((k) => k.word).join(", ")}`,
    "   ==================================================== */",
    "",
  ].join("\n");
  return head + raw;
}

export function buildReport(name: string, a: AnyAnalysis, issues: Issue[]): string {
  const date = new Date().toLocaleString("ru-RU");
  const L: string[] = [];
  L.push(`# Отчёт анализа — ${name}`);
  L.push("");
  L.push(`> Сгенерировано: ${date}  `);
  L.push("> Система: Multi-Agent Analyzer v1.4 · 6 агентов · конвейер: приём → парсинг → аналитика → валидация → отчёт");
  L.push("");
  L.push(`## Интегральная оценка качества: ${a.quality}/100`);
  L.push("");

  if (a.kind === "csv") {
    L.push("## Датасет");
    if (a.sheet) L.push(`- Источник: книга Excel, лист **${a.sheet}**`);
    L.push(`- Строк: **${a.rows}**, колонок: **${a.cols}**, разделитель: \`${a.delimiter === "\t" ? "TAB" : a.delimiter}\``);
    L.push(`- Пропущено ячеек: ${a.totalMissing} (${fmtNum(a.missingPct)}%)`);
    L.push(`- Дубликаты строк: ${a.duplicates}`);
    L.push(`- Выбросы (|z| > 3): ${a.anomalies.length}`);
    L.push("");
    L.push("## Колонки");
    L.push("| Колонка | Тип | Пропуски | Уникальных | Min | Max | Среднее |");
    L.push("|---|---|---|---|---|---|---|");
    a.columns.forEach((c) =>
      L.push(
        `| ${c.name} | ${c.type} | ${c.missing} | ${c.unique} | ${c.min !== undefined ? fmtNum(c.min) : "—"} | ${c.max !== undefined ? fmtNum(c.max) : "—"} | ${c.mean !== undefined ? fmtNum(c.mean) : "—"} |`
      )
    );
    if (a.anomalies.length) {
      L.push("");
      L.push("## Выбросы");
      a.anomalies.slice(0, 10).forEach((an) =>
        L.push(`- строка ${an.row}: «${an.column}» = ${an.value}`)
      );
    }
  } else if (a.kind === "json") {
    L.push("## Структура документа");
    L.push(`- Корень: **${a.rootType}**${a.rootType === "массив" && a.arrayLen !== null ? ` (${a.arrayLen} элементов)` : ""}`);
    if (a.schemaSource && a.arrayLen !== null)
      L.push(`- Массив «${a.schemaSource}»: ${a.arrayLen} элементов`);
    L.push(`- Глубина вложенности: ${a.depth}, узлов всего: ${a.totalNodes}`);
    L.push(`- Типы узлов: ${Object.entries(a.counts).filter(([, v]) => v > 0).map(([k, v]) => `${k} — ${v}`).join(", ")}`);
    if (a.schema.length) {
      L.push("");
      L.push(a.schemaSource ? `## Схема элемента (${a.schemaSource}[i])` : "## Схема");
      L.push("| Ключ | Тип | Покрытие |");
      L.push("|---|---|---|");
      a.schema.forEach((s) => L.push(`| ${s.key} | ${s.type} | ${s.note || "—"} |`));
    }
    if (a.missing.length) {
      L.push("");
      L.push("## Отсутствующие ключи");
      a.missing.forEach((m) => L.push(`- «${m.key}»: нет в ${m.missing} из ${m.total}`));
    }
  } else {
    L.push("## Текст");
    if (a.sourceNote) L.push(`- Источник: ${a.sourceNote}`);
    L.push(`- Слов: **${a.words}** (уникальных: ${a.uniqueWords}), символов: ${a.chars}`);
    L.push(`- Предложений: ${a.sentences}, строк: ${a.lines}`);
    L.push(`- Средняя длина слова: ${fmtNum(a.avgWordLen)}, предложения: ${fmtNum(a.avgSentenceLen)} слов`);
    L.push(`- Время чтения: ~${a.readingMin} мин`);
    if (a.keywords.length) {
      L.push("");
      L.push("## Ключевые слова");
      L.push(a.keywords.map((k) => `\`${k.word}\` ×${k.count}`).join(" · "));
    }
  }

  L.push("");
  L.push("## Проблемы качества");
  if (issues.length === 0) L.push("- Проблем не обнаружено ✓");
  else issues.forEach((i) => L.push(`- ⚠ ${i.text}`));
  L.push("");
  L.push("---");
  L.push("*Multi-Agent Analyzer · отчёт собран агентом REP без участия человека*");
  return L.join("\n");
}

export function makeOutputs(file: MaaFile, a: AnyAnalysis, issues: Issue[]): OutputFile[] {
  const base = baseName(file.name);
  const mk = (name: string, mime: string, content: string): OutputFile => ({
    name, mime, content, size: new Blob([content]).size,
  });

  const analysisJson = JSON.stringify(
    {
      file: file.name,
      generatedAt: new Date().toISOString(),
      system: "maa-vscode@1.4.0",
      quality: a.quality,
      issues: issues.map((i) => ({ severity: i.severity, text: i.text })),
      analysis: a,
    },
    null,
    2
  );

  const report = buildReport(file.name, a, issues);

  const gridRows = file.grid ?? parseCsvText(file.raw).rows;
  const enriched =
    a.kind === "csv"
      ? enrichedCsv(gridRows, a)
      : a.kind === "json"
      ? enrichedJson(file.raw, a)
      : enrichedTxt(file.text ?? file.raw, a);
  const enrichedExt = a.kind === "csv" ? "csv" : a.kind === "json" ? "json" : "txt";

  return [
    mk(`${base}.analysis.json`, "application/json", analysisJson),
    mk(`${base}.report.md`, "text/markdown", report),
    mk(`${base}.annotated.${enrichedExt}`, file.kind === "csv" ? "text/csv" : "text/plain", enriched),
  ];
}

export function downloadOutput(o: OutputFile): void {
  const blob = new Blob([o.content], { type: `${o.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = o.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
