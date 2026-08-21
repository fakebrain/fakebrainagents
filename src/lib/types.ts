export type AgentId =
  | "orchestrator"
  | "ingestion"
  | "parser"
  | "analytics"
  | "validator"
  | "reporter";

export interface AgentDef {
  id: AgentId;
  name: string;
  short: string;
  role: string;
  color: string;
  action: string;
  desc: string;
  input: string;
  output: string;
}

export const AGENTS: Record<AgentId, AgentDef> = {
  orchestrator: {
    id: "orchestrator",
    name: "Оркестратор",
    short: "ORC",
    role: "планирование задач",
    color: "#ffb454",
    action: "распределяет задачи",
    desc: "Принимает файлы, строит очередь, распределяет задачи между агентами и следит за выполнением конвейера от начала до конца.",
    input: "очередь файлов",
    output: "план выполнения",
  },
  ingestion: {
    id: "ingestion",
    name: "Агент приёма",
    short: "ING",
    role: "приём и контроль",
    color: "#56c8ff",
    action: "читает байты, проверяет кодировку",
    desc: "Читает байты, проверяет целостность и кодировку, отсекает бинарные файлы, определяет формат и передаёт текст дальше по конвейеру.",
    input: "raw-байты",
    output: "нормализованный текст",
  },
  parser: {
    id: "parser",
    name: "Агент парсинга",
    short: "PRS",
    role: "разбор структуры",
    color: "#2fd8c3",
    action: "разбирает структуру",
    desc: "Разбирает CSV (с кавычками и разделителями), JSON и сплошной текст в структурированное представление, сообщает об ошибках синтаксиса.",
    input: "нормализованный текст",
    output: "структура данных",
  },
  analytics: {
    id: "analytics",
    name: "Аналитический агент",
    short: "ANA",
    role: "статистика и аномалии",
    color: "#ff7a6b",
    action: "считает статистику",
    desc: "Инферирует типы колонок, считает статистику, ищет пропуски, дубликаты и выбросы по z-оценке, собирает ключевые слова и метрики текста.",
    input: "структура данных",
    output: "метрики и аномалии",
  },
  validator: {
    id: "validator",
    name: "Агент валидации",
    short: "VAL",
    role: "качество данных",
    color: "#a9e35f",
    action: "проверяет качество",
    desc: "Сверяет результаты аналитики с правилами качества: допуски по пропускам, дубликатам и выбросам. Формирует список проблем и интегральную оценку.",
    input: "метрики",
    output: "оценка качества",
  },
  reporter: {
    id: "reporter",
    name: "Агент отчётов",
    short: "REP",
    role: "итоговые файлы",
    color: "#c997f0",
    action: "собирает отчёты",
    desc: "Упаковывает результаты: машиночитаемый analysis.json, человекочитаемый report.md и размеченный исходный файл с флагами по каждой строке.",
    input: "оценка качества",
    output: "3 файла на выходе",
  },
};

export const PIPE_AGENTS: AgentId[] = [
  "ingestion",
  "parser",
  "analytics",
  "validator",
  "reporter",
];

export const AGENT_LIST: AgentDef[] = [
  AGENTS.orchestrator,
  AGENTS.ingestion,
  AGENTS.parser,
  AGENTS.analytics,
  AGENTS.validator,
  AGENTS.reporter,
];

export type FileKind = "csv" | "json" | "txt" | "binary";

export type StageState = "pending" | "active" | "done" | "error" | "skipped";

export interface Issue {
  id: string;
  fileId: string;
  fileName: string;
  severity: "warn" | "error";
  agent: AgentId;
  text: string;
}

export interface LogLine {
  id: number;
  t: string;
  agent: AgentId;
  text: string;
  level: "info" | "ok" | "warn" | "error";
}

export interface OutputFile {
  name: string;
  mime: string;
  content: string;
  size: number;
}

export interface MaaFile {
  id: string;
  name: string;
  size: number;
  kind: FileKind;
  raw: string;
  status: "queued" | "processing" | "done" | "error";
  stageIdx: number;
  stages: StageState[];
  analysis: AnyAnalysis | null;
  issues: Issue[];
  outputs: OutputFile[];
  error?: string;
  ms?: number;
}

export type AnyAnalysis = CsvAnalysis | JsonAnalysis | TxtAnalysis;

export interface ColumnStats {
  name: string;
  type: "число" | "дата" | "булево" | "строка";
  missing: number;
  missingPct: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  top?: { value: string; count: number }[];
}

export interface CsvAnalysis {
  kind: "csv";
  delimiter: string;
  rows: number;
  cols: number;
  columns: ColumnStats[];
  duplicates: number;
  anomalies: { row: number; column: string; value: string }[];
  totalMissing: number;
  missingPct: number;
  quality: number;
  preview: string[][];
}

export interface JsonAnalysis {
  kind: "json";
  rootType: string;
  depth: number;
  totalNodes: number;
  counts: Record<string, number>;
  topKeys: { key: string; count: number }[];
  schema: { key: string; type: string; note: string }[];
  arrayLen: number | null;
  schemaSource: string | null;
  missing: { key: string; missing: number; total: number }[];
  quality: number;
  preview: string;
}

export interface TxtAnalysis {
  kind: "txt";
  chars: number;
  charsNoSpaces: number;
  words: number;
  uniqueWords: number;
  lines: number;
  sentences: number;
  avgWordLen: number;
  avgSentenceLen: number;
  readingMin: number;
  keywords: { word: string; count: number }[];
  quality: number;
  excerpt: string;
}

export const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / 1024 / 1024).toFixed(2)} МБ`;
};

export const fmtNum = (n: number): string =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);

export const cls = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(" ");

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

export const KIND_META: Record<
  Exclude<FileKind, "binary">,
  { label: string; color: string }
> = {
  csv: { label: "CSV", color: "#2fd8c3" },
  json: { label: "JSON", color: "#ffb454" },
  txt: { label: "TXT", color: "#56c8ff" },
};
