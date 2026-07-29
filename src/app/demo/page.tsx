import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DeepMindQ — Enterprise Revenue Intelligence OS',
  description: 'AI-powered revenue intelligence that transforms how enterprise sales teams identify, engage, and win. See live intelligence in action.',
};

export default function DemoLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/10 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 relative">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold">
              D
            </div>
            <span className="text-xl font-semibold text-gray-300">DeepMindQ</span>
            <span className="ml-3 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30">
              Live Demo
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Enterprise Revenue
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Intelligence OS
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mb-10">
            AI-powered intelligence that transforms how enterprise sales teams identify buying signals,
            match capabilities, and close deals — all in real-time.
          </p>

          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-blue-500/25"
          >
            Enter Intelligence Center
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>

      {/* Intelligence Pipeline Visualization */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-12 text-center">
          How DeepMindQ Thinks
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* External Intelligence */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">External Intelligence</h3>
            <p className="text-gray-400 text-sm mb-4">
              Real-time web search, signal detection, evidence collection, and company profiling.
            </p>
            <div className="space-y-2">
              {['Tavily Web Search', 'Signal Extraction (LLM)', 'Evidence Records', 'Research Card'].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Internal Intelligence */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-purple-500/30 ring-1 ring-purple-500/10">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-purple-300">Internal Intelligence</h3>
            <p className="text-gray-400 text-sm mb-4">
              Your capabilities, case studies, proof points, and objection responses — the knowledge graph.
            </p>
            <div className="space-y-2">
              {['Capability Assets', 'Case Study Matching', 'Proof Points', 'Objection Handling'].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Opportunity Intelligence */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Opportunity Intelligence</h3>
            <p className="text-gray-400 text-sm mb-4">
              Fused intelligence that tells you who to target, why now, what to sell, and what to say.
            </p>
            <div className="space-y-2">
              {['Signal × Capability Fusion', 'Win Probability', 'Conversation Strategy', 'Executive Brief'].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
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
            <div key={i} className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/30">
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
              <div className="text-xs text-gray-500">{stat.detail}</div>
            </div>
          ))}
        </div>

        {/* Architecture */}
        <h2 className="text-2xl font-bold mb-8 text-center">
          Live Intelligence Pipeline
        </h2>
        <div className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700/30 font-mono text-sm text-gray-300 overflow-x-auto">
          <div className="space-y-1">
            {[
              { stage: '1', name: 'Company Profile Assessment', status: 'computed', color: 'text-gray-400' },
              { stage: '2', name: 'Contact Intelligence', status: 'computed', color: 'text-gray-400' },
              { stage: '3', name: 'Buying Committee Detection', status: 'computed', color: 'text-gray-400' },
              { stage: '4', name: 'Signal Detection Assessment', status: 'computed', color: 'text-gray-400' },
              { stage: '5', name: 'Evidence Collection', status: 'computed', color: 'text-gray-400' },
              { stage: '6', name: 'Research Card', status: 'computed', color: 'text-gray-400' },
              { stage: '7', name: 'Revenue Intelligence Score', status: 'computed', color: 'text-gray-400' },
              { stage: '8', name: 'Capability Matching (LLM)', status: 'ai', color: 'text-purple-400' },
              { stage: '9', name: 'Case Study Matching', status: 'ai', color: 'text-purple-400' },
              { stage: '10', name: 'Solution Matching', status: 'ai', color: 'text-purple-400' },
              { stage: '11', name: 'Competitive Positioning', status: 'ai', color: 'text-purple-400' },
              { stage: '12', name: 'Intelligence Fusion', status: 'fusion', color: 'text-green-400' },
              { stage: '13', name: 'Win Probability', status: 'ai', color: 'text-purple-400' },
              { stage: '14', name: 'Recommended Actions', status: 'ai', color: 'text-purple-400' },
              { stage: '15', name: 'Conversation Strategy', status: 'ai', color: 'text-purple-400' },
              { stage: '16', name: 'Executive Brief', status: 'ai', color: 'text-purple-400' },
              { stage: '17', name: 'Persist All + Score', status: 'persist', color: 'text-blue-400' },
            ].map((item) => (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="w-6 text-gray-500 text-right">{item.stage}.</span>
                <span className={`w-2 h-2 rounded-full ${item.status === 'ai' ? 'bg-purple-400' : item.status === 'fusion' ? 'bg-green-400' : item.status === 'persist' ? 'bg-blue-400' : 'bg-gray-600'}`} />
                <span className={item.color}>{item.name}</span>
                {item.status === 'ai' && <span className="text-xs text-purple-500/50 ml-auto">LLM</span>}
                {item.status === 'fusion' && <span className="text-xs text-green-500/50 ml-auto">FUSION</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-500 text-sm">
          <p>DeepMindQ — Enterprise Revenue Intelligence Operating System</p>
          <p className="mt-1">Confidential Investor Demo</p>
        </div>
      </div>
    </div>
  );
}
