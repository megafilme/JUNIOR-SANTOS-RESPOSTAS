// ─── TIPOS ───────────────────────────────────────────────────────────────────
export interface PlanilhaRow {
  [col: string]: string;
}

// ─── ENTRADA PRINCIPAL (texto colado) ────────────────────────────────────────
export function gerarJustificativas(lines: string[]): string[] {
  return lines
    .filter((l) => l.trim().length > 3)
    .map((l, i) => gerarDeTexto(l, i));
}

// ─── ENTRADA PRINCIPAL (planilha estruturada) ─────────────────────────────────
export function gerarJustificativasDePlanilha(rows: PlanilhaRow[]): string[] {
  return rows
    .filter((r) => Object.values(r).some((v) => v.trim().length > 1))
    .map((r, i) => gerarDeRow(r, i));
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Procura valor numa linha de texto livre por palavras-chave */
function extrairTexto(line: string, keys: string[]): string {
  for (const key of keys) {
    const regex = new RegExp(key + "[:\\s]+([^|\\n;,]+)", "i");
    const m = line.match(regex);
    if (m) return m[1].trim();
  }
  return "";
}

/** Procura coluna num objeto de row por palavras-chave no nome da coluna */
function extrairCol(row: PlanilhaRow, keys: string[]): string {
  for (const col of Object.keys(row)) {
    const colLower = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const key of keys) {
      const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (colLower.includes(keyNorm)) {
        const val = (row[col] || "").trim();
        if (val) return val;
      }
    }
  }
  return "";
}

/** Retorna todos os valores de uma row como uma string única para detecção */
function rowParaTexto(row: PlanilhaRow): string {
  return Object.values(row).join(" | ");
}

const FECHOS = [
  "Movimentação necessária para continuidade das operações da unidade.",
  "Ação essencial para suporte logístico e administrativo da unidade.",
  "Necessário para regularização e atendimento da demanda registrada.",
  "Essencial para garantir o fluxo operacional e atendimento ao solicitante.",
  "Movimentação autorizada conforme necessidade operacional vigente.",
  "Atendimento realizado dentro dos parâmetros logísticos estabelecidos.",
  "Demanda cumprida em conformidade com o processo interno da unidade.",
];

