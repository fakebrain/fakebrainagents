import { useEffect, useMemo, useRef, useState } from "react";
import { AgentUiState, Sidebar, StatusBar, Tab, TabStrip, TerminalPanel, TitleBar, ActivityBar } from "./components/Chrome";
import { ArchitectureSection, Footer, IntegrationSection, TopBar } from "./components/PageSections";
import { PipelineTab } from "./components/PipelineTab";
import { ResultTab } from "./components/ResultTab";
import { VSCodeTab } from "./components/VSCodeTab";
import { buildIssues, detectKind, downloadOutput, makeOutputs, runAnalysis } from "./lib/analysis";
import { SAMPLES } from "./lib/samples";
import {
  AGENTS,
  AgentId,
  AnyAnalysis,
  Issue,
  LogLine,
  MaaFile,
  OutputFile,
  PIPE_AGENTS,
  StageState,
  fmtBytes,
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
    const kind = detectKind(f.name, f.raw);
    if (kind === "binary") {
      failFile(f, 0, "ingestion", "бинарный формат: конвейер работает с CSV / JSON / TXT");
      return false;
    }
    patchFile(f.id, { kind });
    log("ingestion", `Целостность ОК · кодировка UTF-8 · формат: ${kind.toUpperCase()}`, "ok");
    setStage(f.id, 0, "done");

    /* 2 · парсинг */
    setStage(f.id, 1, "active");
    log("parser", `Разбор структуры (${kind.toUpperCase()})…`);
    await sleep(520 + rnd(320));
    try {
      if (kind === "json") {
        JSON.parse(f.raw);
        log("parser", `Синтаксис корректен · ${fmtBytes(f.raw.length)}`, "ok");
      } else if (kind === "csv") {
        const lines = f.raw.split(/\r?\n/).filter((l) => l.trim() !== "");
        if (lines.length < 2) throw new Error("нет строк данных");
        log("parser", `Таблица распознана: ${lines.length - 1} строк`, "ok");
      } else {
        const words = (f.raw.match(/\S+/g) ?? []).length;
        log("parser", `Сплошной текст · ${words} слов`, "ok");
      }
    } catch (e) {
      failFile(f, 1, "parser", e instanceof Error ? e.message : "не удалось разобрать файл");
      return false;
    }
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
      analysis = runAnalysis(kind, f.raw);
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
    const cur = { ...f, kind, analysis };
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

  const enqueueRaw = (name: string, size: number, raw: string) => {
    const file: MaaFile = {
      id: uid(),
      name,
      size: size || new Blob([raw]).size,
      kind: "txt",
      raw,
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

  const onFiles = (list: FileList | File[]) =>
    Array.from(list).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => enqueueRaw(f.name, f.size, String(reader.result ?? ""));
      reader.onerror = () => log("orchestrator", `Не удалось прочитать ${f.name}`, "error");
      reader.readAsText(f);
    });

  const onSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    enqueueRaw(s.name, new Blob([s.content]).size, s.content);
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
          пульт управления · перетащите CSV, JSON или TXT — шесть агентов сделают остальное
        </p>
      </main>

      <ArchitectureSection />
      <IntegrationSection />
      <Footer />
    </div>
  );
}

