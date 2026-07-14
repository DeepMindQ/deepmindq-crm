export default function Loading() {
  return (
    <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)' }}
        >
          <svg className="w-6 h-6 text-white animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#3A4555' }}>
          Loading DeepMindQ...
        </p>
      </div>
    </div>
  );
}