// ─── GERADOR A PARTIR DE ROW ESTRUTURADA ─────────────────────────────────────
function gerarDeRow(row: PlanilhaRow, idx: number): string {
  const texto = rowParaTexto(row);

  // — Extração inteligente por nome de coluna —
  const coleta =
    extrairCol(row, ["coleta", "origem", "retirada", "pickup", "saida", "partida"]) ||
    extrairTexto(texto, ["coleta", "origem", "retirada", "de"]);

  const entrega =
    extrairCol(row, ["entrega", "destino", "delivery", "chegada", "para"]) ||
    extrairTexto(texto, ["entrega", "destino", "para"]);

  const material =
    extrairCol(row, ["material", "item", "produto", "carga", "descricao", "objeto"]) ||
    extrairTexto(texto, ["material", "item", "produto", "carga"]);

  const motorista =
    extrairCol(row, ["motorista", "condutor", "driver", "responsavel pelo veiculo"]) ||
    extrairTexto(texto, ["motorista", "condutor"]);

  const veiculo =
    extrairCol(row, ["veiculo", "placa", "carro", "truck", "frota"]) ||
    extrairTexto(texto, ["veiculo", "placa", "frota"]);

  const solicitante =
    extrairCol(row, ["solicitante", "solicitado por", "aprovado", "responsavel", "requisitante"]) ||
    extrairTexto(texto, ["solicitante", "solicitado por", "aprovado por"]);

  const st =
    extrairCol(row, ["st", "ocorrencia", "chamado", "ticket", "os", "ordem de servico"]) ||
    extrairTexto(texto, ["st", "ocorrencia", "chamado", "ticket"]) ||
    (texto.match(/\bst[:\s#-]*(\d{4,7})\b/i) || [])[1] ||
    (texto.match(/\bocorr[eê]ncia[:\s#-]*(\d{4,7})\b/i) || [])[1] || "";

  const ordemInterna =
    extrairCol(row, ["ordem interna", "ordem", "oi", "op", "ordem producao"]) ||
    extrairTexto(texto, ["ordem interna", "ordem", "oi"]) ||
    (texto.match(/\b([A-Z]{2}\d{2}[A-Z]\d{4})\b/) || [])[1] || "";

  const valor =
    extrairCol(row, ["valor", "total", "custo", "preco", "frete", "r$"]) ||
    extrairTexto(texto, ["valor", "total", "custo", "r\\$"]) ||
    (texto.match(/R\$[\s]?[\d.,]+/i) || [])[0] || "";

  const contato =
    extrairCol(row, ["contato", "fone", "telefone", "tel", "cel"]) ||
    extrairTexto(texto, ["contato", "fone", "tel"]);

  const data =
    extrairCol(row, ["data", "dt", "dia", "datahora", "data hora"]) ||
    extrairTexto(texto, ["data", "dt"]);

  const email = (texto.match(/[\w.+-]+@electrolux\.com\.br/i) || [])[0] || "";
  const debora =
    /d[eé]bora/i.test(texto) ||
    /debora\.alvelino/i.test(texto);

  return montar({ coleta, entrega, material, motorista, veiculo, solicitante, st, ordemInterna, valor, contato, data, email, debora, idx });
}

// ─── GERADOR A PARTIR DE TEXTO LIVRE ─────────────────────────────────────────
function gerarDeTexto(line: string, idx: number): string {
  const coleta =
    extrairTexto(line, ["coleta", "origem", "retirada", "pickup"]) ||
    extrairTexto(line, ["de"]);
  const entrega =
    extrairTexto(line, ["entrega", "destino", "delivery"]) ||
    extrairTexto(line, ["para"]);
  const material = extrairTexto(line, ["material", "item", "produto", "carga"]);
  const motorista = extrairTexto(line, ["motorista", "condutor", "driver"]);
  const veiculo = extrairTexto(line, ["veiculo", "placa", "frota"]);
  const solicitante = extrairTexto(line, ["solicitante", "solicitado por", "aprovado por", "resp"]);
  const st =
    extrairTexto(line, ["st", "ocorrencia", "chamado", "ticket"]) ||
    (line.match(/\bst[:\s#-]*(\d{4,7})\b/i) || [])[1] ||
    (line.match(/\bocorr[eê]ncia[:\s#-]*(\d{4,7})\b/i) || [])[1] || "";
  const ordemInterna =
    extrairTexto(line, ["ordem interna", "ordem", "oi"]) ||
    (line.match(/\b([A-Z]{2}\d{2}[A-Z]\d{4})\b/) || [])[1] || "";
  const valor =
    extrairTexto(line, ["valor", "total", "r\\$"]) ||
    (line.match(/R\$[\s]?[\d.,]+/i) || [])[0] || "";
  const contato = extrairTexto(line, ["contato", "fone", "tel", "com"]);
  const data = extrairTexto(line, ["data", "dt"]);
  const email = (line.match(/[\w.+-]+@electrolux\.com\.br/i) || [])[0] || "";
  const debora = /d[eé]bora/i.test(line) || /debora\.alvelino/i.test(line);

  return montar({ coleta, entrega, material, motorista, veiculo, solicitante, st, ordemInterna, valor, contato, data, email, debora, idx });
}

// ─── MONTAGEM DA JUSTIFICATIVA ────────────────────────────────────────────────
interface Campos {
  coleta: string;
  entrega: string;
  material: string;
  motorista: string;
  veiculo: string;
  solicitante: string;
  st: string;
  ordemInterna: string;
  valor: string;
  contato: string;
  data: string;
  email: string;
  debora: boolean;
  idx: number;
}

function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function montar(c: Campos): string {
  const linhas: string[] = [];

  // ── Linha 1: Abertura com material/tipo de movimentação ──
  if (c.material && (c.coleta || c.entrega)) {
    if (c.coleta && c.entrega) {
      linhas.push(`Coleta e entrega de ${c.material.toLowerCase()}, com saída de ${cap(c.coleta)} e destino em ${cap(c.entrega)}.`);
    } else if (c.coleta) {
      linhas.push(`Coleta de ${c.material.toLowerCase()} em ${cap(c.coleta)}.`);
    } else {
      linhas.push(`Entrega de ${c.material.toLowerCase()} em ${cap(c.entrega)}.`);
    }
  } else if (c.coleta && c.entrega) {
    linhas.push(`Coleta e entrega de material com saída de ${cap(c.coleta)} e destino em ${cap(c.entrega)}.`);
  } else if (c.material) {
    linhas.push(`Movimentação de ${c.material.toLowerCase()} conforme demanda registrada.`);
  } else if (c.coleta) {
    linhas.push(`Coleta de material realizada em ${cap(c.coleta)}.`);
  } else if (c.entrega) {
    linhas.push(`Entrega de material realizada em ${cap(c.entrega)}.`);
  } else {
    linhas.push(`Movimentação operacional necessária para suporte à unidade.`);
  }

  // ── Linha 2: Data / veículo / motorista ──
  const infos: string[] = [];
  if (c.data) infos.push(`Data: ${c.data}`);
  if (c.veiculo) infos.push(`Veículo/Placa: ${c.veiculo}`);
  if (c.motorista) infos.push(`Motorista: ${cap(c.motorista)}`);
  if (c.contato && !c.motorista) infos.push(`Contato: ${c.contato}`);
  if (infos.length) linhas.push(infos.join(" · ") + ".");

  // ── Linha 3: ST / Ordem interna ──
  const regParts: string[] = [];
  if (c.st) regParts.push(`Ocorrência/ST nº ${c.st}`);
  if (c.ordemInterna) regParts.push(`Ordem Interna: ${c.ordemInterna}`);
  if (regParts.length) linhas.push(`Atendimento referente a: ${regParts.join(" | ")}.`);

  // ── Linha 4: Solicitante / aprovação ──
  if (c.debora && c.email) {
    linhas.push(`Solicitado e aprovado por Débora Alvelino (${c.email}).`);
  } else if (c.debora) {
    linhas.push(`Solicitado e aprovado por Débora Alvelino.`);
  } else if (c.solicitante && c.email) {
    linhas.push(`Solicitado por ${cap(c.solicitante)} (${c.email}).`);
  } else if (c.solicitante) {
    linhas.push(`Solicitado por ${cap(c.solicitante)}.`);
  } else if (c.email) {
    linhas.push(`Solicitação recebida via ${c.email}.`);
  }

  // ── Linha 5: Valor ──
  if (c.valor) {
    const valorFmt = c.valor.startsWith("R$") ? c.valor : `R$ ${c.valor}`;
    linhas.push(`Valor envolvido na operação: ${valorFmt}.`);
  }

  // ── Linha 6: Fecho ──
  linhas.push(FECHOS[c.idx % FECHOS.length]);

  return linhas.join("\n");
}
