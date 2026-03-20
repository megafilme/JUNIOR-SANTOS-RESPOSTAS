import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import TruckScene from "./components/TruckScene";
import JustificativaCard from "./components/JustificativaCard";
import PlanilhaWorker from "./workers/planilha.worker?worker";

// ─── tipos ────────────────────────────────────────────────────────────────────
type PlanilhaRow = Record<string, string>;

type WorkerOutMsg =
  | { type: "parsed"; rows: PlanilhaRow[]; cabecalhos: string[] }
  | { type: "progress"; done: number; total: number; batch: string[] }
  | { type: "done"; total: number }
  | { type: "error"; message: string };

// ─── hook do worker ───────────────────────────────────────────────────────────
function useWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new PlanilhaWorker();
    return () => workerRef.current?.terminate();
  }, []);

  return workerRef;
}

// ─── gerador de texto colado (roda na thread principal — é rápido) ────────────
function gerarDeTexto(lines: string[]): string[] {
  const FECHOS = [
    "Movimentação necessária para continuidade das operações da unidade.",
    "Ação essencial para suporte logístico e administrativo da unidade.",
    "Necessário para regularização e atendimento da demanda registrada.",
    "Essencial para garantir o fluxo operacional e atendimento ao solicitante.",
    "Movimentação autorizada conforme necessidade operacional vigente.",
    "Atendimento realizado dentro dos parâmetros logísticos estabelecidos.",
    "Demanda cumprida em conformidade com o processo interno da unidade.",
  ];

  function ext(line: string, keys: string[]): string {
    for (const key of keys) {
      const r = new RegExp(key + "[:\\s]+([^|\\n;,]{2,60})", "i");
      const m = line.match(r);
      if (m) return m[1].trim();
    }
    return "";
  }

  function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  return lines.map((line, idx) => {
    const coleta = ext(line, ["coleta", "origem", "retirada"]);
    const entrega = ext(line, ["entrega", "destino"]);
    const material = ext(line, ["material", "item", "produto", "carga"]);
    const motorista = ext(line, ["motorista", "condutor"]);
    const veiculo = ext(line, ["veiculo", "placa", "frota"]);
    const solicitante = ext(line, ["solicitante", "solicitado por", "aprovado por"]);
    const st =
      ext(line, ["st", "ocorrencia", "chamado"]) ||
      (line.match(/\bst[:\s#-]*(\d{4,7})\b/i) || [])[1] || "";
    const ordemInterna =
      ext(line, ["ordem interna", "ordem"]) ||
      (line.match(/\b([A-Z]{2}\d{2}[A-Z]\d{4})\b/) || [])[1] || "";
    const valor =
      ext(line, ["valor", "total"]) ||
      (line.match(/R\$[\s]?[\d.,]+/i) || [])[0] || "";
    const email = (line.match(/[\w.+-]+@electrolux\.com\.br/i) || [])[0] || "";
    const debora = /d[eé]bora/i.test(line);

    const ls: string[] = [];
    if (material && coleta && entrega)
      ls.push(`Coleta e entrega de ${material.toLowerCase()}, saída de ${cap(coleta)} e destino em ${cap(entrega)}.`);
    else if (coleta && entrega)
      ls.push(`Coleta e entrega de material com saída de ${cap(coleta)} e destino em ${cap(entrega)}.`);
    else if (material)
      ls.push(`Movimentação de ${material.toLowerCase()} conforme demanda registrada.`);
    else if (coleta)
      ls.push(`Coleta de material realizada em ${cap(coleta)}.`);
    else if (entrega)
      ls.push(`Entrega de material realizada em ${cap(entrega)}.`);
    else
      ls.push(`Movimentação operacional necessária para suporte à unidade.`);

    const infos: string[] = [];
    if (veiculo) infos.push(`Veículo/Placa: ${veiculo}`);
    if (motorista) infos.push(`Motorista: ${cap(motorista)}`);
    if (infos.length) ls.push(infos.join(" · ") + ".");

    if (st || ordemInterna) {
      const reg: string[] = [];
      if (st) reg.push(`Ocorrência/ST nº ${st}`);
      if (ordemInterna) reg.push(`Ordem Interna: ${ordemInterna}`);
      ls.push(`Atendimento referente a: ${reg.join(" | ")}.`);
    }

    if (debora && email) ls.push(`Solicitado e aprovado por Débora Alvelino (${email}).`);
    else if (debora) ls.push(`Solicitado e aprovado por Débora Alvelino.`);
    else if (solicitante) ls.push(`Solicitado por ${cap(solicitante)}.`);
    else if (email) ls.push(`Solicitação recebida via ${email}.`);

    if (valor) ls.push(`Valor envolvido: ${valor.startsWith("R$") ? valor : `R$ ${valor}`}.`);
    ls.push(FECHOS[idx % FECHOS.length]);
    return ls.join("\n");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const workerRef = useWorker();

  const [pastedText, setPastedText] = useState("");
  const [justificativas, setJustificativas] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "colar">("upload");
  const [error, setError] = useState("");
  const [copyAllDone, setCopyAllDone] = useState(false);

  // estados da planilha
  const [fileName, setFileName] = useState("");
  const [planilhaRows, setPlanilhaRows] = useState<PlanilhaRow[]>([]);
  const [planilhaCabecalhos, setPlanilhaCabecalhos] = useState<string[]>([]);
  const [planilhaPreview, setPlanilhaPreview] = useState<PlanilhaRow[]>([]);

  // progresso
  const [phase, setPhase] = useState<"idle" | "parsing" | "generating" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // ── Leitura do arquivo via Worker ─────────────────────────────────────────
  const processFile = useCallback(
    (file: File) => {
      setError("");
      setJustificativas([]);
      setPlanilhaRows([]);
      setPlanilhaCabecalhos([]);
      setPlanilhaPreview([]);
      setFileName(file.name);
      setPhase("parsing");
      setProgress({ done: 0, total: 0 });

      const worker = workerRef.current;
      if (!worker) return;

      // remove listener anterior
      worker.onmessage = null;

      worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
        const msg = e.data;
        if (msg.type === "parsed") {
          setPlanilhaRows(msg.rows);
          setPlanilhaCabecalhos(msg.cabecalhos);
          setPlanilhaPreview(msg.rows.slice(0, 5));
          setPhase("idle");
        } else if (msg.type === "error") {
          setError(msg.message);
          setPhase("idle");
        }
      };

      const reader = new FileReader();
      reader.onload = (ev) => {
        worker.postMessage(
          { type: "parse", buffer: ev.target!.result as ArrayBuffer, fileName: file.name },
          [ev.target!.result as ArrayBuffer]
        );
      };
      reader.readAsArrayBuffer(file);
    },
    [workerRef]
  );

  const onDrop = useCallback(
    (accepted: File[]) => { if (accepted.length > 0) processFile(accepted[0]); },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
  });

  // ── Gerar da planilha via Worker (chunks) ─────────────────────────────────
  const handleGerarDaPlanilha = useCallback(() => {
    if (planilhaRows.length === 0) { setError("Carregue uma planilha antes de gerar."); return; }

    const worker = workerRef.current;
    if (!worker) return;

    setError("");
    setJustificativas([]);
    setPhase("generating");
    setProgress({ done: 0, total: planilhaRows.length });

    const acumuladas: string[] = [];

    worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        acumuladas.push(...msg.batch);
        setProgress({ done: msg.done, total: msg.total });
        // Atualiza os cards enquanto processa (streaming de resultados)
        setJustificativas([...acumuladas]);
      } else if (msg.type === "done") {
        setPhase("done");
        setTimeout(() => setPhase("idle"), 1500);
      } else if (msg.type === "error") {
        setError(msg.message);
        setPhase("idle");
      }
    };

    // Chunk size adaptativo: planilhas grandes usam chunks maiores no worker
    const chunkSize = planilhaRows.length > 500 ? 80 : planilhaRows.length > 100 ? 40 : 20;

    worker.postMessage({ type: "generate", rows: planilhaRows, chunkSize });
  }, [planilhaRows, workerRef]);

  // ── Gerar do texto colado ─────────────────────────────────────────────────
  const handlePasteGenerate = () => {
    setError("");
    if (!pastedText.trim()) { setError("Cole algum conteúdo antes de gerar."); return; }
    setPhase("generating");
    setTimeout(() => {
      const lines = pastedText.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 2);
      const resultado = gerarDeTexto(lines);
      setJustificativas(resultado);
      setPhase("done");
      setTimeout(() => setPhase("idle"), 1500);
    }, 80);
  };

  // ── Copiar ────────────────────────────────────────────────────────────────
  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); };
  const handleCopyAll = () => {
    const all = justificativas.map((j, i) => `Justificativa ${i + 1}:\n${j}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(all);
    setCopyAllDone(true);
    setTimeout(() => setCopyAllDone(false), 2000);
  };

  const handleClear = () => {
    setJustificativas([]);
    setPastedText("");
    setFileName("");
    setError("");
    setPlanilhaRows([]);
    setPlanilhaCabecalhos([]);
    setPlanilhaPreview([]);
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
  };

  const isLoading = phase === "parsing" || phase === "generating";
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#080b12] relative overflow-x-hidden">
      <TruckScene />

      {/* Grade de pontos */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="fixed top-0 left-0 w-full h-48 bg-gradient-to-b from-[#0a0f1e]/60 to-transparent z-0 pointer-events-none" />

      {/* Conteúdo principal */}
      <div className="relative z-20 max-w-4xl mx-auto px-4 pt-10 pb-28">

        {/* Cabeçalho */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-10 bg-[#2a4aaa] rounded-full" />
            <div>
              <p className="text-[10px] text-[#4a5a8a] uppercase tracking-[0.2em] font-semibold">
                Electrolux — Frota & Logística
              </p>
              <h1 className="text-2xl font-bold text-[#d0d8f0] tracking-tight leading-tight">
                Marcos Justificativa
              </h1>
              <p className="text-[#5a6a9a] text-xs mt-0.5 font-medium tracking-wide">
                Gerador de Justificativas Operacionais
              </p>
            </div>
          </div>
          <p className="text-[#3a4a6a] text-xs mt-2 ml-4 pl-3">
            Carregue uma planilha ou cole os dados para gerar justificativas operacionais.
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-[#0c1020]/90 backdrop-blur border border-white/6 rounded-xl shadow-2xl mb-6 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-white/6">
            {(["upload", "colar"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-5 text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                  activeTab === tab
                    ? "text-[#8ba2d4] border-b-2 border-[#2a4aaa] bg-[#0e1428]"
                    : "text-[#3a4a6a] hover:text-[#6b82c4] border-b-2 border-transparent"
                }`}
              >
                {tab === "upload" ? "Upload de Planilha" : "Colar Dados"}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── ABA UPLOAD ── */}
            {activeTab === "upload" && (
              <div className="flex flex-col gap-4">

                {/* Zona de drop */}
                <div
                  {...getRootProps()}
                  className={`border border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragActive
                      ? "border-[#2a4aaa] bg-[#0e1428] scale-[1.01]"
                      : planilhaRows.length > 0
                      ? "border-[#1a3a20] bg-[#0a1a10]"
                      : "border-white/8 hover:border-white/16 hover:bg-white/2"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3">
                    {/* Ícone planilha SVG */}
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="opacity-50">
                      <rect x="4" y="2" width="28" height="32" rx="3" stroke="#6b82c4" strokeWidth="1.5" />
                      <line x1="4" y1="12" x2="32" y2="12" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="4" y1="20" x2="32" y2="20" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="4" y1="28" x2="32" y2="28" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="14" y1="12" x2="14" y2="34" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="24" y1="12" x2="24" y2="34" stroke="#6b82c4" strokeWidth="1" />
                    </svg>

                    {/* Fase: parsing */}
                    {phase === "parsing" ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 bg-[#4a6aaa] rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.12}s` }}
                            />
                          ))}
                        </div>
                        <p className="text-[#6b82c4] text-sm">Lendo arquivo...</p>
                      </div>
                    ) : planilhaRows.length > 0 ? (
                      <>
                        <p className="text-[#4caf80] text-sm font-semibold">{fileName}</p>
                        <p className="text-[#3a5a40] text-xs">
                          {planilhaRows.length.toLocaleString("pt-BR")} linha{planilhaRows.length !== 1 ? "s" : ""} carregada{planilhaRows.length !== 1 ? "s" : ""} · {planilhaCabecalhos.length} coluna{planilhaCabecalhos.length !== 1 ? "s" : ""}
                        </p>
                        <p className="text-[#2a3a4a] text-[10px]">
                          Clique ou arraste para substituir o arquivo
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[#8ba2d4] text-sm font-medium">
                          {isDragActive ? "Solte o arquivo aqui" : "Arraste a planilha ou clique para selecionar"}
                        </p>
                        <p className="text-[#3a4a6a] text-xs">
                          Formatos aceitos: .xlsx · .xls · .csv · Suporta milhares de linhas
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Colunas detectadas */}
                {planilhaCabecalhos.length > 0 && (
                  <div className="bg-[#080b12] border border-white/6 rounded-lg p-4">
                    <p className="text-[#4a5a8a] text-[10px] uppercase tracking-widest font-semibold mb-2">
                      Colunas detectadas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {planilhaCabecalhos.map((h) => (
                        <span
                          key={h}
                          className="px-2 py-0.5 rounded bg-[#0e1428] border border-[#1e2e50] text-[#6b82c4] text-[10px] font-mono"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                {planilhaPreview.length > 0 && (
                  <div className="bg-[#080b12] border border-white/6 rounded-lg p-4 overflow-x-auto">
                    <p className="text-[#4a5a8a] text-[10px] uppercase tracking-widest font-semibold mb-3">
                      Pré-visualização — primeiras {planilhaPreview.length} linha{planilhaPreview.length > 1 ? "s" : ""}
                    </p>
                    <table className="w-full text-[10px] border-collapse min-w-max">
                      <thead>
                        <tr>
                          {planilhaCabecalhos.slice(0, 8).map((h) => (
                            <th key={h} className="text-left text-[#4a5a8a] font-semibold pb-2 pr-4 whitespace-nowrap border-b border-white/5 uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                          {planilhaCabecalhos.length > 8 && (
                            <th className="text-[#2a3a5a] pb-2 pr-4 border-b border-white/5 text-left">
                              +{planilhaCabecalhos.length - 8} col.
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {planilhaPreview.map((row, ri) => (
                          <tr key={ri} className="border-b border-white/3">
                            {planilhaCabecalhos.slice(0, 8).map((h) => (
                              <td key={h} className="text-[#7a8aaa] py-1.5 pr-4 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis" title={row[h]}>
                                {row[h] || <span className="text-[#2a3a4a]">—</span>}
                              </td>
                            ))}
                            {planilhaCabecalhos.length > 8 && <td className="text-[#2a3a5a] py-1.5">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {planilhaRows.length > 5 && (
                      <p className="text-[#2a3a5a] text-[10px] mt-2">
                        … e mais {(planilhaRows.length - 5).toLocaleString("pt-BR")} linha{planilhaRows.length - 5 > 1 ? "s" : ""} que serão processadas.
                      </p>
                    )}
                  </div>
                )}

                {/* Barra de progresso durante geração */}
                {phase === "generating" && progress.total > 0 && (
                  <div className="bg-[#080b12] border border-white/6 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#6b82c4] text-xs font-semibold">
                        Gerando justificativas...
                      </span>
                      <span className="text-[#4a5a8a] text-xs font-mono">
                        {progress.done.toLocaleString("pt-BR")} / {progress.total.toLocaleString("pt-BR")} — {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0e1428] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {justificativas.length > 0 && (
                      <p className="text-[#3a5a40] text-[10px] mt-1.5">
                        {justificativas.length.toLocaleString("pt-BR")} justificativa{justificativas.length !== 1 ? "s" : ""} gerada{justificativas.length !== 1 ? "s" : ""} até agora…
                      </p>
                    )}
                  </div>
                )}

                {/* Conclusão */}
                {phase === "done" && (
                  <div className="bg-[#0a1a10] border border-[#1a5a30] rounded-lg px-4 py-3 text-[#4caf80] text-xs text-center font-semibold">
                    {justificativas.length.toLocaleString("pt-BR")} justificativas geradas com sucesso.
                  </div>
                )}

                {/* BOTÃO GERAR */}
                {planilhaRows.length > 0 && (
                  <button
                    onClick={handleGerarDaPlanilha}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#1a2a5a] hover:bg-[#1e3070] disabled:opacity-40 disabled:cursor-not-allowed text-[#8ba2d4] text-sm font-bold py-3.5 rounded-lg transition-all duration-200 border border-[#2a3a70] tracking-wide"
                  >
                    {phase === "generating" ? (
                      <>
                        <span className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="w-1.5 h-1.5 bg-[#4a6aaa] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                        Processando {progress.done.toLocaleString("pt-BR")} / {progress.total.toLocaleString("pt-BR")} linhas...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 8h12M10 4l4 4-4 4" stroke="#8ba2d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Gerar Justificativas — {planilhaRows.length.toLocaleString("pt-BR")} linha{planilhaRows.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                )}

                <p className="text-[#2a3a5a] text-[10px] text-center">
                  Processamento 100% local · Web Worker · sem envio de dados externos
                </p>
              </div>
            )}

            {/* ── ABA COLAR ── */}
            {activeTab === "colar" && (
              <div>
                <label className="block text-[#4a5a8a] text-[10px] uppercase tracking-widest font-semibold mb-2">
                  Conteúdo copiado do Excel
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={
                    "Cole aqui as linhas da planilha (Ctrl+C nas células → Ctrl+V aqui)...\nEx: Coleta: Av. Senador Salgado Filho | Entrega: Rua Dias Velho, 74 - SP | ST: 24173"
                  }
                  className="w-full h-44 bg-[#080b12] border border-white/8 rounded-lg p-4 text-[#c8cfe8] placeholder-[#2a3a5a] text-sm resize-none focus:outline-none focus:border-white/16 transition-all font-light"
                />
                <button
                  onClick={handlePasteGenerate}
                  disabled={isLoading}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-[#1a2a5a] hover:bg-[#1e3070] disabled:opacity-40 disabled:cursor-not-allowed text-[#8ba2d4] text-sm font-bold py-3.5 rounded-lg transition-all duration-200 border border-[#2a3a70] tracking-wide"
                >
                  {isLoading ? (
                    <>
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1.5 h-1.5 bg-[#4a6aaa] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                      Processando...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8h12M10 4l4 4-4 4" stroke="#8ba2d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Gerar Justificativas
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="mt-4 bg-[#1a0a0a] border border-[#3a1a1a] rounded-lg px-4 py-3 text-[#b05050] text-xs">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ── RESULTADOS ── */}
        {justificativas.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#2a4aaa] rounded-full" />
                <span className="text-[#8ba2d4] text-sm font-semibold">
                  {justificativas.length.toLocaleString("pt-BR")} justificativa{justificativas.length !== 1 ? "s" : ""} gerada{justificativas.length !== 1 ? "s" : ""}
                  {phase === "generating" && (
                    <span className="ml-2 text-[#4a5a8a] text-xs font-normal">· gerando...</span>
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyAll}
                  disabled={phase === "generating"}
                  className={`text-xs font-medium px-4 py-2 rounded border transition-all duration-200 disabled:opacity-40 ${
                    copyAllDone
                      ? "bg-[#0d2a1a] border-[#1a5a30] text-[#4caf80]"
                      : "bg-[#0c1428] border-[#1e2e50] text-[#6b82c4] hover:border-[#2a4080] hover:text-[#8ba2d4]"
                  }`}
                >
                  {copyAllDone ? "Copiado!" : "Copiar todas"}
                </button>
                <button
                  onClick={handleClear}
                  className="text-xs font-medium px-4 py-2 rounded border border-[#2a1a1a] text-[#5a3030] hover:text-[#8a4040] hover:border-[#3a1a1a] transition-all duration-200 bg-[#0c0808]"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {justificativas.map((j, i) => (
                <JustificativaCard
                  key={i}
                  index={i + 1}
                  text={j}
                  onCopy={() => handleCopy(j)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
