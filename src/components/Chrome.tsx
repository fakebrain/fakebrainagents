import { useEffect, useRef } from "react";
import {
  AGENTS,
  AGENT_LIST,
  AgentId,
  Issue,
  LogLine,
  MaaFile,
  OutputFile,
  cls,
  fmtBytes,
} from "../lib/types";
import {
  IBot,
  IChevronDown,
  IDownload,
  IFolder,
  IGear,
  IPulse,
  ITerminal,
  ITrash,
  IX,
  IAlert,
  IInfo,
  IGit,
  ICheck,
} from "./icons";
import { KindBadge } from "./ui";

export type Tab =
  | { type: "pipeline" }
  | { type: "result"; fileId: string }
  | { type: "vscode" };

export type AgentUiState = "idle" | "active" | "done";

/* ================= title bar ================= */

export function TitleBar({ running, fileCount }: { running: boolean; fileCount: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-line bg-abyss-850 px-3.5 py-2">
      <div className="flex gap-1.5">
        <span className="h-3 w-3 rounded-full bg-coralx/80 transition-transform hover:scale-110" />
        <span className="h-3 w-3 rounded-full bg-amberx/80 transition-transform hover:scale-110" />
        <span className="h-3 w-3 rounded-full bg-limex/80 transition-transform hover:scale-110" />
      </div>
      <div className="min-w-0 flex-1 truncate text-center font-mono text-[11px] text-fog-dim">
        рабочая_область — Multi-Agent Analyzer
        {fileCount > 0 && <span className="text-fog-faint"> · файлов: {fileCount}</span>}
      </div>
      <div className="flex w-16 justify-end font-mono text-[10px] uppercase tracking-[0.18em]">
        {running ? (
          <span className="flex items-center gap-1.5 text-amberx">
            <span className="live-blink h-1.5 w-1.5 rounded-full bg-amberx" />
            live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-fog-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-fog-faint/50" />
            idle
          </span>
        )}
      </div>
    </div>
  );
}

/* ================= activity bar ================= */

export function ActivityBar({
  sidebarMode,
  onMode,
  termOpen,
  onTerm,
  onVscode,
}: {
  sidebarMode: "explorer" | "agents";
  onMode: (m: "explorer" | "agents") => void;
  termOpen: boolean;
  onTerm: () => void;
  onVscode: () => void;
}) {
  const Btn = ({
    active,
    onClick,
    label,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cls(
        "relative flex h-11 w-full items-center justify-center transition-colors",
        active ? "bg-abyss-800 text-amberx" : "text-fog-faint hover:bg-abyss-850 hover:text-fog"
      )}
    >
      {active && <span className="absolute left-0 h-6 w-[3px] rounded-r bg-amberx" />}
      {children}
    </button>
  );
  return (
    <nav className="flex w-11 shrink-0 flex-col border-r border-line bg-abyss-900 py-1.5">
      <Btn active={sidebarMode === "explorer"} onClick={() => onMode("explorer")} label="Проводник">
        <IFolder size={19} />
      </Btn>
      <Btn active={sidebarMode === "agents"} onClick={() => onMode("agents")} label="Агенты">
        <IBot size={19} />
      </Btn>
      <Btn active={termOpen} onClick={onTerm} label="Терминал агентов">
        <ITerminal size={19} />
      </Btn>
      <div className="my-1.5 mx-2.5 border-t border-line-soft" />
      <div className="mt-auto">
        <Btn onClick={onVscode} label="Интеграция с VS Code">
          <IGear size={19} />
        </Btn>
      </div>
    </nav>
  );
}

/* ================= sidebar ================= */

function statusDot(f: MaaFile) {
  if (f.status === "processing")
    return <span className="live-blink h-1.5 w-1.5 shrink-0 rounded-full bg-amberx" />;
  if (f.status === "done") return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-limex" />;
  if (f.status === "error") return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coralx" />;
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fog-faint/60" />;
}

