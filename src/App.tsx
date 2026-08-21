import { useEffect, useMemo, useRef, useState } from "react";
import { AgentUiState, Sidebar, StatusBar, Tab, TabStrip, TerminalPanel, TitleBar, ActivityBar } from "./components/Chrome";
import { ArchitectureSection, Footer, IntegrationSection, TopBar } from "./components/PageSections";
import { PipelineTab } from "./components/PipelineTab";
import { ResultTab } from "./components/ResultTab";
import { VSCodeTab } from "./components/VSCodeTab";
import {
  analyzeCsv,
  analyzeGrid,
  analyzeJson,
  analyzeTxt,
  buildIssues,
  detectKind,
  downloadOutput,
  makeOutputs,
  parseCsvText,
} from "./lib/analysis";
import {
  checkSignature,
  extractDoc,
  extractDocx,
  extractPdf,
  generateDemoDocx,
  generateDemoXlsx,
  readWorkbook,
  signatureName,
} from "./lib/extractors";
import { SAMPLES } from "./lib/samples";
import {
  AGENTS,
  AgentId,
  AnyAnalysis,
  Issue,
  LogLine,
  MaaFile,
  PIPE_AGENTS,
  StageState,
  fmtBytes,
  isBinaryKind,
  uid,
} from "./lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (n: number) => Math.random() * n;
const timeStr = () => new Date().toLocaleTimeString("ru-RU", { hour12: false });

