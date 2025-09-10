import React, { useEffect, useMemo, useState } from "react";

// ------------------------------------------------------
// Info Overload Experiment – Pure JS/JSX (no TypeScript)
// - Modes: Baseline | Filtrerat | Adaptivt (stronger manipulations)
// - Tasks: Enskilt val | Rangordna
// - Measures: time, clicks, NASA‑TLX (0–20), rank-score
// ------------------------------------------------------

// Mode configs control intensity
const MODE_CONFIG = {
  baseline: { decoys: 3, collapseBodies: true, requireOpenForSingle: true, consolidate: false, microEverySec: 12, microJitterSec: 5, adaptiveReveal: false },
  filtered: { decoys: 1, collapseBodies: false, requireOpenForSingle: false, consolidate: true, microEverySec: 35, microJitterSec: 8, adaptiveReveal: false },
  adaptive: { decoys: 0, collapseBodies: false, requireOpenForSingle: false, consolidate: false, microEverySec: 0, microJitterSec: 0, adaptiveReveal: true },
};

const ModeNames = { baseline: "Baseline", filtered: "Filtrerat", adaptive: "Adaptivt" };
const TaskNames = { single: "Enskilt val", ranking: "Rangordna" };

// TLX dimensions (0–20)
const TLX_DIMENSIONS = [
  { key: "mental", label: "Mental Demand" },
  { key: "physical", label: "Physical Demand" },
  { key: "temporal", label: "Temporal Demand" },
  { key: "performance", label: "Perceived Performance" },
  { key: "effort", label: "Effort" },
  { key: "frustration", label: "Frustration" },
];

