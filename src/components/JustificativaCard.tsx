import { useState } from "react";

interface Props {
  index: number;
  text: string;
  onCopy: () => void;
}

export default function JustificativaCard({ index, text, onCopy }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/8 rounded-lg p-5 shadow-md hover:border-white/14 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Índice */}
          <div className="flex-shrink-0 mt-0.5 w-6 h-6 bg-[#1c2340] border border-[#2a3560] rounded flex items-center justify-center text-[#6b82c4] font-bold text-xs">
            {index}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#4a5a8a] font-semibold mb-1.5 uppercase tracking-widest">
              Justificativa {index}
            </p>
            <p className="text-[#c8cfe8] text-sm leading-relaxed whitespace-pre-wrap break-words font-light">
              {text}
            </p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          title="Copiar justificativa"
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 border ${
            copied
              ? "bg-[#0d2a1a] border-[#1a5a30] text-[#4caf80]"
              : "bg-[#0c1428] border-[#1e2e50] text-[#6b82c4] hover:border-[#2a4080] hover:text-[#8ba2d4]"
          }`}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {/* Linha divisória sutil */}
      <div className="mt-4 h-px bg-white/4" />
    </div>
  );
}
