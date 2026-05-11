'use client'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0f172a' }}>

      {/* Logo + texte */}
      <div className="relative z-10 flex flex-col items-center gap-3 animate-[fadeInUp_0.6s_ease_forwards]">
        {/* Icône vague stylisée */}
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <circle cx="28" cy="28" r="28" fill="#1e40af" fillOpacity="0.3" />
          <path
            d="M12 32c2-4 5-6 8-4s5 6 8 4 5-6 8-4 5 6 8 4"
            stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" fill="none"
          />
          <path
            d="M12 38c2-4 5-6 8-4s5 6 8 4 5-6 8-4 5 6 8 4"
            stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"
          />
        </svg>

        <h1 className="text-3xl font-bold text-white tracking-wide">Eolis Connect</h1>
        <p className="text-blue-300 text-sm tracking-widest uppercase">Eolis Cameroun</p>

        {/* Dots de chargement */}
        <div className="flex gap-2 mt-6">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* Vagues animées en bas */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden" style={{ height: '160px' }}>
        {/* Vague 1 */}
        <div className="absolute bottom-0 left-0" style={{ width: '200%', animation: 'wave1 6s linear infinite' }}>
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: '120px', display: 'inline-block' }}>
            <path d="M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z"
              fill="#1e3a8a" fillOpacity="0.7" />
          </svg>
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: '120px', display: 'inline-block' }}>
            <path d="M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z"
              fill="#1e3a8a" fillOpacity="0.7" />
          </svg>
        </div>

        {/* Vague 2 */}
        <div className="absolute bottom-0 left-0" style={{ width: '200%', animation: 'wave2 9s linear infinite' }}>
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: '100px', display: 'inline-block' }}>
            <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z"
              fill="#1e40af" fillOpacity="0.5" />
          </svg>
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: '100px', display: 'inline-block' }}>
            <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z"
              fill="#1e40af" fillOpacity="0.5" />
          </svg>
        </div>

        {/* Vague 3 */}
        <div className="absolute bottom-0 left-0" style={{ width: '200%', animation: 'wave3 12s linear infinite reverse' }}>
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: '80px', display: 'inline-block' }}>
            <path d="M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z"
              fill="#2563eb" fillOpacity="0.4" />
          </svg>
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: '80px', display: 'inline-block' }}>
            <path d="M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z"
              fill="#2563eb" fillOpacity="0.4" />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }
        @keyframes wave1 {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes wave2 {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes wave3 {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
