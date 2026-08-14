import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DeepMindQ — Enterprise Intelligence OS',
  description:
    'AI-powered intelligence that transforms how enterprise sales teams identify, engage, and win. See live intelligence in action.',
};

export default function DemoLandingPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(180deg, #0a0c10 0%, #0f1219 50%, #141821 100%)' }}
    >
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/15 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 relative">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-lg font-bold">
              D
            </div>
            <span className="text-xl font-semibold text-[#8892a8]">DeepMindQ</span>
            <span className="ml-3 px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium border border-blue-500/25">
              Live Demo
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 text-[#e8ecf4]">
            Enterprise Revenue
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              Intelligence OS
            </span>
          </h1>

          <p className="text-xl text-[#8892a8] max-w-2xl mb-10">
            AI-powered intelligence that transforms how enterprise sales teams identify buying
            signals, match capabilities, and close deals — all in real-time.
          </p>

          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#2563EB] text-white font-semibold text-lg hover:bg-[#1D4ED8] transition-all shadow-lg shadow-blue-600/20"
          >
            Enter Intelligence Center
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Intelligence Pipeline Visualization */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-12 text-center text-[#e8ecf4]">
          How DeepMindQ Thinks
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* External Intelligence */}
          <div
            className="rounded-2xl p-6 border border-[#1e2535]"
            style={{ backgroundColor: '#141821' }}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#e8ecf4]">External Intelligence</h3>
            <p className="text-[#8892a8] text-sm mb-4">
              Real-time web search, signal detection, evidence collection, and company profiling.
            </p>
            <div className="space-y-2">
              {[
                'Tavily Web Search',
                'Signal Extraction (LLM)',
                'Evidence Records',
                'Research Card',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#8892a8]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Internal Intelligence */}
          <div
            className="rounded-2xl p-6 border border-blue-500/25 ring-1 ring-blue-500/10"
            style={{ backgroundColor: '#141821' }}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-blue-300">Internal Intelligence</h3>
            <p className="text-[#8892a8] text-sm mb-4">
              Your capabilities, case studies, proof points, and objection responses — the knowledge
              graph.
            </p>
            <div className="space-y-2">
              {[
                'Capability Assets',
                'Case Study Matching',
                'Proof Points',
                'Objection Handling',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#8892a8]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Opportunity Intelligence */}
          <div
            className="rounded-2xl p-6 border border-[#1e2535]"
            style={{ backgroundColor: '#141821' }}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#e8ecf4]">Opportunity Intelligence</h3>
            <p className="text-[#8892a8] text-sm mb-4">
              Fused intelligence that tells you who to target, why now, what to sell, and what to
              say.
            </p>
            <div className="space-y-2">
              {[
                'Signal × Capability Fusion',
                'Win Probability',
                'Conversation Strategy',
                'Executive Brief',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#8892a8]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {[
            { label: 'AI Calls / Company', value: '~23', detail: 'Full enrichment + pipeline' },
            { label: 'Cost / Company', value: '~$0.08', detail: 'Tiered LLM routing' },
            { label: 'Pipeline Stages', value: '17', detail: 'End-to-end intelligence' },
            { label: 'Data Persistence', value: '100%', detail: 'Every output stored' },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-xl p-5 border border-[#1e2535]"
              style={{ backgroundColor: '#141821' }}
            >
              <div className="text-2xl font-bold text-[#e8ecf4] mb-1">{stat.value}</div>
              <div className="text-sm text-[#8892a8] mb-1">{stat.label}</div>
              <div className="text-xs text-[#5a6478]">{stat.detail}</div>
            </div>
          ))}
        </div>

        {/* Architecture */}
        <h2 className="text-2xl font-bold mb-8 text-center text-[#e8ecf4]">
          Live Intelligence Pipeline
        </h2>
        <div
          className="rounded-2xl p-8 border border-[#1e2535] font-mono text-sm text-[#8892a8] overflow-x-auto"
          style={{ backgroundColor: '#141821' }}
        >
          <div className="space-y-1">
            {[
              {
                stage: '1',
                name: 'Company Profile Assessment',
                status: 'computed',
                color: 'text-[#8892a8]',
              },
              {
                stage: '2',
                name: 'Contact Intelligence',
                status: 'computed',
                color: 'text-[#8892a8]',
              },
              {
                stage: '3',
                name: 'Buying Committee Detection',
                status: 'computed',
                color: 'text-[#8892a8]',
              },
              {
                stage: '4',
                name: 'Signal Detection Assessment',
                status: 'computed',
                color: 'text-[#8892a8]',
              },
              {
                stage: '5',
                name: 'Evidence Collection',
                status: 'computed',
                color: 'text-[#8892a8]',
              },
              { stage: '6', name: 'Research Card', status: 'computed', color: 'text-[#8892a8]' },
              {
                stage: '7',
                name: 'Revenue Intelligence Score',
                status: 'computed',
                color: 'text-[#8892a8]',
              },
              {
                stage: '8',
                name: 'Capability Matching (LLM)',
                status: 'ai',
                color: 'text-blue-400',
              },
              { stage: '9', name: 'Case Study Matching', status: 'ai', color: 'text-blue-400' },
              { stage: '10', name: 'Solution Matching', status: 'ai', color: 'text-blue-400' },
              {
                stage: '11',
                name: 'Competitive Positioning',
                status: 'ai',
                color: 'text-blue-400',
              },
              {
                stage: '12',
                name: 'Intelligence Fusion',
                status: 'fusion',
                color: 'text-green-400',
              },
              { stage: '13', name: 'Win Probability', status: 'ai', color: 'text-blue-400' },
              { stage: '14', name: 'Recommended Actions', status: 'ai', color: 'text-blue-400' },
              {
                stage: '15',
                name: 'Conversation Strategy',
                status: 'ai',
                color: 'text-blue-400',
              },
              { stage: '16', name: 'Executive Brief', status: 'ai', color: 'text-blue-400' },
              {
                stage: '17',
                name: 'Persist All + Score',
                status: 'persist',
                color: 'text-blue-400',
              },
            ].map((item) => (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="w-6 text-[#5a6478] text-right">{item.stage}.</span>
                <span
                  className={`w-2 h-2 rounded-full ${item.status === 'ai' ? 'bg-blue-400' : item.status === 'fusion' ? 'bg-green-400' : item.status === 'persist' ? 'bg-blue-400' : 'bg-[#5a6478]'}`}
                />
                <span className={item.color}>{item.name}</span>
                {item.status === 'ai' && (
                  <span className="text-xs text-blue-500/50 ml-auto">LLM</span>
                )}
                {item.status === 'fusion' && (
                  <span className="text-xs text-green-500/50 ml-auto">FUSION</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-[#5a6478] text-sm">
          <p className="text-[#8892a8]">DeepMindQ — Enterprise Intelligence OS</p>
          <p className="mt-1">Confidential Investor Demo</p>
        </div>
      </div>
    </div>
  );
}