export function Sidebar({
  mode,
  files,
  agentState,
  onOpenFile,
  onDownload,
}: {
  mode: "explorer" | "agents";
  files: MaaFile[];
  agentState: Record<AgentId, AgentUiState>;
  onOpenFile: (id: string) => void;
  onDownload: (o: OutputFile) => void;
}) {
  const outputs = files.flatMap((f) => f.outputs);
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-abyss-900 md:flex">
      <div className="px-4 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-fog-faint">
        {mode === "explorer" ? "проводник" : "агенты · 6"}
      </div>

      {mode === "explorer" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-fog-dim">
            <IFolder size={13} />
            <span className="font-mono text-[11.5px] font-semibold">input/</span>
            <span className="ml-auto font-mono text-[10px] text-fog-faint">{files.length}</span>
          </div>
          {files.length === 0 && (
            <p className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-fog-faint">
              Пока пусто. Перетащите файлы в зону приёма на вкладке «конвейер».
            </p>
          )}
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => f.status === "done" && onOpenFile(f.id)}
              className={cls(
                "group flex w-full items-center gap-2 rounded px-3 py-[5px] text-left transition-colors",
                f.status === "done" ? "hover:bg-abyss-800" : "cursor-default"
              )}
            >
              {statusDot(f)}
              <span className="truncate font-mono text-[11.5px] text-fog/90 group-hover:text-fog">
                {f.name}
              </span>
              <span className="ml-auto shrink-0">
                <KindBadge kind={f.kind} />
              </span>
            </button>
          ))}

          <div className="mt-3 flex items-center gap-1.5 px-2 py-1.5 text-fog-dim">
            <IFolder size={13} />
            <span className="font-mono text-[11.5px] font-semibold">output/</span>
            <span className="ml-auto font-mono text-[10px] text-fog-faint">{outputs.length}</span>
          </div>
          {outputs.length === 0 ? (
            <p className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-fog-faint">
              Проанализированные файлы появятся здесь.
            </p>
          ) : (
            outputs.map((o, i) => (
              <div
                key={`${o.name}-${i}`}
                className="group flex w-full items-center gap-2 rounded px-3 py-[5px] transition-colors hover:bg-abyss-800"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orchidx/80" />
                <span className="truncate font-mono text-[11px] text-fog/85" title={o.name}>
                  {o.name}
                </span>
                <button
                  onClick={() => onDownload(o)}
                  title={`Скачать ${o.name}`}
                  className="ml-auto shrink-0 rounded p-1 text-fog-faint opacity-0 transition-all hover:bg-abyss-750 hover:text-orchidx group-hover:opacity-100"
                >
                  <IDownload size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {AGENT_LIST.map((a) => {
            const st = agentState[a.id];
            return (
              <div
                key={a.id}
                className={cls(
                  "rounded-md border px-3 py-2.5 transition-all duration-300",
                  st === "active" ? "translate-x-0.5" : "border-line-soft"
                )}
                style={
                  st === "active"
                    ? { borderColor: `${a.color}66`, background: `${a.color}0d` }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cls("h-2 w-2 rounded-full", st === "active" && "pulse-ring")}
                    style={{
                      background: st === "idle" ? "#576880" : a.color,
                      ["--pulse-c" as string]: `${a.color}88`,
                    }}
                  />
                  <span className="text-[12.5px] font-semibold text-fog">{a.name}</span>
                  <span className="ml-auto font-mono text-[9.5px] uppercase tracking-wider text-fog-faint">
                    {a.short}
                  </span>
                </div>
                <div className="mt-0.5 pl-4 text-[10.5px] text-fog-faint">{a.role}</div>
                <div
                  className={cls(
                    "mt-1 flex items-center gap-1.5 pl-4 font-mono text-[10.5px]",
                    st === "active" ? "" : "text-fog-faint/80"
                  )}
                  style={st === "active" ? { color: a.color } : undefined}
                >
                  {st === "active" ? (
                    <>
                      <span className="live-blink">▸</span> {a.action}
                    </>
                  ) : st === "done" ? (
                    <>
                      <ICheck size={10} /> готов
                    </>
                  ) : (
                    "в ожидании"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

/* ================= tab strip ================= */

export function TabStrip({
  openTabs,
  files,
  activeTab,
  onPipeline,
  onResult,
  onVscode,
  onClose,
}: {
  openTabs: string[];
  files: MaaFile[];
  activeTab: Tab;
  onPipeline: () => void;
  onResult: (id: string) => void;
  onVscode: () => void;
  onClose: (id: string) => void;
}) {
  const tabCls = (active: boolean) =>
    cls(
      "group relative flex items-center gap-2 border-r border-line-soft px-3.5 py-2 font-mono text-[11.5px] transition-colors",
      active
        ? "bg-abyss-950/50 text-fog"
        : "bg-abyss-900 text-fog-dim hover:bg-abyss-850 hover:text-fog"
    );
  return (
    <div className="flex items-stretch overflow-x-auto border-b border-line bg-abyss-900">
      <button onClick={onPipeline} className={tabCls(activeTab.type === "pipeline")}>
        <IPulse size={12} className={activeTab.type === "pipeline" ? "text-amberx" : ""} />
        конвейер
        {activeTab.type === "pipeline" && (
          <span className="absolute inset-x-0 top-0 h-[2px] bg-amberx" />
        )}
      </button>
      {openTabs.map((id) => {
        const f = files.find((x) => x.id === id);
        if (!f) return null;
        const active = activeTab.type === "result" && activeTab.fileId === id;
        return (
          <button key={id} onClick={() => onResult(id)} className={tabCls(active)}>
            <span className="max-w-[140px] truncate">{f.name}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClose(id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onClose(id);
                }
              }}
              className="rounded p-0.5 text-fog-faint opacity-0 transition-all hover:bg-abyss-750 hover:text-coralx group-hover:opacity-100"
            >
              <IX size={10} />
            </span>
            {active && <span className="absolute inset-x-0 top-0 h-[2px] bg-tealx" />}
          </button>
        );
      })}
      <button onClick={onVscode} className={tabCls(activeTab.type === "vscode")}>
        <IGear size={12} className={activeTab.type === "vscode" ? "text-amberx" : ""} />
        vs-code.md
        {activeTab.type === "vscode" && (
          <span className="absolute inset-x-0 top-0 h-[2px] bg-amberx" />
        )}
      </button>
    </div>
  );
}

/* ================= terminal ================= */

export function TerminalPanel({
  open,
  onToggle,
  tab,
  onTab,
  logs,
  issues,
  onClear,
  onOpenFile,
}: {
  open: boolean;
  onToggle: () => void;
  tab: "log" | "problems";
  onTab: (t: "log" | "problems") => void;
  logs: LogLine[];
  issues: Issue[];
  onClear: () => void;
  onOpenFile: (id: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, issues, tab, open]);

  const levelColor = (l: LogLine["level"]) =>
    l === "ok" ? "text-limex" : l === "warn" ? "text-amberx" : l === "error" ? "text-coralx" : "text-fog/85";

  return (
    <div className="shrink-0 border-t border-line bg-abyss-900">
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <button
          onClick={() => onTab("log")}
          className={cls(
            "rounded-t px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors",
            tab === "log" && open ? "bg-abyss-950/50 text-fog" : "text-fog-faint hover:text-fog"
          )}
        >
          лог агентов
        </button>
        <button
          onClick={() => {
            onTab("problems");
            if (!open) onToggle();
          }}
          className={cls(
            "flex items-center gap-1.5 rounded-t px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors",
            tab === "problems" && open ? "bg-abyss-950/50 text-fog" : "text-fog-faint hover:text-fog"
          )}
        >
          проблемы
          <span
            className={cls(
              "rounded-full px-1.5 py-px text-[9.5px] font-semibold",
              issues.some((i) => i.severity === "error")
                ? "bg-coralx/15 text-coralx"
                : issues.length
                ? "bg-amberx/15 text-amberx"
                : "bg-abyss-750 text-fog-faint"
            )}
          >
            {issues.length}
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1 pb-0.5">
          <button
            onClick={onClear}
            title="Очистить журнал"
            className="rounded p-1.5 text-fog-faint transition-colors hover:bg-abyss-800 hover:text-coralx"
          >
            <ITrash size={13} />
          </button>
          <button
            onClick={onToggle}
            title={open ? "Свернуть панель" : "Развернуть панель"}
            className={cls(
              "rounded p-1.5 text-fog-faint transition-all hover:bg-abyss-800 hover:text-fog",
              !open && "rotate-180"
            )}
          >
            <IChevronDown size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div ref={bodyRef} className="h-40 overflow-y-auto border-t border-line-soft py-1.5">
          {tab === "log" ? (
            logs.length === 0 ? (
              <p className="px-4 py-2 font-mono text-[11px] text-fog-faint">
                Журнал пуст — агенты ждут файлы.
              </p>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="anim-rise flex gap-2.5 px-4 py-[2.5px] font-mono text-[11.5px] leading-relaxed"
                >
                  <span className="shrink-0 text-fog-faint/80">{l.t}</span>
                  <span className="w-12 shrink-0 font-bold" style={{ color: AGENTS[l.agent].color }}>
                    {AGENTS[l.agent].short}
                  </span>
                  <span className={levelColor(l.level)}>
                    {l.level === "ok" ? "✓ " : l.level === "warn" ? "⚠ " : l.level === "error" ? "✕ " : ""}
                    {l.text}
                  </span>
                </div>
              ))
            )
          ) : issues.length === 0 ? (
            <p className="px-4 py-2 font-mono text-[11px] text-fog-faint">
              Проблем не найдено — валидатор доволен.
            </p>
          ) : (
            issues.map((i) => (
              <button
                key={i.id}
                onClick={() => onOpenFile(i.fileId)}
                className="anim-rise flex w-full items-start gap-2.5 px-4 py-[3.5px] text-left transition-colors hover:bg-abyss-850"
              >
                <span className={i.severity === "error" ? "text-coralx" : "text-amberx"}>
                  {i.severity === "error" ? <IAlert size={13} /> : <IInfo size={13} />}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-semibold text-fog-dim">
                  {i.fileName}
                </span>
                <span className="text-[11.5px] text-fog/80">{i.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================= status bar ================= */

export function StatusBar({
  running,
  errors,
  warnings,
  doneCount,
  total,
  onAgents,
}: {
  running: boolean;
  errors: number;
  warnings: number;
  doneCount: number;
  total: number;
  onAgents: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line bg-abyss-850 px-3 py-[5px] font-mono text-[10.5px] text-fog-dim">
      <span className="flex items-center gap-1.5 text-fog-faint">
        <IGit size={12} /> main
      </span>
      {errors > 0 && (
        <span className="flex items-center gap-1 text-coralx">
          <IAlert size={11} /> {errors}
        </span>
      )}
      {warnings > 0 && (
        <span className="flex items-center gap-1 text-amberx">
          <IInfo size={11} /> {warnings}
        </span>
      )}
      <span className="hidden items-center gap-2 sm:flex">
        {running ? (
          <>
            <span className="text-amberx">конвейер активен</span>
            <span className="bar-indet h-1 w-24 rounded-full bg-abyss-700 text-amberx" />
          </>
        ) : total > 0 ? (
          `обработано ${doneCount}/${total}`
        ) : (
          "готов к работе"
        )}
      </span>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onAgents}
          className="flex items-center gap-1.5 transition-colors hover:text-fog"
          title="Панель агентов"
        >
          <span
            className={cls(
              "h-1.5 w-1.5 rounded-full",
              running ? "live-blink bg-amberx" : "bg-limex"
            )}
          />
          агенты 6/6
        </button>
        <span className="hidden text-fog-faint sm:inline">UTF-8</span>
        <span className="rounded bg-abyss-750 px-1.5 py-px text-[9.5px] uppercase tracking-wider text-amberx">
          MAA v1.4
        </span>
      </div>
    </div>
  );
}
