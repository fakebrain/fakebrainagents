import { AGENT_LIST } from "../lib/types";
import {
  IArrowRight,
  IBot,
  ICpu,
  ILayers,
  ITerminal,
  LogoMark,
} from "./icons";
import { CodeBlock, Reveal } from "./ui";

/* ================= top bar ================= */

export function TopBar() {
  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
      <div className="flex items-center gap-3">
        <LogoMark size={34} />
        <div>
          <div className="font-display text-[15px] font-bold leading-tight tracking-wide text-fog">
            МУЛЬТИАГЕНТ<span className="text-amberx">/</span>АНАЛИТИКА
          </div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-fog-faint">
            multi-agent file analyzer
          </div>
        </div>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <span className="flex items-center gap-1.5 rounded-full border border-line bg-abyss-900/70 px-3 py-1.5 font-mono text-[10.5px] text-fog-dim">
          <IBot size={12} className="text-tealx" /> 6 агентов
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-line bg-abyss-900/70 px-3 py-1.5 font-mono text-[10.5px] text-fog-dim">
          <ICpu size={12} className="text-skyx" /> локально
        </span>
        <a
          href="#vscode"
          className="group flex items-center gap-1.5 rounded-full border border-amberx/40 bg-amberx/10 px-3.5 py-1.5 font-mono text-[10.5px] font-semibold text-amberx transition-all hover:bg-amberx hover:text-abyss-950"
        >
          запуск в vscode
          <IArrowRight size={12} className="rotate-90 transition-transform group-hover:translate-y-0.5" />
        </a>
      </div>
    </header>
  );
}

/* ================= architecture ================= */

