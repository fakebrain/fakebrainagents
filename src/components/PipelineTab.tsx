import { useRef, useState } from "react";
import { SAMPLES } from "../lib/samples";
import {
  AGENTS,
  AGENT_LIST,
  AgentId,
  MaaFile,
  PIPE_AGENTS,
  cls,
  fmtBytes,
} from "../lib/types";
import { AgentUiState } from "./Chrome";
import { IArrowRight, ICheck, IFile, IPlay, IPlus } from "./icons";
import { KindBadge } from "./ui";

const qColor = (q: number) => (q >= 80 ? "#a9e35f" : q >= 55 ? "#ffb454" : "#ff7a6b");

export function PipelineTab({
  files,
  running,
  agentState,
  onFiles,
  onSample,
  onGenerate,
  onOpenResult,
  onClear,
}: {
  files: MaaFile[];
  running: boolean;
  agentState: Record<AgentId, AgentUiState>;
  onFiles: (list: FileList | File[]) => void;
  onSample: (id: string) => void;
  onGenerate: (what: "xlsx" | "docx") => void;
  onOpenResult: (id: string) => void;
  onClear?: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amberx">
            конвейер · pipeline
          </div>
          <h1 className="mt-1 font-display text-xl font-bold leading-tight text-fog sm:text-2xl">
            Файлы входят — отчёты выходят
          </h1>
        </div>
        <div
          className={cls(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px]",
            running
              ? "border-amberx/40 bg-amberx/10 text-amberx"
              : "border-line text-fog-dim"
          )}
        >
          {running ? (
            <>
              <span className="live-blink h-1.5 w-1.5 rounded-full bg-amberx" />
              обработка…
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-limex/80" />
              {files.length ? "ожидание файлов" : "система готова"}
            </>
          )}
        </div>
      </div>

      {/* intake */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
          }}
          className={cls(
            "group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-300",
            drag
              ? "scale-[1.015] border-amberx bg-amberx/[0.06]"
              : "border-abyss-700 bg-abyss-850/40 hover:border-fog-faint/60 hover:bg-abyss-850/70"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept=".csv,.tsv,.json,.txt,.md,.log,.doc,.docx,.xls,.xlsx,.pdf"
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            className={cls(
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full border transition-all",
              drag
                ? "border-amberx text-amberx"
                : "border-abyss-700 text-fog-dim group-hover:text-fog"
            )}
          >
            <IPlay size={18} />
          </div>
          <p className="mt-3 text-[15px] font-semibold text-fog">
            {drag ? "Отпускайте — оркестратор подхватит" : "Перетащите файлы сюда"}
          </p>
          <p className="mt-1 font-mono text-[11px] text-fog-faint">
            или нажмите — откроется проводник
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {(
              [
                ["CSV", "#2fd8c3"],
                ["JSON", "#ffb454"],
                ["TXT", "#56c8ff"],
                ["DOCX", "#7fb0ff"],
                ["DOC", "#a8c6ff"],
                ["XLSX", "#a9e35f"],
                ["XLS", "#79b344"],
                ["PDF", "#ff7a6b"],
              ] as const
            ).map(([f, c]) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider transition-colors hover:border-fog-faint/50"
                style={{ color: c }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: c }} />
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-line-soft bg-abyss-850/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-faint">
            демо-данные
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-fog-dim">
            Нет файла под рукой? Возьмите пример — в каждом спрятаны
            пропуски, дубликаты или аномалии.
          </p>
          <div className="mt-3 space-y-2">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                onClick={() => onSample(s.id)}
                className="group flex w-full items-center gap-3 rounded-lg border border-line-soft bg-abyss-900/70 px-3 py-2 text-left transition-all hover:-translate-y-px hover:border-amberx/50 hover:bg-abyss-800"
              >
                <IFile size={15} className="shrink-0 text-fog-faint group-hover:text-amberx" />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[12px] font-medium text-fog">
                    {s.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-fog-faint">{s.hint}</span>
                </span>
                <IArrowRight
                  size={13}
                  className="ml-auto shrink-0 text-fog-faint transition-all group-hover:translate-x-0.5 group-hover:text-amberx"
                />
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-line-soft pt-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-faint">
              сгенерировать в браузере
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => onGenerate("xlsx")}
                className="group flex items-center justify-center gap-2 rounded-lg border border-limex/30 bg-limex/[0.06] px-3 py-2 font-mono text-[11.5px] font-semibold text-limex transition-all hover:-translate-y-px hover:border-limex/60 hover:bg-limex/10"
              >
                <IPlus size={13} className="transition-transform group-hover:rotate-90" />
                демо XLSX
              </button>
              <button
                onClick={() => onGenerate("docx")}
                className="group flex items-center justify-center gap-2 rounded-lg border border-skyx/30 bg-skyx/[0.06] px-3 py-2 font-mono text-[11.5px] font-semibold text-skyx transition-all hover:-translate-y-px hover:border-skyx/60 hover:bg-skyx/10"
              >
                <IPlus size={13} className="transition-transform group-hover:rotate-90" />
                демо DOCX
              </button>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-fog-faint">
              Файлы собираются настоящими библиотеками (SheetJS, JSZip) и
              проходят полный конвейер, включая проверку сигнатур.
            </p>
          </div>
        </div>
      </div>

      {/* agent chain */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-line-soft bg-abyss-850/40 px-4 py-4">
        <div className="mb-3 flex min-w-[560px] items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-faint">
            цепочка агентов
          </span>
          <span className="font-mono text-[10px] text-fog-faint">
            ORC → ING → PRS → ANA → VAL → REP
          </span>
        </div>
        <div className="flex min-w-[560px] items-start">
          {AGENT_LIST.map((a, i) => {
            const st = agentState[a.id];
            const prev = i > 0 ? agentState[AGENT_LIST[i - 1].id] : null;
            return (
              <div key={a.id} className="flex min-w-0 flex-1 items-start">
                {i > 0 && (
                  <div className="mt-[19px] flex-1 self-start">
                    {prev === "done" || prev === "active" ? (
                      <div className="dash-x" style={{ color: a.color }} />
                    ) : (
                      <div className="h-[2px] rounded bg-abyss-700" />
                    )}
                  </div>
                )}
                <div className="flex w-14 flex-col items-center gap-1.5">
                  <div
                    className={cls(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-[10px] font-bold transition-all duration-300",
                      st === "active" && "pulse-ring"
                    )}
                    style={{
                      borderColor:
                        st === "idle" ? "#1c2940" : `${a.color}${st === "done" ? "aa" : ""}`,
                      background:
                        st === "idle" ? "#0d1420" : `${a.color}${st === "active" ? "1f" : "14"}`,
                      color: st === "idle" ? "#576880" : a.color,
                      ["--pulse-c" as string]: `${a.color}77`,
                    }}
                  >
                    {st === "done" ? <ICheck size={14} /> : a.short}
                  </div>
                  <span
                    className={cls(
                      "whitespace-nowrap text-center text-[9.5px] leading-tight",
                      st === "idle" ? "text-fog-faint" : "text-fog-dim"
                    )}
                  >
                    {a.name.replace(" агент", "").replace("Агент ", "")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* queue */}
      <div className="mt-6">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-faint">
            очередь задач
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-fog-faint">
              {files.filter((f) => f.status === "done").length}/{files.length} готово
            </span>
            {files.length > 0 && !running && onClear && (
              <button
                onClick={onClear}
                className="rounded border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fog-faint transition-colors hover:border-coralx/50 hover:text-coralx"
              >
                очистить
              </button>
            )}
          </div>
        </div>

        {files.length === 0 ? (
          <div className="rounded-xl border border-line-soft bg-abyss-850/30 px-5 py-8 text-center">
            <p className="font-mono text-[12px] text-fog-faint">
              // очередь пуста — шесть агентов скучают без работы
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="anim-rise rounded-lg border border-line-soft bg-abyss-850/60 px-4 py-3 transition-colors hover:border-line"
              >
                <div className="flex items-center gap-3">
                  <KindBadge kind={f.kind} />
                  <span className="min-w-0 truncate font-mono text-[13px] font-medium text-fog">
                    {f.name}
                  </span>
                  <span className="hidden shrink-0 font-mono text-[10.5px] text-fog-faint sm:inline">
                    {fmtBytes(f.size)}
                  </span>

                  <div className="ml-auto flex shrink-0 items-center gap-2.5">
                    {f.status === "queued" && (
                      <span className="font-mono text-[11px] text-fog-faint">в очереди…</span>
                    )}
                    {f.status === "processing" && (
                      <span
                        className="flex items-center gap-1.5 font-mono text-[11px]"
                        style={{
                          color:
                            f.stageIdx >= 0 && f.stageIdx < 5
                              ? AGENTS[PIPE_AGENTS[f.stageIdx]].color
                              : "#8394ad",
                        }}
                      >
                        <span className="live-blink">▸</span>
                        {f.stageIdx >= 0 && f.stageIdx < 5
                          ? AGENTS[PIPE_AGENTS[f.stageIdx]].name.toLowerCase()
                          : "приём"}
                      </span>
                    )}
                    {f.status === "done" && f.analysis && (
                      <>
                        <span
                          className="rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-semibold"
                          style={{
                            color: qColor(f.analysis.quality),
                            borderColor: `${qColor(f.analysis.quality)}55`,
                            background: `${qColor(f.analysis.quality)}12`,
                          }}
                        >
                          {f.analysis.quality}/100
                        </span>
                        {f.ms !== undefined && (
                          <span className="hidden font-mono text-[10px] text-fog-faint md:inline">
                            {(f.ms / 1000).toFixed(1)} с
                          </span>
                        )}
                        <button
                          onClick={() => onOpenResult(f.id)}
                          className="flex items-center gap-1.5 rounded-md bg-abyss-750 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-fog transition-all hover:bg-tealx hover:text-abyss-950"
                        >
                          анализ <IArrowRight size={12} />
                        </button>
                      </>
                    )}
                    {f.status === "error" && (
                      <span className="max-w-[220px] truncate font-mono text-[10.5px] text-coralx">
                        ✕ {f.error}
                      </span>
                    )}
                  </div>
                </div>

                {f.status === "processing" && (
                  <div className="mt-2.5 flex gap-1">
                    {f.stages.map((st, i) => (
                      <span
                        key={i}
                        className={cls(
                          "h-1 flex-1 rounded-full transition-colors",
                          (st === "pending" || st === "skipped") && "bg-abyss-700",
                          st === "active" && "bar-shimmer"
                        )}
                        style={
                          st === "done"
                            ? { background: AGENTS[PIPE_AGENTS[i]].color }
                            : st === "active"
                            ? { background: `${AGENTS[PIPE_AGENTS[i]].color}99` }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
