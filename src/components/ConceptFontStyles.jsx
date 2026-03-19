import React from 'react';

export default function ConceptFontStyles() {
  return (
    <style>{`
      .concept-font-display { font-family: 'Source Serif 4', Georgia, serif; }
      .concept-font-body { font-family: 'DM Sans', system-ui, sans-serif; }

      @keyframes conceptFadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes conceptScaleIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes conceptGlowPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(212, 147, 13, 0.25); }
        50% { box-shadow: 0 0 0 9px rgba(212, 147, 13, 0); }
      }

      .concept-anim-fade { animation: conceptFadeUp 0.35s ease-out both; }
      .concept-anim-scale { animation: conceptScaleIn 0.28s ease-out both; }
      .concept-anim-pulse { animation: conceptGlowPulse 2.4s ease-in-out infinite; }
    `}</style>
  );
}
