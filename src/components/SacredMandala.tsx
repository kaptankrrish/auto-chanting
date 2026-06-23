import React from 'react';

const SacredMandala: React.FC<{ active?: boolean }> = ({ active = false }) => {
  return (
    <div className={`mandala-wrapper ${active ? 'is-active' : ''}`}>
      <svg className="mandala-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Glowing Center */}
        <circle cx="100" cy="100" r="40" fill="url(#glow)" className="mandala-glow" />
        
        {/* Geometric Layers */}
        <g className="mandala-layer-1">
          <circle cx="100" cy="100" r="90" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,6" opacity="0.5" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--text-primary)" strokeWidth="0.2" opacity="0.3" />
        </g>
        
        <g className="mandala-layer-2">
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x = 100 + 45 * Math.cos(angle);
            const y = 100 + 45 * Math.sin(angle);
            return <circle key={i} cx={x} cy={y} r="25" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.4" />;
          })}
        </g>

        <g className="mandala-layer-3">
          <polygon points="100,20 169.28,60 169.28,140 100,180 30.72,140 30.72,60" fill="none" stroke="var(--text-primary)" strokeWidth="0.3" opacity="0.4" />
          <polygon points="100,20 169.28,60 169.28,140 100,180 30.72,140 30.72,60" fill="none" stroke="var(--text-primary)" strokeWidth="0.3" opacity="0.4" transform="rotate(30 100 100)" />
        </g>

        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="var(--text-primary)" />
        <circle cx="100" cy="100" r="12" fill="none" stroke="var(--text-primary)" strokeWidth="0.5" strokeDasharray="1,2" />
      </svg>
    </div>
  );
};

export default SacredMandala;
