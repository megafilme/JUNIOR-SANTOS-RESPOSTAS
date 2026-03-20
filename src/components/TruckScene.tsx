export default function TruckScene() {
  return (
    <>
      <style>{`
        @keyframes truckRide {
          0%   { transform: translateX(-460px); }
          100% { transform: translateX(110vw); }
        }
        @keyframes wheelSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes smokeFloat {
          0%   { opacity: 0.4; transform: translateY(0) scale(1); }
          100% { opacity: 0;   transform: translateY(-36px) scale(2.2); }
        }
        @keyframes roadDash {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-100px); }
        }

        .truck-container {
          animation: truckRide 18s linear infinite;
          will-change: transform;
          pointer-events: none;
        }
        .wheel-anim {
          animation: wheelSpin 0.7s linear infinite;
          transform-origin: center;
        }
        .smoke-puff { animation: smokeFloat 1.4s ease-out infinite; }
        .smoke-puff:nth-child(2) { animation-delay: 0.5s; }
        .smoke-puff:nth-child(3) { animation-delay: 1s; }
        .road-dash { animation: roadDash 0.8s linear infinite; }
      `}</style>

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">

        {/* Faixa de asfalto */}
        <div className="absolute bottom-0 left-0 w-full h-16 bg-[#1a1a1a]" />
        {/* Linha amarela central */}
        <div className="absolute bottom-7 left-0 w-full h-[2px] overflow-hidden">
          <div className="road-dash flex w-[300vw]">
            {[...Array(80)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-16 h-[2px] bg-[#c9a84c] mx-8 opacity-70" />
            ))}
          </div>
        </div>
        {/* Borda superior do asfalto */}
        <div className="absolute bottom-16 left-0 w-full h-[2px] bg-white/10" />

        {/* Caminhão */}
        <div className="truck-container absolute" style={{ bottom: "16px" }}>
          <TruckSVG />
        </div>
      </div>
    </>
  );
}

