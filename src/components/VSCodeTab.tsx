import { CodeBlock } from "./ui";

const install = `# клонируем систему и ставим зависимости
git clone https://github.com/maa-labs/maa-vscode.git
cd maa-vscode && npm install

# открываем проект в редакторе
code .`;

const tasks = `{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "maa: анализировать ./data",
      "type": "shell",
      "command": "npx maa analyze ./data --out ./reports --agents all",
      "group": { "kind": "build", "isDefault": true },
      "presentation": { "reveal": "always", "panel": "dedicated" },
      "problemMatcher": ["$maa"]
    }
  ]
}`;

const cli = `# весь конвейер: приём → парсинг → аналитика → валидация → отчёт
npx maa analyze ./data --out ./reports

# только аналитика и валидация
npx maa analyze ./data --agents analytics,validator

# живой журнал агентов в терминале VS Code
npx maa logs --follow`;

const config = `{
  "pipeline": ["ingestion", "parser", "analytics", "validator", "reporter"],
  "formats": ["csv", "json", "txt", "docx", "doc", "xlsx", "xls", "pdf"],
  "parallel": 4,
  "retry": { "attempts": 2, "backoffMs": 800 },
  "outputs": ["*.analysis.json", "*.report.md", "*.annotated.*"],
  "rules": {
    "missingPctWarn": 2,
    "zScoreThreshold": 3,
    "duplicatesWarn": true
  }
}`;

const STEPS: { n: string; title: string; text: string }[] = [
  {
    n: "01",
    title: "Откройте проект в VS Code",
    text: "Система живёт в рабочей области VS Code: конфиг агентов, правила валидации и журнал — всё внутри редактора.",
  },
  {
    n: "02",
    title: "Ctrl+Shift+B → «maa: анализировать»",
    text: "Задача из tasks.json поднимает конвейер. Прогресс по каждому агенту виден во встроенном терминале.",
  },
  {
    n: "03",
    title: "Заберите проанализированные файлы",
    text: "На каждый вход — три выхода: analysis.json для машин, report.md для людей и размеченный исходник с флагами по строкам.",
  },
];

export function VSCodeTab() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amberx">
        интеграция · vscode
      </div>
      <h1 className="mt-1 font-display text-xl font-bold leading-tight text-fog sm:text-2xl">
        Запуск прямо из редактора
      </h1>
      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-fog-dim">
        Этот пульт — веб-лицо той же системы. В боевом режиме конвейер
        поднимается внутри VS Code: задача, CLI или конфиг ниже — и файлы из
        папки <span className="font-mono text-tealx">./data</span> (CSV, JSON,
        TXT, DOCX, DOC, XLSX, XLS, PDF) уходят в анализ, а результаты появляются
        в <span className="font-mono text-tealx">./reports</span>.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1.25fr]">
        <div className="space-y-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group rounded-xl border border-line-soft bg-abyss-850/50 p-4 transition-all hover:-translate-y-0.5 hover:border-line"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-lg font-bold text-amberx">{s.n}</span>
                <span className="text-[14px] font-semibold text-fog">{s.title}</span>
              </div>
              <p className="mt-1.5 pl-9 text-[12.5px] leading-relaxed text-fog-dim">{s.text}</p>
            </div>
          ))}
          <div className="rounded-xl border border-tealx/25 bg-tealx/[0.05] p-4">
            <p className="text-[12px] leading-relaxed text-fog-dim">
              <span className="font-semibold text-tealx">Примечание:</span> демо-анализ в этом
              пульте выполняется локально в браузере — файлы никуда не
              отправляются. Боевой CLI обрабатывает их на вашей машине так же.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <CodeBlock label="терминал" lang="sh" code={install} />
          <CodeBlock label=".vscode/tasks.json" lang="json" code={tasks} />
          <CodeBlock label="cli" lang="sh" code={cli} />
          <CodeBlock label="maa.config.json" lang="json" code={config} />
        </div>
      </div>
    </div>
  );
}