// ---------------------- SCENARIOS ----------------------
const SCENARIOS = [
  {
    id: "S1",
    title: "Kran & leveranskrock (Planering/Logistik)",
    background: "Du är platschef. I morgon 07:00–11:00 är mobilkranen bokad för prefabväggar Hus B. En armeringsleverans är aviserad ‘förmiddag’. Prefab kräver 2 h sammanhängande kranfönster. HSE-spärr i hisschakt 08:30–09:00.",
    artifacts: [
      { id: "a1", type: "email", time: "07:42", title: "TransportNord: Prefab Hus B anländer 08:00", body: "Lossning/montage ~2 h; sammanhängande kranfönster krävs.", priority: "High" },
      { id: "a2", type: "email", time: "07:49", title: "Stål & Armering: Chaufför 08:15–08:45", body: "6 buntar armering; kräver kranlyft.", priority: "Medium" },
      { id: "a3", type: "dashboard", title: "Kranbokning #KR-118", body: "07:00–11:00, prioritet Hög.", priority: "High" },
      { id: "a4", type: "notice", title: "HSE: El-avspärrning zon B2", body: "Hisschakt 08:30–09:00.", priority: "Medium" },
      { id: "a5", type: "chat", time: "07:55", title: "Arbetsledning (Teams)", body: "Prefab vill ha sammanhållen fönster 2 h, annars väntetid 1 h extra.", priority: "High", duplicateOf: "a1" },
    ],
    decisions: [
      { id: "A", label: "Dela kranen för armering 08:20.", rationale: "Bryter sammanhållet fönster för prefab.", correct: false },
      { id: "B", label: "Flytta armering till 11:15; kör prefab 08:00–10:00.", rationale: "Bevarar 2 h sammanhängande lyft, minimerar risk/väntetid.", correct: true },
      { id: "C", label: "Pausa prefab 08:30–09:00 för HSE, ta armering 08:15.", rationale: "Bryter fönstret; ökar total tid.", correct: false },
      { id: "D", label: "Avboka kranen 09:00–11:00 och boka om i morgon.", rationale: "Onödig omplanering.", correct: false },
    ],
    idealRanking: ["B", "C", "A", "D"],
    mustOpenIds: ["a1", "a3"],
    microNotices: [ { delayMs: 20000, text: "08:01: Armering ETA uppdaterad 08:12." } ],
  },
  {
    id: "S2",
    title: "Oskyddad öppning inför inspektion (HSE)",
    background: "Du är platschef. Öppning plan 4 zon C3 saknar räcke. Snickare vill fortsätta runt öppningen. Extern inspektion 13:00–14:00.",
    artifacts: [
      { id: "b1", type: "notice", time: "09:10", title: "HSE-avvikelse #HSE-204", body: "Oskyddad öppning C3, fallrisk >2 m. Bandspärr ej godtagbar.", priority: "High" },
      { id: "b2", type: "email", time: "09:22", title: "Snickarlagbas", body: "Vi kan sätta provisoriskt räcke efter lunch. Vill jobba fram till dess.", priority: "Medium" },
      { id: "b3", type: "dashboard", title: "Extern inspektion", body: "Idag 13:00–14:00.", priority: "Medium" },
      { id: "b4", type: "photo", title: "Foto – öppning C3", body: "Bild visar öppning; material 1,2 m från kant.", priority: "Low" },
    ],
    decisions: [
      { id: "A", label: "Fortsätt med bandspärr till 12:30; räcke efter lunch.", rationale: "Ej godtagbart skydd; risk kvarstår.", correct: false },
      { id: "B", label: "Stoppa zonen tills temporärt godkänt räcke är på plats (≤30 min).", rationale: "Omedelbar åtgärd före 13:00.", correct: true },
      { id: "C", label: "Flytta laget; lämna bandspärr till i morgon.", rationale: "Bandspärr fortfarande ogiltig.", correct: false },
      { id: "D", label: "Lägg skiva över öppningen och fortsätt.", rationale: "Ej verifierad klassning/åtgärd.", correct: false },
    ],
    idealRanking: ["B", "D", "C", "A"],
    mustOpenIds: ["b1", "b3"],
    microNotices: [ { delayMs: 15000, text: "09:26: Förråd: 2 räckessektioner finns (10 min)." } ],
  },
  {
    id: "S3",
    title: "Gjutplan & kyla (Betong)",
    background: "Bjälklagsgjutning planerad 13–17 (C30/37). Prognos: 0 °C kl 18, −3 °C kl 19–23. Pump bokad. Värmemattor 60 %; två varmluftsaggregat.",
    artifacts: [
      { id: "c1", type: "dashboard", time: "07:30", title: "Väderprognos", body: "0 °C kl 18, −3 °C kl 19–23.", priority: "Medium" },
      { id: "c2", type: "email", time: "07:40", title: "Betongstation", body: "Kan leverera kallvädersmix + accelerator från 09:30 (beställ senast 08:30).", priority: "High" },
      { id: "c3", type: "dashboard", title: "Resurser", body: "Värmemattor 60 % yta; 2 varmluftsaggregat.", priority: "Low" },
      { id: "c4", type: "dashboard", title: "Kvalitet – gjutprotokoll", body: "Krav: skydd tills ≥5 °C i betong under härdstart.", priority: "High" },
      { id: "c5", type: "dashboard", title: "Kostnad", body: "Pumpavbokning <2 h debiteras fullt.", priority: "Low" },
    ],
    decisions: [
      { id: "A", label: "Kör 13–17 med standardmix + mattor; plast över resten.", rationale: "Risk för otillräckligt skydd under härdstart.", correct: false },
      { id: "B", label: "Framför till 10:00 och beställ kallvädersmix; värme/mattor hela kvällen.", rationale: "Ökar sannolikheten för säker härdstart; minskar kallfogsrisk.", correct: true },
      { id: "C", label: "Dela ytan i två gjut (idag/i morgon) och acceptera kall fog.", rationale: "Kvalitetsrisk.", correct: false },
      { id: "D", label: "Ställ in 24 h (betala pump) och gjut i morgon.", rationale: "Försening + kostnad utan behov.", correct: false },
    ],
    idealRanking: ["B", "A", "C", "D"],
    mustOpenIds: ["c2", "c4"],
    microNotices: [ { delayMs: 18000, text: "07:55: Station bekräftar kallvädersmix om order nu." } ],
  },
];

// ---------------------- HELPERS ----------------------
function classNames(...xs) { return xs.filter(Boolean).join(" "); }
function prioRank(p) { return p === "High" ? 3 : p === "Medium" ? 2 : 1; }