function TruckSVG() {
  return (
    <div className="relative" style={{ width: 420, height: 100 }}>
      {/* Fumaça */}
      <div className="absolute" style={{ left: 22, top: 0 }}>
        <svg width="36" height="52" viewBox="0 0 36 52">
          <circle className="smoke-puff" cx="18" cy="42" r="7" fill="rgba(180,190,210,0.55)" />
          <circle className="smoke-puff" cx="13" cy="30" r="5" fill="rgba(180,190,210,0.40)" />
          <circle className="smoke-puff" cx="20" cy="18" r="4" fill="rgba(180,190,210,0.28)" />
        </svg>
      </div>

      <svg
        width="420"
        height="100"
        viewBox="0 0 420 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.65, filter: "drop-shadow(0 4px 12px rgba(0,60,180,0.3))" }}
      >
        {/* === BAÚ === */}
        <rect x="8" y="14" width="258" height="68" rx="4" fill="#1c2550" stroke="#3a4e90" strokeWidth="1.5" />
        <rect x="12" y="18" width="250" height="60" rx="3" fill="#141c3a" />
        {/* Listras baú */}
        <line x1="8" y1="55" x2="266" y2="55" stroke="#3a4e90" strokeWidth="1" />
        <line x1="8" y1="40" x2="266" y2="40" strokeDasharray="6 4" stroke="#3a4e90" strokeWidth="0.8" />
        {/* Texto baú */}
        <text x="137" y="46" textAnchor="middle" fill="#7a9ae0" fontSize="11" fontWeight="700"
          fontFamily="Arial, sans-serif" letterSpacing="3">ELECTROLUX</text>
        <text x="137" y="61" textAnchor="middle" fill="#4a6ab0" fontSize="7.5"
          fontFamily="Arial, sans-serif" letterSpacing="2">LOGÍSTICA</text>

        {/* Separador baú/cabine */}
        <rect x="264" y="14" width="5" height="68" rx="1" fill="#0a0f20" stroke="#3a4e90" strokeWidth="1" />

        {/* === CABINE === */}
        <rect x="267" y="22" width="112" height="60" rx="6" fill="#1a2040" stroke="#3a4e90" strokeWidth="1.5" />
        {/* Teto aerodinâmico */}
        <path d="M274 22 Q310 6 378 18 L378 24 Q310 12 274 26 Z" fill="#141c38" />
        {/* Para-brisa */}
        <rect x="308" y="26" width="62" height="36" rx="4" fill="#1e2a50" opacity="0.9" />
        <line x1="338" y1="26" x2="338" y2="62" stroke="#2a3a60" strokeWidth="0.8" />
        {/* Janela lateral */}
        <rect x="271" y="28" width="30" height="20" rx="3" fill="#1e2a50" opacity="0.9" />
        {/* Grade frontal */}
        <rect x="376" y="36" width="28" height="30" rx="3" fill="#0f1428" stroke="#3a4e90" strokeWidth="1" />
        <line x1="376" y1="44" x2="404" y2="44" stroke="#3a4e90" strokeWidth="0.8" />
        <line x1="376" y1="52" x2="404" y2="52" stroke="#3a4e90" strokeWidth="0.8" />
        <line x1="376" y1="60" x2="404" y2="60" stroke="#3a4e90" strokeWidth="0.8" />
        <line x1="390" y1="36" x2="390" y2="66" stroke="#3a4e90" strokeWidth="0.8" />
        {/* Farol */}
        <rect x="396" y="32" width="13" height="7" rx="2" fill="#e8d87a" opacity="0.85" />
        <rect x="396" y="32" width="13" height="7" rx="2" fill="none" stroke="#c8b840" strokeWidth="0.5" />
        {/* Para-choque */}
        <rect x="374" y="68" width="36" height="10" rx="3" fill="#0f1428" stroke="#3a4e90" strokeWidth="1" />
        {/* Placa */}
        <rect x="379" y="76" width="26" height="9" rx="1.5" fill="#e8e0b0" stroke="#b0a870" strokeWidth="0.8" />
        <text x="392" y="83" textAnchor="middle" fill="#2a2800" fontSize="5" fontWeight="bold" fontFamily="Arial">ELX·2025</text>
        {/* Espelho */}
        <rect x="292" y="19" width="6" height="10" rx="1.5" fill="#1a2040" stroke="#3a4e90" strokeWidth="0.8" />

        {/* Chassi */}
        <rect x="8" y="80" width="402" height="7" rx="2" fill="#0a0f20" stroke="#2a3a60" strokeWidth="0.5" />

        {/* RODAS */}
        <g transform="translate(55, 87)">
          <circle r="13" fill="#0f1428" stroke="#3a4e80" strokeWidth="1.5" />
          <circle r="9" fill="#161e38" />
          <circle className="wheel-anim" r="9" fill="none" stroke="#4a6ab0" strokeWidth="1.5" strokeDasharray="7 4" />
          <circle r="3.5" fill="#2a3a60" stroke="#5a7ac0" strokeWidth="1" />
        </g>
        <g transform="translate(108, 87)">
          <circle r="13" fill="#0f1428" stroke="#3a4e80" strokeWidth="1.5" />
          <circle r="9" fill="#161e38" />
          <circle className="wheel-anim" r="9" fill="none" stroke="#4a6ab0" strokeWidth="1.5" strokeDasharray="7 4" />
          <circle r="3.5" fill="#2a3a60" stroke="#5a7ac0" strokeWidth="1" />
        </g>
        <g transform="translate(360, 87)">
          <circle r="13" fill="#0f1428" stroke="#3a4e80" strokeWidth="1.5" />
          <circle r="9" fill="#161e38" />
          <circle className="wheel-anim" r="9" fill="none" stroke="#4a6ab0" strokeWidth="1.5" strokeDasharray="7 4" />
          <circle r="3.5" fill="#2a3a60" stroke="#5a7ac0" strokeWidth="1" />
        </g>

        {/* Luz traseira */}
        <rect x="8" y="22" width="6" height="14" rx="2" fill="#cc2020" opacity="0.9" />
      </svg>
    </div>
  );
}
