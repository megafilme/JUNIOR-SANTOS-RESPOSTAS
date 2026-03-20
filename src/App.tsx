import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import TruckScene from "./components/TruckScene";
import JustificativaCard from "./components/JustificativaCard";
import {
  gerarJustificativas,
  gerarJustificativasDePlanilha,
  PlanilhaRow,
} from "./utils/gerarJustificativas";

export default function App() {
  const [pastedText, setPastedText] = useState("");
  const [justificativas, setJustificativas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "colar">("upload");
  const [error, setError] = useState("");
  const [copyAllDone, setCopyAllDone] = useState(false);

  // Dados da planilha carregada (mas ainda não gerada)
  const [planilhaRows, setPlanilhaRows] = useState<PlanilhaRow[]>([]);
  const [planilhaCabecalhos, setPlanilhaCabecalhos] = useState<string[]>([]);
  const [planilhaPreview, setPlanilhaPreview] = useState<PlanilhaRow[]>([]);

  // ── Leitura do arquivo ──────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setError("");
    setJustificativas([]);
    setPlanilhaRows([]);
    setPlanilhaCabecalhos([]);
    setPlanilhaPreview([]);
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows: PlanilhaRow[] = [];

        if (file.name.toLowerCase().endsWith(".csv")) {
          // CSV: lê como texto
          const text = new TextDecoder("utf-8").decode(
            new Uint8Array(e.target?.result as ArrayBuffer)
          );
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length < 2) throw new Error("CSV vazio ou sem dados.");
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
          rows = lines.slice(1).map((line) => {
            const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
            const obj: PlanilhaRow = {};
            headers.forEach((h, i) => { obj[h] = cells[i] || ""; });
            return obj;
          });
        } else {
          // XLSX / XLS
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];

          // Tenta com cabeçalho (primeira linha = nomes das colunas)
          const withHeader = XLSX.utils.sheet_to_json<PlanilhaRow>(sheet, {
            defval: "",
            raw: false,
          });

          if (withHeader.length > 0) {
            rows = withHeader;
          } else {
            // Fallback: sem cabeçalho, gera nomes genéricos
            const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: "",
              raw: false,
            }) as string[][];
            const headers =
              raw[0]?.map((_, i) => `Coluna ${i + 1}`) || [];
            rows = raw.slice(1).map((r) => {
              const obj: PlanilhaRow = {};
              headers.forEach((h, i) => { obj[h] = String(r[i] ?? ""); });
              return obj;
            });
          }
        }

        // Filtra linhas completamente vazias
        rows = rows.filter((r) =>
          Object.values(r).some((v) => String(v).trim().length > 0)
        );

        if (rows.length === 0) throw new Error("Nenhuma linha com dados foi encontrada.");

        const cabecalhos = Object.keys(rows[0]);
        setPlanilhaCabecalhos(cabecalhos);
        setPlanilhaRows(rows);
        setPlanilhaPreview(rows.slice(0, 5)); // mostra só as 5 primeiras como preview
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao ler o arquivo.";
        setError(msg || "Erro ao ler o arquivo. Tente novamente com .xlsx, .xls ou .csv.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
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

  // ── Gerar a partir da planilha carregada ────────────────────────────────────
  const handleGerarDaPlanilha = () => {
    if (planilhaRows.length === 0) {
      setError("Carregue uma planilha antes de gerar.");
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const resultado = gerarJustificativasDePlanilha(planilhaRows);
      setJustificativas(resultado);
      setLoading(false);
    }, 600);
  };

  // ── Gerar a partir do texto colado ──────────────────────────────────────────
  const handlePasteGenerate = () => {
    setError("");
    if (!pastedText.trim()) {
      setError("Cole algum conteúdo antes de gerar.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const lines = pastedText
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 2);
      const resultado = gerarJustificativas(lines);
      setJustificativas(resultado);
      setLoading(false);
    }, 500);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCopyAll = () => {
    const all = justificativas
      .map((j, i) => `Justificativa ${i + 1}:\n${j}`)
      .join("\n\n---\n\n");
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
  };

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
            Carregue uma planilha ou cole os dados diretamente para gerar justificativas operacionais.
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-[#0c1020]/90 backdrop-blur border border-white/6 rounded-xl shadow-2xl mb-6 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-white/6">
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 py-3 px-5 text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                activeTab === "upload"
                  ? "text-[#8ba2d4] border-b-2 border-[#2a4aaa] bg-[#0e1428]"
                  : "text-[#3a4a6a] hover:text-[#6b82c4] border-b-2 border-transparent"
              }`}
            >
              Upload de Planilha
            </button>
            <button
              onClick={() => setActiveTab("colar")}
              className={`flex-1 py-3 px-5 text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                activeTab === "colar"
                  ? "text-[#8ba2d4] border-b-2 border-[#2a4aaa] bg-[#0e1428]"
                  : "text-[#3a4a6a] hover:text-[#6b82c4] border-b-2 border-transparent"
              }`}
            >
              Colar Dados
            </button>
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
                      ? "border-[#2a4aaa] bg-[#0e1428]"
                      : planilhaRows.length > 0
                      ? "border-[#1a3a20] bg-[#0a1a10]"
                      : "border-white/8 hover:border-white/16 hover:bg-white/2"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3">
                    {/* Ícone planilha */}
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="opacity-50">
                      <rect x="4" y="2" width="28" height="32" rx="3" stroke="#6b82c4" strokeWidth="1.5" />
                      <line x1="4" y1="12" x2="32" y2="12" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="4" y1="20" x2="32" y2="20" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="4" y1="28" x2="32" y2="28" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="14" y1="12" x2="14" y2="34" stroke="#6b82c4" strokeWidth="1" />
                      <line x1="24" y1="12" x2="24" y2="34" stroke="#6b82c4" strokeWidth="1" />
                    </svg>

                    {planilhaRows.length > 0 ? (
                      <>
                        <p className="text-[#4caf80] text-sm font-semibold">
                          {fileName}
                        </p>
                        <p className="text-[#3a5a40] text-xs">
                          {planilhaRows.length} linha{planilhaRows.length !== 1 ? "s" : ""} carregada{planilhaRows.length !== 1 ? "s" : ""} · {planilhaCabecalhos.length} coluna{planilhaCabecalhos.length !== 1 ? "s" : ""}
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
                          Formatos aceitos: .xlsx · .xls · .csv
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Preview das colunas detectadas */}
                {planilhaCabecalhos.length > 0 && (
                  <div className="bg-[#080b12] border border-white/6 rounded-lg p-4">
                    <p className="text-[#4a5a8a] text-[10px] uppercase tracking-widest font-semibold mb-2">
                      Colunas detectadas na planilha
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

                {/* Preview das primeiras linhas */}
                {planilhaPreview.length > 0 && (
                  <div className="bg-[#080b12] border border-white/6 rounded-lg p-4 overflow-x-auto">
                    <p className="text-[#4a5a8a] text-[10px] uppercase tracking-widest font-semibold mb-3">
                      Pré-visualização — primeiras {planilhaPreview.length} linha{planilhaPreview.length > 1 ? "s" : ""}
                    </p>
                    <table className="w-full text-[10px] border-collapse min-w-max">
                      <thead>
                        <tr>
                          {planilhaCabecalhos.slice(0, 8).map((h) => (
                            <th
                              key={h}
                              className="text-left text-[#4a5a8a] font-semibold pb-2 pr-4 whitespace-nowrap border-b border-white/5 uppercase tracking-wide"
                            >
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
                              <td
                                key={h}
                                className="text-[#7a8aaa] py-1.5 pr-4 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis"
                                title={row[h]}
                              >
                                {row[h] || <span className="text-[#2a3a4a]">—</span>}
                              </td>
                            ))}
                            {planilhaCabecalhos.length > 8 && (
                              <td className="text-[#2a3a5a] py-1.5">…</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {planilhaRows.length > 5 && (
                      <p className="text-[#2a3a5a] text-[10px] mt-2">
                        … e mais {planilhaRows.length - 5} linha{planilhaRows.length - 5 > 1 ? "s" : ""} que serão processadas.
                      </p>
                    )}
                  </div>
                )}

                {/* BOTÃO GERAR */}
                {planilhaRows.length > 0 && (
                  <button
                    onClick={handleGerarDaPlanilha}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-[#1a2a5a] hover:bg-[#1e3070] disabled:opacity-40 disabled:cursor-not-allowed text-[#8ba2d4] text-sm font-bold py-3 rounded-lg transition-all duration-200 border border-[#2a3a70] tracking-wide"
                  >
                    {loading ? (
                      <>
                        <span className="flex gap-1">
                          {[0,1,2].map(i => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 bg-[#4a6aaa] rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </span>
                        Processando {planilhaRows.length} linha{planilhaRows.length > 1 ? "s" : ""}...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 8h12M10 4l4 4-4 4" stroke="#8ba2d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Gerar Justificativas — {planilhaRows.length} linha{planilhaRows.length > 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                )}

                <p className="text-[#2a3a5a] text-[10px] text-center">
                  Processamento local — nenhum dado é enviado a servidores externos.
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
                  disabled={loading}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-[#1a2a5a] hover:bg-[#1e3070] disabled:opacity-40 disabled:cursor-not-allowed text-[#8ba2d4] text-sm font-bold py-3 rounded-lg transition-all duration-200 border border-[#2a3a70] tracking-wide"
                >
                  {loading ? (
                    <>
                      <span className="flex gap-1">
                        {[0,1,2].map(i => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 bg-[#4a6aaa] rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                      Processando...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8h12M10 4l4 4-4 4" stroke="#8ba2d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
        {justificativas.length > 0 && !loading && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#2a4aaa] rounded-full" />
                <span className="text-[#8ba2d4] text-sm font-semibold">
                  {justificativas.length} justificativa{justificativas.length !== 1 ? "s" : ""} gerada{justificativas.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyAll}
                  className={`text-xs font-medium px-4 py-2 rounded border transition-all duration-200 ${
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