export default function App() {
  const [mode, setMode] = useState("baseline");
  const [task, setTask] = useState("ranking");
  const [scenarioId, setScenarioId] = useState("S1");
  const scenario = useMemo(() => SCENARIOS.find(s => s.id === scenarioId), [scenarioId]);

  // State
  const [startedAt, setStartedAt] = useState(null);
  const [clicks, setClicks] = useState(0);
  const [adaptiveStep, setAdaptiveStep] = useState(0);
  const [decision, setDecision] = useState(null);
  const [ranking, setRanking] = useState(scenario.decisions.map(d => d.id));
  const [submittedRanking, setSubmittedRanking] = useState(false);
  const [microNotice, setMicroNotice] = useState(null);
  const [openedIds, setOpenedIds] = useState(new Set());

  // TLX (0–20)
  const [showTLX, setShowTLX] = useState(false);
  const [tlx, setTlx] = useState(() => Object.fromEntries(TLX_DIMENSIONS.map(d => [d.key, 10])));
  const [results, setResults] = useState([]);

  // Reset when scenario changes
  useEffect(() => { resetAll(); setRanking(scenario.decisions.map(d => d.id)); }, [scenarioId]);

  // Micro-notices generator according to mode intensity
  useEffect(() => {
    if (!startedAt) return;
    const cfg = MODE_CONFIG[mode];
    const timers = [];
    // Use scenario-provided notices
    scenario.microNotices?.forEach(m => timers.push(window.setTimeout(() => setMicroNotice(m.text), m.delayMs)));
    // Add synthetic stream for baseline/filtered
    if (cfg.microEverySec > 0) {
      let t = 0; for (let i = 0; i < 4; i++) { // up to 4 extra notices
        t += (cfg.microEverySec + (Math.random()*cfg.microJitterSec)) * 1000;
        timers.push(window.setTimeout(() => setMicroNotice(randomMicroNotice(scenario.id)), t));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [startedAt, mode, scenario]);

  function randomMicroNotice(sid) {
    const poolS1 = ["Slack: Port C blockerad i 10 min.", "Mail: Uppdaterad tidplan bilagd.", "Vakt: Besökare anmäld vid grind."]; 
    const poolS2 = ["HSE-bot: Påminnelse om skyddsskor.", "SMS: Leverans ny tid 11:05.", "Mail: Ny checklista vecka 37."]; 
    const poolS3 = ["Väder: Vindby 12 m/s 14:30.", "SMS: Pumpföraren undrar om plats för slang.", "Mail: Betongprov tagna i går – svar inkommit."]; 
    const pools = { S1: poolS1, S2: poolS2, S3: poolS3 };
    const arr = pools[sid] || poolS1; return arr[Math.floor(Math.random()*arr.length)];
  }

  function resetAll() {
    setStartedAt(null); setClicks(0); setDecision(null); setSubmittedRanking(false);
    setAdaptiveStep(0); setMicroNotice(null); setOpenedIds(new Set());
    setTlx(Object.fromEntries(TLX_DIMENSIONS.map(d => [d.key, 10])));
  }

  function ensureStarted() { if (!startedAt) setStartedAt(Date.now()); }
  function startScenario() { resetAll(); setStartedAt(Date.now()); }

  // Artifact open/close
  function toggleOpen(id) { ensureStarted(); setOpenedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); setClicks(c => c + 1); }

  // Decision / Ranking
  function handleDecision(d) { if (!startedAt) return; setDecision(d); setShowTLX(true); }
  function move(id, dir) { ensureStarted(); setRanking(prev => { const arr = [...prev]; const i = arr.indexOf(id); const j = dir === "up" ? i-1 : i+1; if (i<0||j<0||j>=arr.length) return arr; [arr[i], arr[j]]=[arr[j],arr[i]]; return arr; }); }
  function submitRanking() { ensureStarted(); setSubmittedRanking(true); setDecision({ id: "RANK", label: "Rangordning insänd", rationale: "", correct: scenario?.idealRanking ? ranking[0] === scenario.idealRanking[0] : undefined }); setShowTLX(true); }

  function computePairwiseScore(ideal, given) { if (!ideal || !given || ideal.length !== given.length) return null; let agree=0,total=0; for (let i=0;i<ideal.length;i++){ for(let j=i+1;j<ideal.length;j++){ total++; const ai=ideal[i],aj=ideal[j]; const gi=given.indexOf(ai),gj=given.indexOf(aj); if(gi<gj) agree++; } } return Math.round((agree/total)*100); }

  function recordTLX() {
    if (!startedAt) return; const elapsedMs = Date.now()-startedAt; const tlxAvg20 = Object.values(tlx).reduce((a,b)=>a+Number(b),0)/TLX_DIMENSIONS.length;
    const row = { scenario: scenario.title, mode, task, choice: task==="single"?decision?.id:undefined, ranking: task==="ranking"?[...ranking]:undefined, correct: task==="single"?!!decision?.correct:undefined, rank_score_pct: task==="ranking"?computePairwiseScore(scenario.idealRanking, ranking):undefined, time_sec: Math.round(elapsedMs/1000), clicks, tlx, tlx_avg_20: Math.round(tlxAvg20), timestamp: new Date().toISOString() };
    setResults(prev => [row, ...prev]); setShowTLX(false);
  }

  function exportJSON() { const data = JSON.stringify(results, null, 2); const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "experiment_results.json"; a.click(); URL.revokeObjectURL(url); }

  // Render artifacts with mode manipulations
  const renderedArtifacts = useMemo(() => {
    const cfg = MODE_CONFIG[mode];
    let arr = [...scenario.artifacts];

    // Inject decoys (increase load)
    const decoys = generateDecoysForScenario(scenario.id, cfg.decoys);
    arr = [...arr, ...decoys];

    // Consolidate duplicates for filtered only
    if (cfg.consolidate) {
      const map = new Map();
      for (const art of arr) {
        const key = art.duplicateOf ? art.duplicateOf : art.id;
        if (!map.has(key)) map.set(key, { ...art, id: key, title: art.duplicateOf ? `${art.title} (konsoliderad)` : art.title });
      }
      arr = Array.from(map.values());
    }

    // Adaptive reveal: show only top priority items incrementally
    if (cfg.adaptiveReveal) {
      const sorted = [...arr].sort((a,b)=>prioRank(b.priority)-prioRank(a.priority));
      arr = sorted.slice(0, Math.min(sorted.length, 1 + adaptiveStep));
    }

    // Sort by priority for baseline/filtered too (stable)
    arr = arr.sort((a,b)=>prioRank(b.priority)-prioRank(a.priority));
    return arr;
  }, [scenario, mode, adaptiveStep]);

  // UI helpers
  function withClick(fn){ return ((...args)=>{ setClicks(c=>c+1); return fn(...args); }); }
  const cfg = MODE_CONFIG[mode];
  const mustOpenOk = !cfg.requireOpenForSingle || (scenario.mustOpenIds?.every(id => openedIds.has(id)));

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Info Overload Experiment</h1>
            <p className="text-sm text-slate-600">Tre scenarier • Tre lägen • Enskilt val eller rangordning • TLX (0–20)</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Segmented opts={ModeNames} value={mode} onChange={withClick(setMode)} />
            <Segmented opts={TaskNames} value={task} onChange={withClick(setTask)} />
            <ScenarioPicker value={scenarioId} onChange={withClick(setScenarioId)} />
            <button onClick={withClick(startScenario)} className="px-4 py-2 rounded-2xl bg-slate-900 text-white">Starta scenario</button>
            <button onClick={withClick(resetAll)} className="px-4 py-2 rounded-2xl border">Återställ</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-4">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{scenario.title}</h2>
                  <p className="text-sm text-slate-700 mt-1">{scenario.background}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-mono">{ModeNames[mode]} • {TaskNames[task]}</div>
                  <Timer startedAt={startedAt} decision={decision} />
                  <div className="text-slate-500">Klick: {clicks}</div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderedArtifacts.map(a => (
                <ArtifactCard key={a.id + mode + adaptiveStep}
                  art={a}
                  collapsed={cfg.collapseBodies && !a.decoy}
                  opened={openedIds.has(a.id)}
                  onToggle={() => toggleOpen(a.id)}
                />
              ))}
            </div>

            {MODE_CONFIG[mode].adaptiveReveal && (
              <div className="flex gap-3">
                <button onClick={withClick(()=>setAdaptiveStep(s=>s+1))} className="px-3 py-2 rounded-xl border">Visa mer</button>
                <button onClick={withClick(()=>setAdaptiveStep(s=>Math.max(0,s-1)))} className="px-3 py-2 rounded-xl border">Visa mindre</button>
              </div>
            )}

            {microNotice && (<Card intent="info"><div className="text-sm">{microNotice}</div></Card>)}
          </section>

          <aside className="space-y-4">
            <Card>
              <h3 className="text-base font-semibold mb-2">Beslut</h3>
              {task === "single" && (
                <div className="space-y-2">
                  {scenario.decisions.map(d => (
                    <button key={d.id} onClick={withClick(()=>handleDecision(d))}
                      disabled={!mustOpenOk}
                      className={classNames("w-full text-left px-3 py-2 rounded-xl border", !mustOpenOk && "opacity-50 cursor-not-allowed")}
                    >
                      <div className="font-medium">{d.id}. {d.label}</div>
                    </button>
                  ))}
                  {!mustOpenOk && (
                    <p className="text-xs text-rose-600 mt-2">Öppna först nyckelkorten: {(scenario.mustOpenIds||[]).join(", ")}.</p>
                  )}
                </div>
              )}

              {task === "ranking" && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Rangordna åtgärderna (1 = bäst). Flytta upp/ner tills du är nöjd.</p>
                  <ol className="space-y-2">
                    {ranking.map((id, i) => {
                      const d = scenario.decisions.find(x => x.id === id);
                      return (
                        <li key={id} className="flex items-center gap-2">
                          <span className="w-6 text-right text-slate-500">{i + 1}.</span>
                          <div className="flex-1 px-3 py-2 rounded-xl border bg-white">{id}. {d?.label}</div>
                          <div className="flex gap-1">
                            <button onClick={withClick(()=>move(id, "up"))} disabled={i===0} className="px-2 py-1 rounded-lg border">↑</button>
                            <button onClick={withClick(()=>move(id, "down"))} disabled={i===ranking.length-1} className="px-2 py-1 rounded-lg border">↓</button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <button onClick={withClick(submitRanking)} disabled={submittedRanking} className="mt-3 w-full px-3 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50">Skicka rangordning</button>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="text-base font-semibold mb-2">Resultat</h3>
              <div className="text-sm space-y-1">
                <div><span className="text-slate-500">Scenario:</span> {scenario.title}</div>
                <div><span className="text-slate-500">Läge:</span> {ModeNames[mode]}</div>
                <div><span className="text-slate-500">Uppgift:</span> {TaskNames[task]}</div>
                <div><span className="text-slate-500">Klick:</span> {clicks}</div>
              </div>
              <button onClick={withClick(exportJSON)} className="mt-3 px-3 py-2 rounded-xl border w-full">Ladda ner JSON</button>
            </Card>

            <Card>
              <h3 className="text-base font-semibold mb-2">Instruktion</h3>
              <p className="text-sm text-slate-700">Baseline visar fler kort, dubbletter och distraktorer samt fler notiser. Filtrerat konsoliderar och minskar brus. Adaptivt visar endast rätt information vid rätt tidpunkt. TLX-skala 0–20.</p>
            </Card>
          </aside>
        </div>
      </div>

      {/* TLX Modal */}
      {showTLX && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">NASA‑TLX (0–20)</h3>
              <button onClick={withClick(()=>setShowTLX(false))} className="px-3 py-1 rounded-xl border">Stäng</button>
            </div>
            <p className="text-sm text-slate-600 mt-1">Skatta 0–20 för varje dimension (heltal).</p>
            <div className="mt-4 space-y-4">
              {TLX_DIMENSIONS.map(d => (
                <div key={d.key} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4 text-sm">{d.label}</div>
                  <input type="range" min={0} max={20} step={1} value={tlx[d.key]}
                         onChange={e => setTlx(x => ({ ...x, [d.key]: Number(e.target.value) }))}
                         className="col-span-7" />
                  <div className="col-span-1 text-right font-mono text-sm">{tlx[d.key]}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={withClick(recordTLX)} className="px-4 py-2 rounded-2xl bg-slate-900 text-white">Spara</button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto p-6">
        {results.length > 0 && (
          <div className="overflow-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {"Scenario,Läge,Uppgift,Val,Rangordning,Correct,Rank‑score (%),Tid (s),Klick,TLX‑avg (0–20),Tidsstämpel".split(",").map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{r.scenario}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{ModeNames[r.mode]}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{TaskNames[r.task]}</td>
                    <td className="px-3 py-2">{r.choice ?? "–"}</td>
                    <td className="px-3 py-2">{Array.isArray(r.ranking) ? r.ranking.join(" → ") : "–"}</td>
                    <td className="px-3 py-2">{r.correct === undefined ? "–" : (r.correct ? "Ja" : "Nej")}</td>
                    <td className="px-3 py-2">{r.rank_score_pct ?? "–"}</td>
                    <td className="px-3 py-2">{r.time_sec}</td>
                    <td className="px-3 py-2">{r.clicks}</td>
                    <td className="px-3 py-2">{r.tlx_avg_20}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">Manipulationsöversikt: Baseline ≈ 12–15 kort (inkl. dubbletter + ~3 decoys) och notiser ~var 10–17 s. Filtrerat ≈ 6–8 kort (1 decoy) och få notiser. Adaptivt ≈ 3–5 kort, endast just‑in‑time, inga decoys.</p>
      </footer>
    </div>
  );
}

// ---------------------- SUBCOMPONENTS ----------------------
function Segmented({ opts, value, onChange }) {
  const keys = Object.keys(opts);
  return (
    <div className="inline-flex rounded-2xl border p-1 bg-white">
      {keys.map(k => (
        <button key={k} onClick={() => onChange(k)} className={classNames("px-3 py-1 rounded-2xl text-sm", value === k ? "bg-slate-900 text-white" : "hover:bg-slate-100")}>{opts[k]}</button>
      ))}
    </div>
  );
}

function ScenarioPicker({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="px-3 py-2 rounded-2xl border bg-white">
      {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
    </select>
  );
}

function Timer({ startedAt, decision }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!startedAt || decision) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [startedAt, decision]);
  if (!startedAt) return <div className="text-slate-500">Tid: –</div>;
  const sec = Math.round(((now) - startedAt) / 1000);
  return <div className="font-mono">Tid: {sec}s</div>;
}

function ArtifactCard({ art, collapsed, opened, onToggle }) {
  const badge = art.priority ? <span className={classNames("text-xs px-2 py-0.5 rounded-full border", art.priority === "High" ? "border-rose-300 bg-rose-50 text-rose-700" : art.priority === "Medium" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-50 text-slate-600")}>{art.priority}</span> : null;
  const map = { email: "✉️", dashboard: "📊", notice: "⚠️", chat: "💬", photo: "🖼️", drawing: "📐" };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" title={art.type}>{map[art.type]}</span>
          <div>
            <div className="font-medium leading-tight">{art.title}{art.decoy && <span className="ml-2 text-xs text-slate-400">(info)</span>}</div>
            {art.time && <div className="text-xs text-slate-500">{art.time}</div>}
          </div>
        </div>
        {badge}
      </div>
      {art.body && (
        <>
          {collapsed && !opened ? (
            <button onClick={onToggle} className="mt-2 text-sm underline">Öppna</button>
          ) : (
            <p className="text-sm text-slate-700 mt-2">{art.body}</p>
          )}
        </>
      )}
      {collapsed && opened && (
        <button onClick={onToggle} className="mt-2 text-xs text-slate-500 underline">Stäng</button>
      )}
    </Card>
  );
}

function Card({ children, intent }) {
  return (
    <div className={classNames("rounded-3xl border p-4 bg-white shadow-sm", intent === "info" && "border-sky-200 bg-sky-50")}>{children}</div>
  );
}

// ---------- Utilities ----------
function generateDecoysForScenario(sid, n) {
  if (n <= 0) return [];
  const pools = {
    S1: [
      { id: "dx1", type: "chat", title: "Kaffeautomat ur funktion", body: "Matsalen: problem rapporterat.", priority: "Low", decoy: true },
      { id: "dx2", type: "email", title: "Parkeringstillstånd", body: "Påminnelse: förnya P-tillstånd före fredag.", priority: "Low", decoy: true },
      { id: "dx3", type: "dashboard", title: "Allmänt: Städning trapphus B", body: "Skift flyttat till 15:00.", priority: "Low", decoy: true },
      { id: "dx4", type: "chat", title: "Leverans port D (annan entreprenör)", body: "ETA 09:10 – ej relevant för Hus B.", priority: "Low", decoy: true },
    ],
    S2: [
      { id: "dy1", type: "email", title: "Ny checklista vecka 37", body: "Uppdaterad mall i Sharepoint.", priority: "Low", decoy: true },
      { id: "dy2", type: "chat", title: "Personalfråga", body: "En timbankfråga från snickare.", priority: "Low", decoy: true },
      { id: "dy3", type: "dashboard", title: "Fika-leverans", body: "Kanelbullar kl. 14:30.", priority: "Low", decoy: true },
    ],
    S3: [
      { id: "dz1", type: "email", title: "Elavbrott i kontorsbaracken?", body: "Kortvarigt avbrott rapporterat 16:30.", priority: "Low", decoy: true },
      { id: "dz2", type: "chat", title: "Skyltar för visning", body: "Behöver flyttas till entré A i morgon.", priority: "Low", decoy: true },
      { id: "dz3", type: "dashboard", title: "Allmänt: Postleverans", body: "Paket lämnat i receptionen.", priority: "Low", decoy: true },
    ],
  };
  const list = pools[sid] || [];
  return list.slice(0, n).map((a, i) => ({ ...a, id: a.id + "_" + i }));
}