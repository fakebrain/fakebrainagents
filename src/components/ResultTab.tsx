import { CsvAnalysis, JsonAnalysis, MaaFile, OutputFile, TxtAnalysis, fmtBytes, fmtNum } from "../lib/types";
import { IAlert, IDownload } from "./icons";
import { KindBadge, Ring, StatChip } from "./ui";

const qColor = (q: number) => (q >= 80 ? "#a9e35f" : q >= 55 ? "#ffb454" : "#ff7a6b");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-fog-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CsvBody({ a }: { a: CsvAnalysis }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatChip label="Строк" value={fmtNum(a.rows)} />
        <StatChip label="Колонок" value={a.cols} />
        <StatChip
          label="Пропусков"
          value={`${a.totalMissing}`}
          color={a.totalMissing ? "#ffb454" : "#a9e35f"}
        />
        <StatChip
          label="Дубликатов"
          value={a.duplicates}
          color={a.duplicates ? "#ffb454" : "#a9e35f"}
        />
        <StatChip
          label="Выбросов"
          value={a.anomalies.length}
          color={a.anomalies.length ? "#ff7a6b" : "#a9e35f"}
        />
        <StatChip
          label={a.sheet ? "Лист книги" : "Разделитель"}
          value={
            a.sheet
              ? `«${a.sheet}»`
              : a.delimiter === "\t"
              ? "TAB"
              : a.delimiter === "Excel"
              ? "—"
              : `«${a.delimiter}»`
          }
          color={a.sheet ? "#a9e35f" : undefined}
        />
      </div>

      <Section title="статистика по колонкам">
        <div className="overflow-x-auto rounded-lg border border-line-soft">
          <table className="w-full min-w-[680px] border-collapse font-mono text-[11.5px]">
            <thead>
              <tr className="bg-abyss-850 text-left text-[10px] uppercase tracking-wider text-fog-faint">
                {["Колонка", "Тип", "Пропуски", "Уник.", "Min", "Max", "Среднее", "Топ значений"].map((h) => (
                  <th key={h} className="border-b border-line px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.columns.map((c) => (
                <tr key={c.name} className="border-b border-line-soft last:border-0 transition-colors hover:bg-abyss-850/60">
                  <td className="px-3 py-2 font-semibold text-fog">{c.name}</td>
                  <td className="px-3 py-2 text-tealx">{c.type}</td>
                  <td className="px-3 py-2" style={{ color: c.missing ? "#ffb454" : "#a9e35f" }}>
                    {c.missing} ({fmtNum(c.missingPct)}%)
                  </td>
                  <td className="px-3 py-2 text-fog-dim">{c.unique}</td>
                  <td className="px-3 py-2 text-fog-dim">{c.min !== undefined ? fmtNum(c.min) : "—"}</td>
                  <td className="px-3 py-2 text-fog-dim">{c.max !== undefined ? fmtNum(c.max) : "—"}</td>
                  <td className="px-3 py-2 text-fog-dim">{c.mean !== undefined ? fmtNum(c.mean) : "—"}</td>
                  <td className="px-3 py-2 text-fog-faint">
                    {c.top ? c.top.map((t) => `${t.value} ×${t.count}`).join(" · ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {a.anomalies.length > 0 && (
        <Section title="выбросы · |z| > 3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {a.anomalies.map((an, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-md border border-coralx/25 bg-coralx/[0.05] px-3 py-2 font-mono text-[11.5px]"
              >
                <span className="text-coralx">
                  <IAlert size={13} />
                </span>
                <span className="text-fog-dim">строка {an.row}:</span>
                <span className="truncate text-fog">
                  {an.column} = <b className="text-coralx">{an.value}</b>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="превью данных">
        <div className="overflow-x-auto rounded-lg border border-line-soft">
          <table className="w-full border-collapse font-mono text-[11px]">
            <tbody>
              {a.preview.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-abyss-850" : "border-t border-line-soft hover:bg-abyss-850/50"}>
                  {row.map((cell, ci) =>
                    ri === 0 ? (
                      <th key={ci} className="whitespace-nowrap px-3 py-1.5 text-left font-semibold text-amberx">
                        {cell}
                      </th>
                    ) : (
                      <td key={ci} className={cell.trim() === "" ? "bg-amberx/[0.06] px-3 py-1.5 text-amberx" : "whitespace-nowrap px-3 py-1.5 text-fog/80"}>
                        {cell.trim() === "" ? "∅" : cell}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function JsonBody({ a }: { a: JsonAnalysis }) {
  const counts = Object.entries(a.counts).filter(([, v]) => v > 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatChip label="Корень" value={a.rootType} color="#ffb454" />
        <StatChip label="Глубина" value={a.depth} />
        <StatChip label="Узлов" value={fmtNum(a.totalNodes)} />
        {a.arrayLen !== null && <StatChip label="Элементов" value={a.arrayLen} color="#2fd8c3" />}
        {counts.map(([k, v]) => (
          <StatChip key={k} label={`Узлов: ${k}`} value={fmtNum(v)} />
        ))}
      </div>

      {a.schema.length > 0 && (
        <Section
          title={
            a.schemaSource
              ? `схема элемента · ${a.schemaSource}[i]`
              : a.arrayLen !== null
              ? "схема элемента"
              : "схема объекта"
          }
        >
          <div className="overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[420px] border-collapse font-mono text-[11.5px]">
              <thead>
                <tr className="bg-abyss-850 text-left text-[10px] uppercase tracking-wider text-fog-faint">
                  {["Ключ", "Тип", "Покрытие"].map((h) => (
                    <th key={h} className="border-b border-line px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.schema.map((s) => (
                  <tr key={s.key} className="border-b border-line-soft last:border-0 hover:bg-abyss-850/60">
                    <td className="px-3 py-2 font-semibold text-fog">{s.key}</td>
                    <td className="px-3 py-2 text-tealx">{s.type}</td>
                    <td className="px-3 py-2 text-fog-dim">{s.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {a.missing.length > 0 && (
        <Section title="отсутствующие ключи">
          <div className="space-y-1.5">
            {a.missing.map((m) => (
              <div
                key={m.key}
                className="flex items-center gap-2.5 rounded-md border border-amberx/25 bg-amberx/[0.05] px-3 py-2 font-mono text-[11.5px]"
              >
                <span className="text-amberx">
                  <IAlert size={13} />
                </span>
                <span className="text-fog">«{m.key}»</span>
                <span className="text-fog-dim">
                  отсутствует в {m.missing} из {m.total} элементов
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="частотность ключей">
        <div className="flex flex-wrap gap-1.5">
          {a.topKeys.map((k) => (
            <span
              key={k.key}
              className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-fog-dim transition-colors hover:border-amberx/50 hover:text-fog"
            >
              {k.key} <span className="text-amberx">×{k.count}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section title="превью документа">
        <pre className="max-h-72 overflow-auto rounded-lg border border-line-soft bg-abyss-950/60 p-4 font-mono text-[11px] leading-relaxed text-fog/85">
          {a.preview}
          {a.preview.length >= 1400 ? "\n…" : ""}
        </pre>
      </Section>
    </>
  );
}

function TxtBody({ a }: { a: TxtAnalysis }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatChip label="Слов" value={fmtNum(a.words)} />
        <StatChip label="Уникальных" value={fmtNum(a.uniqueWords)} color="#2fd8c3" />
        <StatChip label="Предложений" value={a.sentences} />
        <StatChip label="Строк" value={a.lines} />
        <StatChip label="Ср. предложение" value={`${fmtNum(a.avgSentenceLen)} сл.`} />
        <StatChip label="Чтение" value={`~${a.readingMin} мин`} color="#ffb454" />
      </div>

      <Section title="ключевые слова">
        <div className="flex flex-wrap gap-1.5">
          {a.keywords.map((k, i) => (
            <span
              key={k.word}
              className="rounded-full border px-3 py-1.5 font-mono text-[11.5px] transition-all hover:-translate-y-0.5"
              style={{
                borderColor: `${i < 3 ? "#56c8ff" : "#1e2a3e"}${i < 3 ? "66" : ""}`,
                color: i < 3 ? "#56c8ff" : "#8394ad",
                background: i < 3 ? "rgba(86,200,255,.07)" : "transparent",
              }}
            >
              {k.word} <span className="opacity-70">×{k.count}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section title="фрагмент текста">
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line-soft bg-abyss-950/60 p-4 font-mono text-[11.5px] leading-relaxed text-fog/85">
          {a.excerpt}
          {a.excerpt.length >= 700 ? "…" : ""}
        </pre>
      </Section>
    </>
  );
}

export function ResultTab({
  file,
  onDownload,
}: {
  file: MaaFile;
  onDownload: (o: OutputFile) => void;
}) {
  const a = file.analysis;
  if (!a) return null;
  const color = qColor(a.quality);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-5">
        <Ring value={a.quality} color={color} />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <KindBadge kind={file.kind} big />
            <h1 className="truncate font-mono text-lg font-semibold text-fog sm:text-xl">
              {file.name}
            </h1>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-fog-faint">
            <span>{fmtBytes(file.size)}</span>
            {file.ms !== undefined && <span>обработан за {(file.ms / 1000).toFixed(1)} с</span>}
            {a.kind === "csv" && a.sheet && <span className="text-limex">лист: {a.sheet}</span>}
            {a.kind === "txt" && a.sourceNote && <span className="text-skyx">{a.sourceNote}</span>}
            {file.meta?.legacy && <span className="text-amberx">legacy-извлечение</span>}
            <span>агентов: 6</span>
            <span style={{ color }}>
              качество: {a.quality >= 80 ? "высокое" : a.quality >= 55 ? "среднее" : "низкое"}
            </span>
          </div>
        </div>
      </div>

      {/* downloads */}
      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {file.outputs.map((o, i) => (
          <button
            key={o.name}
            onClick={() => onDownload(o)}
            className="group flex items-center gap-3 rounded-lg border border-line-soft bg-abyss-850/60 px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-orchidx/50 hover:bg-abyss-800"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orchidx/10 font-mono text-[9px] font-bold uppercase text-orchidx">
              {i === 0 ? "json" : i === 1 ? "md" : "src"}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-[12px] font-medium text-fog">
                {o.name}
              </span>
              <span className="block text-[10.5px] text-fog-faint">
                {i === 0 ? "машиночитаемый анализ" : i === 1 ? "отчёт для людей" : "размеченный исходник"} · {fmtBytes(o.size)}
              </span>
            </span>
            <IDownload
              size={15}
              className="ml-auto shrink-0 text-fog-faint transition-all group-hover:translate-y-0.5 group-hover:text-orchidx"
            />
          </button>
        ))}
      </div>

      {/* body by kind */}
      {a.kind === "csv" && <CsvBody a={a} />}
      {a.kind === "json" && <JsonBody a={a} />}
      {a.kind === "txt" && <TxtBody a={a} />}

      {/* issues */}
      <Section title="замечания валидатора">
        {file.issues.length === 0 ? (
          <p className="rounded-lg border border-limex/25 bg-limex/[0.05] px-4 py-3 font-mono text-[12px] text-limex">
            ✓ Замечаний нет — данные прошли все правила качества.
          </p>
        ) : (
          <div className="space-y-1.5">
            {file.issues.map((i) => (
              <div
                key={i.id}
                className="flex items-start gap-2.5 rounded-md border border-amberx/20 bg-amberx/[0.04] px-3 py-2 text-[12px] leading-relaxed text-fog/85"
              >
                <span className="mt-0.5 shrink-0 text-amberx">
                  <IAlert size={13} />
                </span>
                {i.text}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