export default function App() {
  /* ---------------- state ---------------- */
  const [files, setFiles] = useState<MaaFile[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [running, setRunning] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"explorer" | "agents">("explorer");
  const [termTab, setTermTab] = useState<"log" | "problems">("log");
  const [termOpen, setTermOpen] = useState(true);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>({ type: "pipeline" });

  const queueRef = useRef<MaaFile[]>([]);
  const runningRef = useRef(false);
  const logIdRef = useRef(0);
  const bootedRef = useRef(false);

  /* ---------------- helpers ---------------- */
  const log = (agent: AgentId, text: string, level: LogLine["level"] = "info") =>
    setLogs((p) => [
      ...p.slice(-380),
      { id: ++logIdRef.current, t: timeStr(), agent, text, level },
    ]);

  const patchFile = (id: string, patch: Partial<MaaFile>) =>
    setFiles((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const setStage = (id: string, idx: number, st: StageState) =>
    setFiles((p) =>
      p.map((f) => {
        if (f.id !== id) return f;
        const stages = [...f.stages];
        stages[idx] = st;
        return { ...f, stages, stageIdx: st === "active" ? idx : f.stageIdx };
      })
    );

  const pushIssue = (i: Issue) => setIssues((p) => [...p, i]);

  const openResult = (id: string) => {
    setOpenTabs((p) => (p.includes(id) ? p : [...p, id]));
    setActiveTab({ type: "result", fileId: id });
  };

  const closeTab = (id: string) => {
    setOpenTabs((p) => p.filter((x) => x !== id));
    setActiveTab((t) => (t.type === "result" && t.fileId === id ? { type: "pipeline" } : t));
  };

  /* ---------------- pipeline ---------------- */
  const failFile = (f: MaaFile, stageIdx: number, agent: AgentId, msg: string) => {
    setStage(f.id, stageIdx, "error");
    setFiles((p) =>
      p.map((x) => {
        if (x.id !== f.id) return x;
        const stages = [...x.stages];
        for (let i = stageIdx + 1; i < stages.length; i++) stages[i] = "skipped";
        return { ...x, stages, status: "error" as const, error: msg };
      })
    );
    pushIssue({ id: uid(), fileId: f.id, fileName: f.name, severity: "error", agent, text: msg });
    log(agent, `Сбой на «${f.name}»: ${msg}`, "error");
    log("orchestrator", `Задача «${f.name}» остановлена · этап: ${AGENTS[PIPE_AGENTS[stageIdx]].name}`, "warn");
  };

  const processFile = async (f: MaaFile): Promise<boolean> => {
    const started = performance.now();
    patchFile(f.id, { status: "processing", stageIdx: 0 });
    log("orchestrator", `Задача «${f.name}» передана конвейеру`);

    /* 1 · приём */
    setStage(f.id, 0, "active");
    log("ingestion", `Читаю ${f.name} · ${fmtBytes(f.size)}`);
    await sleep(430 + rnd(280));
    const kind = detectKind(f.name, f.raw, !!f.buffer);
    if (kind === "binary") {
      failFile(
        f,
        0,
        "ingestion",
        "неподдерживаемый формат — конвейер работает с CSV, JSON, TXT, DOC, DOCX, XLS, XLSX, PDF"
      );
      return false;
    }
    patchFile(f.id, { kind });
    if (isBinaryKind(kind)) {
      if (!f.buffer) {
        failFile(f, 0, "ingestion", "нет бинарных данных файла");
        return false;
      }
      if (!checkSignature(kind, f.buffer)) {
        failFile(f, 0, "ingestion", `сигнатура контейнера не соответствует расширению .${kind}`);
        return false;
      }
      log("ingestion", `Бинарный контейнер · сигнатура ${signatureName(kind)} подтверждена`, "ok");
    } else {
      log("ingestion", `Целостность ОК · кодировка UTF-8 · формат: ${kind.toUpperCase()}`, "ok");
    }
    setStage(f.id, 0, "done");

    /* 2 · парсинг */
    setStage(f.id, 1, "active");
    log("parser", `Разбор структуры (${kind.toUpperCase()})…`);
    await sleep(520 + rnd(320));
    let text = f.raw;
    let grid: string[][] | undefined;
    const meta: NonNullable<MaaFile["meta"]> = {};
    try {
      if (kind === "json") {
        JSON.parse(f.raw);
        log("parser", `Синтаксис корректен · ${fmtBytes(f.raw.length)}`, "ok");
      } else if (kind === "csv") {
        const { rows } = parseCsvText(f.raw);
        if (rows.length < 2) throw new Error("нет строк данных");
        log("parser", `Таблица распознана: ${rows.length - 1} строк`, "ok");
      } else if (kind === "xlsx" || kind === "xls") {
        const wb = await readWorkbook(f.buffer as ArrayBuffer);
        grid = wb.rows;
        meta.sheet = wb.sheet;
        log(
          "parser",
          `Книга Excel раскрыта: лист «${wb.sheet}» · ${wb.rows.length - 1} строк × ${wb.rows[0].length} колонок`,
          "ok"
        );
      } else if (kind === "docx") {
        const d = await extractDocx(f.buffer as ArrayBuffer);
        text = d.text;
        meta.paragraphs = d.paragraphs;
        log("parser", `OOXML-контейнер распакован: ${d.paragraphs} абзацев текста`, "ok");
      } else if (kind === "doc") {
        const d = extractDoc(f.buffer as ArrayBuffer);
        text = d.text;
        meta.legacy = true;
        log("parser", `Legacy-DOC: эвристическое извлечение · ${d.runs} фрагментов`, "warn");
      } else if (kind === "pdf") {
        const d = await extractPdf(f.buffer as ArrayBuffer);
        text = d.text;
        meta.pages = d.pages;
        log("parser", `PDF: текстовый слой снят · страниц: ${d.pages}`, "ok");
      } else {
        const words = (f.raw.match(/\S+/g) ?? []).length;
        log("parser", `Сплошной текст · ${words} слов`, "ok");
      }
    } catch (e) {
      failFile(f, 1, "parser", e instanceof Error ? e.message : "не удалось разобрать файл");
      return false;
    }
    patchFile(f.id, { text, grid, meta });
    setStage(f.id, 1, "done");

    /* 3 · аналитика */
    setStage(f.id, 2, "active");
    log("analytics", "Инференс типов и статистика…");
    await sleep(560 + rnd(380));
    log(
      "analytics",
      kind === "csv"
        ? "Поиск выбросов (z-оценка, порог 3σ)…"
        : kind === "json"
        ? "Рекурсивный обход дерева, частотность ключей…"
        : "Извлечение ключевых слов, метрики читабельности…"
    );
    await sleep(420 + rnd(260));
    let analysis: AnyAnalysis;
    try {
      if (grid) {
        analysis = analyzeGrid(grid, { delimiter: "Excel", numDelim: ",", sheet: meta.sheet });
      } else if (kind === "json") {
        analysis = analyzeJson(f.raw);
      } else if (kind === "csv") {
        analysis = analyzeCsv(f.raw);
      } else {
        const sourceNote =
          kind === "docx"
            ? `DOCX · ${meta.paragraphs ?? "—"} абз.`
            : kind === "doc"
            ? "DOC · legacy-извлечение"
            : kind === "pdf"
            ? `PDF · ${meta.pages ?? "—"} стр.`
            : undefined;
        analysis = analyzeTxt(text, sourceNote);
      }
    } catch (e) {
      failFile(f, 2, "analytics", e instanceof Error ? e.message : "ошибка вычисления метрик");
      return false;
    }
    log(
      "analytics",
      analysis.kind === "csv"
        ? `Готово: ${analysis.rows}×${analysis.cols} · пропусков ${analysis.totalMissing} · дубликатов ${analysis.duplicates} · выбросов ${analysis.anomalies.length}`
        : analysis.kind === "json"
        ? `Готово: ${analysis.totalNodes} узлов · глубина ${analysis.depth} · корень — ${analysis.rootType}`
        : `Готово: ${analysis.words} слов · ${analysis.sentences} предложений`,
      "ok"
    );
    patchFile(f.id, { analysis });
    setStage(f.id, 2, "done");

    /* 4 · валидация */
    setStage(f.id, 3, "active");
    log("validator", "Прогон правил качества…");
    await sleep(480 + rnd(300));
    const cur = { ...f, kind, analysis, text, grid, meta };
    const fileIssues = buildIssues(cur, analysis);
    fileIssues.slice(0, 6).forEach((i) => log("validator", i.text, "warn"));
    if (fileIssues.length === 0) log("validator", "Нарушений правил не найдено", "ok");
    log(
      "validator",
      `Интегральная оценка качества: ${analysis.quality}/100`,
      analysis.quality >= 80 ? "ok" : "warn"
    );
    setIssues((p) => [...p, ...fileIssues]);
    patchFile(f.id, { issues: fileIssues });
    setStage(f.id, 3, "done");

    /* 5 · отчёт */
    setStage(f.id, 4, "active");
    log("reporter", "Сборка итоговых файлов…");
    await sleep(520 + rnd(320));
    const outputs = makeOutputs(cur, analysis, fileIssues);
    outputs.forEach((o) => log("reporter", `→ output/${o.name} · ${fmtBytes(o.size)}`, "ok"));
    const ms = Math.round(performance.now() - started);
    patchFile(f.id, { status: "done", outputs, ms });
    setStage(f.id, 4, "done");
    log("orchestrator", `«${f.name}» обработан за ${(ms / 1000).toFixed(1)} с · 3 файла на выходе`, "ok");
    openResult(f.id);
    return true;
  };

  const runQueueRef = useRef<() => Promise<void>>(async () => {});
  runQueueRef.current = async () => {
    log("orchestrator", `Конвейер запущен · задач в очереди: ${queueRef.current.length}`);
    let ok = 0;
    while (queueRef.current.length) {
      const next = queueRef.current.shift();
      if (!next) continue;
      if (await processFile(next)) ok++;
    }
    log(
      "orchestrator",
      ok > 0
        ? `Конвейер завершён · обработано: ${ok} · результаты в output/`
        : "Конвейер остановлен · нет успешно обработанных файлов",
      ok > 0 ? "ok" : "warn"
    );
    runningRef.current = false;
    setRunning(false);
  };

  const kick = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    void runQueueRef.current();
  };

  const enqueueRaw = (name: string, size: number, raw: string, buffer?: ArrayBuffer) => {
    const file: MaaFile = {
      id: uid(),
      name,
      size: size || (buffer ? buffer.byteLength : new Blob([raw]).size),
      kind: "txt",
      raw,
      buffer,
      status: "queued",
      stageIdx: -1,
      stages: Array(5).fill("pending") as StageState[],
      analysis: null,
      issues: [],
      outputs: [],
    };
    setFiles((p) => [...p, file]);
    queueRef.current.push(file);
    log("orchestrator", `${name} принят в очередь · ${fmtBytes(file.size)}`);
    kick();
  };

  const BIN_EXT = ["doc", "docx", "xls", "xlsx", "pdf"];

  const onFiles = (list: FileList | File[]) =>
    Array.from(list).forEach((f) => {
      const ext = f.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
      const reader = new FileReader();
      reader.onerror = () => log("orchestrator", `Не удалось прочитать ${f.name}`, "error");
      if (BIN_EXT.includes(ext)) {
        reader.onload = () => enqueueRaw(f.name, f.size, "", reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(f);
      } else {
        reader.onload = () => enqueueRaw(f.name, f.size, String(reader.result ?? ""));
        reader.readAsText(f);
      }
    });

  const onSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    enqueueRaw(s.name, new Blob([s.content]).size, s.content);
  };

  const onGenerate = async (what: "xlsx" | "docx") => {
    try {
      log("orchestrator", `Генерация демо-файла ${what.toUpperCase()}…`);
      if (what === "xlsx") {
        const buf = await generateDemoXlsx();
        enqueueRaw("демо_продажи.xlsx", buf.byteLength, "", buf);
      } else {
        const buf = await generateDemoDocx();
        enqueueRaw("демо_техзадание.docx", buf.byteLength, "", buf);
      }
    } catch {
      log("orchestrator", "Не удалось сгенерировать демо-файл", "error");
    }
  };

  const clearAll = () => {
    if (runningRef.current) return;
    queueRef.current = [];
    setFiles([]);
    setIssues([]);
    setOpenTabs([]);
    setActiveTab({ type: "pipeline" });
    setLogs([]);
    setTimeout(() => log("orchestrator", "Рабочая область очищена · ожидание файлов"), 40);
  };

  /* ---------------- boot log ---------------- */
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const t = [
      setTimeout(() => log("orchestrator", "Multi-Agent Analyzer v1.4 · инициализация ядра"), 150),
      setTimeout(() => log("orchestrator", "6 агентов в сети · каналы связи установлены", "ok"), 550),
      setTimeout(() => log("validator", "Загружено правил качества: 12"), 950),
      setTimeout(() => log("orchestrator", "Ожидание файлов — перетащите их в зону приёма"), 1350),
    ];
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- derived ---------------- */
  const agentState = useMemo(() => {
    const st: Record<AgentId, AgentUiState> = {
      orchestrator: "idle", ingestion: "idle", parser: "idle",
      analytics: "idle", validator: "idle", reporter: "idle",
    };
    const current = files.find((f) => f.status === "processing");
    const someDone = files.some((f) => f.status === "done");
    if (current && current.stageIdx >= 0 && current.stageIdx < 5) {
      current.stages.forEach((s, i) => {
        if (s === "done") st[PIPE_AGENTS[i]] = "done";
      });
      if (current.stages[current.stageIdx] === "active")
        st[PIPE_AGENTS[current.stageIdx]] = "active";
    } else if (!running && someDone) {
      PIPE_AGENTS.forEach((a) => (st[a] = "done"));
    }
    st.orchestrator = running ? "active" : someDone ? "done" : "idle";
    return st;
  }, [files, running]);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warn").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const activeFile =
    activeTab.type === "result" ? files.find((f) => f.id === activeTab.fileId) : undefined;

  /* ---------------- render ---------------- */
  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_78%)]" />
        <div
          className="drift-a absolute -left-44 -top-44 h-[36rem] w-[36rem] rounded-full opacity-[0.13]"
          style={{ background: "radial-gradient(circle, #ffb454 0%, transparent 62%)" }}
        />
        <div
          className="drift-b absolute -right-52 top-1/3 h-[40rem] w-[40rem] rounded-full opacity-[0.11]"
          style={{ background: "radial-gradient(circle, #2fd8c3 0%, transparent 62%)" }}
        />
        <div
          className="absolute bottom-[-10rem] left-1/4 h-[30rem] w-[30rem] rounded-full opacity-[0.09]"
          style={{ background: "radial-gradient(circle, #56c8ff 0%, transparent 62%)" }}
        />
      </div>

      <TopBar />

      {/* ===== IDE window ===== */}
      <main id="pult" className="relative z-10 mx-auto mt-7 max-w-7xl px-3 sm:px-5">
        <div className="overflow-hidden rounded-xl border border-line bg-abyss-900 shadow-[0_50px_140px_-40px_rgba(0,0,0,0.9)]">
          <TitleBar running={running} fileCount={files.length} />
          <div className="flex h-[600px] md:h-[660px]">
            <ActivityBar
              sidebarMode={sidebarMode}
              onMode={setSidebarMode}
              termOpen={termOpen}
              onTerm={() => setTermOpen((v) => !v)}
              onVscode={() => setActiveTab({ type: "vscode" })}
            />
            <Sidebar
              mode={sidebarMode}
              files={files}
              agentState={agentState}
              onOpenFile={(id) => {
                const f = files.find((x) => x.id === id);
                if (f?.status === "done") openResult(id);
                else setActiveTab({ type: "pipeline" });
              }}
              onDownload={downloadOutput}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <TabStrip
                openTabs={openTabs}
                files={files}
                activeTab={activeTab}
                onPipeline={() => setActiveTab({ type: "pipeline" })}
                onResult={(id) => setActiveTab({ type: "result", fileId: id })}
                onVscode={() => setActiveTab({ type: "vscode" })}
                onClose={closeTab}
              />
              <div className="min-h-0 flex-1 overflow-y-auto bg-abyss-950/40">
                {activeTab.type === "pipeline" && (
                  <PipelineTab
                    files={files}
                    running={running}
                    agentState={agentState}
                    onFiles={onFiles}
                    onSample={onSample}
                    onGenerate={onGenerate}
                    onOpenResult={openResult}
                    onClear={clearAll}
                  />
                )}
                {activeTab.type === "result" &&
                  (activeFile && activeFile.analysis ? (
                    <ResultTab file={activeFile} onDownload={downloadOutput} />
                  ) : (
                    <div className="px-6 py-10 font-mono text-[12px] text-fog-faint">
                      Файл ещё обрабатывается…
                    </div>
                  ))}
                {activeTab.type === "vscode" && <VSCodeTab />}
              </div>
              <TerminalPanel
                open={termOpen}
                onToggle={() => setTermOpen((v) => !v)}
                tab={termTab}
                onTab={setTermTab}
                logs={logs}
                issues={issues}
                onClear={() => {
                  setLogs([]);
                  setTimeout(() => log("orchestrator", "Журнал очищен"), 30);
                }}
                onOpenFile={(id) => {
                  const f = files.find((x) => x.id === id);
                  if (f?.status === "done") openResult(id);
                }}
              />
            </div>
          </div>
          <StatusBar
            running={running}
            errors={errors}
            warnings={warnings}
            doneCount={doneCount}
            total={files.length}
            onAgents={() => setSidebarMode("agents")}
          />
        </div>
        <p className="mt-3 text-center font-mono text-[10.5px] text-fog-faint">
          пульт управления · CSV, JSON, TXT, DOCX, DOC, XLSX, XLS, PDF — шесть агентов сделают остальное
        </p>
      </main>

      <ArchitectureSection />
      <IntegrationSection />
      <Footer />
    </div>
  );
}

