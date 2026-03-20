/// <reference lib="webworker" />
import * as XLSX from "xlsx";

export type WorkerInMsg =
  | { type: "parse"; buffer: ArrayBuffer; fileName: string }
  | { type: "generate"; rows: Record<string, string>[]; chunkSize: number };

export type WorkerOutMsg =
  | { type: "parsed"; rows: Record<string, string>[]; cabecalhos: string[] }
  | { type: "progress"; done: number; total: number; batch: string[] }
  | { type: "done"; total: number }
  | { type: "error"; message: string };

// ─── Normaliza string para comparação ────────────────────────────────────────
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ─── Extrai valor de coluna por palavras-chave ────────────────────────────────
function col(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const kn = norm(k);
    for (const key of keys) {
      if (kn.includes(norm(key))) {
        const v = (row[k] || "").trim();
        if (v) return v;
      }
    }
  }
  return "";
}

// ─── Extrai por regex em texto livre ─────────────────────────────────────────
function txt(text: string, keys: string[]): string {
  for (const key of keys) {
    const r = new RegExp(key + "[:\\s]+([^|\\n;,]{2,60})", "i");
    const m = text.match(r);
    if (m) return m[1].trim();
  }
  return "";
}

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FECHOS = [
  "Movimentação necessária para continuidade das operações da unidade.",
  "Ação essencial para suporte logístico e administrativo da unidade.",
  "Necessário para regularização e atendimento da demanda registrada.",
  "Essencial para garantir o fluxo operacional e atendimento ao solicitante.",
  "Movimentação autorizada conforme necessidade operacional vigente.",
  "Atendimento realizado dentro dos parâmetros logísticos estabelecidos.",
  "Demanda cumprida em conformidade com o processo interno da unidade.",
  "Operação executada conforme planejamento logístico da unidade.",
  "Atendimento concluído dentro do prazo e conformidade exigidos.",
];