export function ArchitectureSection() {
  return (
    <section id="agents" className="relative z-10 mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <Reveal>
        <div className="max-w-2xl">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-tealx">
            архитектура
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-fog sm:text-[34px]">
            Шесть агентов.
            <br />
            <span className="text-fog-dim">Один конвейер. Ноль ручного труда.</span>
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-fog-dim">
            Каждый агент — независимый исполнитель со своей зоной ответственности
            и своим следом в журнале. Оркестратор передаёт файл по цепочке: если
            этап упал, видно где именно и почему.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fog-faint">
              форматы:
            </span>
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
                className="rounded border border-line bg-abyss-900/70 px-2 py-1 font-mono text-[10.5px] font-semibold transition-all hover:-translate-y-0.5"
                style={{ color: c, borderColor: `${c}40` }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* flow line */}
      <Reveal delay={120}>
        <svg className="mt-10 hidden h-8 w-full md:block" aria-hidden="true">
          <line
            x1="2%"
            y1="50%"
            x2="98%"
            y2="50%"
            stroke="#2fd8c3"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            className="flow-line"
          />
        </svg>
      </Reveal>

      <div className="mt-6 space-y-3.5 md:mt-2 md:space-y-4">
        {AGENT_LIST.map((a, i) => (
          <Reveal key={a.id} delay={i * 70} className={i % 2 === 1 ? "md:pl-16" : ""}>
            <div
              className="group grid gap-3 rounded-xl border border-line-soft bg-abyss-900/70 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-abyss-850 sm:grid-cols-[70px,220px,1fr] md:gap-6 md:p-6"
              style={{ borderLeft: `3px solid ${a.color}` }}
            >
              <div
                className="font-display text-[26px] font-bold leading-none transition-transform duration-300 group-hover:scale-110 md:text-[32px]"
                style={{ color: a.color }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: a.color }}
                  />
                  <h3 className="text-[16px] font-bold text-fog">{a.name}</h3>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fog-faint">
                  {a.role} · {a.short}
                </div>
              </div>
              <div>
                <p className="text-[13px] leading-relaxed text-fog-dim">{a.desc}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10.5px]">
                  <span className="rounded border border-line px-2 py-1 text-fog-dim">
                    вход: {a.input}
                  </span>
                  <IArrowRight size={11} style={{ color: a.color }} />
                  <span
                    className="rounded border px-2 py-1 font-semibold"
                    style={{
                      color: a.color,
                      borderColor: `${a.color}50`,
                      background: `${a.color}10`,
                    }}
                  >
                    выход: {a.output}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= integration ================= */

const tasksShort = `{
  "label": "maa: анализировать ./data",
  "type": "shell",
  "command": "npx maa analyze ./data --out ./reports",
  "group": { "kind": "build", "isDefault": true }
}`;

const cliShort = `# конвейер целиком
npx maa analyze ./data --out ./reports

# живой журнал агентов
npx maa logs --follow`;

export function IntegrationSection() {
  const points = [
    {
      icon: <ITerminal size={16} />,
      color: "#2fd8c3",
      title: "Задача сборки",
      text: "Ctrl+Shift+B поднимает конвейер; прогресс каждого агента течёт во встроенный терминал.",
    },
    {
      icon: <ICpu size={16} />,
      color: "#ffb454",
      title: "CLI в терминале",
      text: "npx maa analyze — для скриптов, CI и пакетной обработки каталогов: CSV, JSON, TXT, Word, Excel и PDF.",
    },
    {
      icon: <ILayers size={16} />,
      color: "#c997f0",
      title: "Отчёты в проводнике",
      text: "Результаты ложатся в ./reports: JSON для машин, Markdown для людей, размеченный исходник.",
    },
  ];
  return (
    <section id="vscode" className="relative z-10 mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr,1.1fr]">
        <Reveal>
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-orchidx">
              интеграция
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-fog sm:text-[34px]">
              Живёт там,
              <br />
              <span className="text-fog-dim">где живёт ваш код</span>
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-fog-dim">
              Система спроектирована под VS Code: конфиг агентов — в корне
              рабочей области, запуск — одной задачей или командой, журнал — в
              панели терминала.
            </p>
            <div className="mt-7 space-y-4">
              {points.map((p) => (
                <div key={p.title} className="flex gap-3.5">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{ color: p.color, borderColor: `${p.color}45`, background: `${p.color}0f` }}
                  >
                    {p.icon}
                  </span>
                  <div>
                    <div className="text-[14.5px] font-bold text-fog">{p.title}</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-fog-dim">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="#pult"
              className="group mt-8 inline-flex items-center gap-2 rounded-lg border border-line bg-abyss-850 px-4 py-2.5 font-mono text-[12px] font-semibold text-fog transition-all hover:border-amberx/60 hover:bg-abyss-800 hover:text-amberx"
            >
              попробовать в пульте
              <IArrowRight size={13} className="-rotate-90 transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className="space-y-4">
            <CodeBlock label=".vscode/tasks.json" lang="json" code={tasksShort} />
            <CodeBlock label="терминал vs code" lang="sh" code={cliShort} />
            <div className="rounded-lg border border-line-soft bg-abyss-900/60 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-faint">
                структура результатов
              </div>
              <pre className="mt-2 font-mono text-[12px] leading-relaxed text-fog-dim">
{`reports/
├─ sales_2024.analysis.json   ← метрики, аномалии, схема
├─ sales_2024.report.md       ← человекочитаемый отчёт
└─ sales_2024.annotated.csv   ← исходник с флагами строк`}
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= footer ================= */

export function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-line-soft">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <span className="font-display text-[12px] font-bold tracking-wide text-fog-dim">
            МУЛЬТИАГЕНТ<span className="text-amberx">/</span>АНАЛИТИКА
          </span>
        </div>
        <span className="font-mono text-[10.5px] text-fog-faint">
          анализ выполняется локально · файлы не покидают машину
        </span>
        <span className="ml-auto font-mono text-[10.5px] text-fog-faint">
          MAA v1.4.0 · 6 агентов · 2026
        </span>
      </div>
    </footer>
  );
}