// ─── Gera justificativa de uma linha ─────────────────────────────────────────
function gerarLinha(row: Record<string, string>, idx: number): string {
  const texto = Object.values(row).join(" | ");

  const coleta =
    col(row, ["coleta", "origem", "retirada", "pickup", "saida", "partida"]) ||
    txt(texto, ["coleta", "origem", "retirada"]);

  const entrega =
    col(row, ["entrega", "destino", "delivery", "chegada", "para"]) ||
    txt(texto, ["entrega", "destino"]);

  const material =
    col(row, ["material", "item", "produto", "carga", "descricao", "objeto", "servico"]) ||
    txt(texto, ["material", "item", "produto", "carga", "servico"]);

  const motorista =
    col(row, ["motorista", "condutor", "driver"]) ||
    txt(texto, ["motorista", "condutor"]);

  const veiculo =
    col(row, ["veiculo", "placa", "carro", "frota", "truck"]) ||
    txt(texto, ["veiculo", "placa", "frota"]);

  const solicitante =
    col(row, ["solicitante", "solicitado por", "aprovado", "responsavel", "requisitante"]) ||
    txt(texto, ["solicitante", "solicitado por", "aprovado por"]);

  const st =
    col(row, ["st", "ocorrencia", "chamado", "ticket", "os", "ordem de servico"]) ||
    txt(texto, ["st", "ocorrencia", "chamado"]) ||
    (texto.match(/\bst[:\s#-]*(\d{4,7})\b/i) || [])[1] ||
    (texto.match(/\bocorr[eê]ncia[:\s#-]*(\d{4,7})\b/i) || [])[1] || "";

  const ordemInterna =
    col(row, ["ordem interna", "ordem", "oi", "op", "ordem producao"]) ||
    txt(texto, ["ordem interna", "ordem"]) ||
    (texto.match(/\b([A-Z]{2}\d{2}[A-Z]\d{4})\b/) || [])[1] || "";

  const valor =
    col(row, ["valor", "total", "custo", "preco", "frete"]) ||
    txt(texto, ["valor", "total", "custo"]) ||
    (texto.match(/R\$[\s]?[\d.,]+/i) || [])[0] || "";

  const contato =
    col(row, ["contato", "fone", "telefone", "tel", "cel"]) ||
    txt(texto, ["contato", "fone", "tel"]);

  const data =
    col(row, ["data", "dt", "dia", "data hora", "datahora"]) ||
    txt(texto, ["data", "dt"]);

  const email = (texto.match(/[\w.+-]+@electrolux\.com\.br/i) || [])[0] || "";
  const debora = /d[eé]bora/i.test(texto) || /debora\.alvelino/i.test(texto);

  // ── Montar justificativa ──────────────────────────────────────────────────
  const linhas: string[] = [];

  // Linha 1: abertura
  if (material && coleta && entrega) {
    linhas.push(`Coleta e entrega de ${material.toLowerCase()}, com saída de ${cap(coleta)} e destino em ${cap(entrega)}.`);
  } else if (material && coleta) {
    linhas.push(`Coleta de ${material.toLowerCase()} em ${cap(coleta)}.`);
  } else if (material && entrega) {
    linhas.push(`Entrega de ${material.toLowerCase()} em ${cap(entrega)}.`);
  } else if (coleta && entrega) {
    linhas.push(`Coleta e entrega de material com saída de ${cap(coleta)} e destino em ${cap(entrega)}.`);
  } else if (material) {
    linhas.push(`Movimentação de ${material.toLowerCase()} conforme demanda registrada.`);
  } else if (coleta) {
    linhas.push(`Coleta de material realizada em ${cap(coleta)}.`);
  } else if (entrega) {
    linhas.push(`Entrega de material realizada em ${cap(entrega)}.`);
  } else {
    linhas.push(`Movimentação operacional necessária para suporte à unidade.`);
  }

  // Linha 2: data / veículo / motorista
  const infos: string[] = [];
  if (data) infos.push(`Data: ${data}`);
  if (veiculo) infos.push(`Veículo/Placa: ${veiculo}`);
  if (motorista) infos.push(`Motorista: ${cap(motorista)}`);
  if (contato && !motorista) infos.push(`Contato: ${contato}`);
  if (infos.length) linhas.push(infos.join(" · ") + ".");

  // Linha 3: ST / ordem
  const reg: string[] = [];
  if (st) reg.push(`Ocorrência/ST nº ${st}`);
  if (ordemInterna) reg.push(`Ordem Interna: ${ordemInterna}`);
  if (reg.length) linhas.push(`Atendimento referente a: ${reg.join(" | ")}.`);

  // Linha 4: solicitante
  if (debora && email) {
    linhas.push(`Solicitado e aprovado por Débora Alvelino (${email}).`);
  } else if (debora) {
    linhas.push(`Solicitado e aprovado por Débora Alvelino.`);
  } else if (solicitante && email) {
    linhas.push(`Solicitado por ${cap(solicitante)} (${email}).`);
  } else if (solicitante) {
    linhas.push(`Solicitado por ${cap(solicitante)}.`);
  } else if (email) {
    linhas.push(`Solicitação recebida via ${email}.`);
  }

  // Linha 5: valor
  if (valor) {
    const vf = valor.startsWith("R$") ? valor : `R$ ${valor}`;
    linhas.push(`Valor envolvido na operação: ${vf}.`);
  }

  // Linha 6: fecho
  linhas.push(FECHOS[idx % FECHOS.length]);

  return linhas.join("\n");
}

// ─── Listener principal ───────────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<WorkerInMsg>) => {
  const msg = e.data;

  // ── Parse do arquivo ──────────────────────────────────────────────────────
  if (msg.type === "parse") {
    try {
      const data = new Uint8Array(msg.buffer);
      let rows: Record<string, string>[] = [];

      if (msg.fileName.toLowerCase().endsWith(".csv")) {
        const text = new TextDecoder("utf-8").decode(data);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("CSV vazio ou sem dados.");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        rows = lines.slice(1).map((line) => {
          const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = cells[i] || ""; });
          return obj;
        });
      } else {
        // XLSX / XLS — usa denseOutput para não criar objetos desnecessários
        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,
          dense: false,
          sheetStubs: false,
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false,
        });
        rows = parsed as Record<string, string>[];
      }

      // Filtra linhas completamente vazias
      rows = rows.filter((r) =>
        Object.values(r).some((v) => String(v).trim().length > 0)
      );

      if (rows.length === 0) throw new Error("Nenhuma linha com dados encontrada.");

      const cabecalhos = Object.keys(rows[0]);
      (self as unknown as Worker).postMessage({ type: "parsed", rows, cabecalhos } satisfies WorkerOutMsg);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao ler o arquivo.";
      (self as unknown as Worker).postMessage({ type: "error", message } satisfies WorkerOutMsg);
    }
    return;
  }

  // ── Geração em chunks ─────────────────────────────────────────────────────
  if (msg.type === "generate") {
    const { rows, chunkSize } = msg;
    const total = rows.length;
    let idx = 0;

    function processChunk() {
      const batch: string[] = [];
      const end = Math.min(idx + chunkSize, total);

      for (let i = idx; i < end; i++) {
        batch.push(gerarLinha(rows[i], i));
      }

      idx = end;
      (self as unknown as Worker).postMessage({
        type: "progress",
        done: idx,
        total,
        batch,
      } satisfies WorkerOutMsg);

      if (idx < total) {
        // Pequena pausa para não travar, usando setTimeout dentro do worker
        setTimeout(processChunk, 0);
      } else {
        (self as unknown as Worker).postMessage({ type: "done", total } satisfies WorkerOutMsg);
      }
    }

    processChunk();
    return;
  }
};
