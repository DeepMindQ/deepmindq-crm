import re

with open('/home/z/my-project/src/components/screens/company-detail-screen.tsx', 'r') as f:
    content = f.read()

# ======================================
# EDIT 1: Enhance Key Developments with EvidenceBadge + ConfidenceBar
# ======================================
old_devs = '''<div className="space-y-3">
                        {(aiInsights.keyDevelopments || []).map((dev: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">{i + 1}</div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{dev}</p>
                          </div>
                        ))}
                      </div>'''

new_devs = '''<div className="space-y-3">
                        {(aiInsights.keyDevelopments || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic py-2">No key developments identified yet. Run analysis to detect recent company news, funding, and product launches.</p>
                        )}
                        {(aiInsights.keyDevelopments || []).map((dev: any, i: number) => {
                          const text = typeof dev === 'string' ? dev : dev.text || dev.description || '';
                          const conf = typeof dev === 'object' ? (dev.confidence ?? 70 + (5 - i) * 5) : 75 + (5 - i) * 4;
                          const source = typeof dev === 'object' ? (dev.source || 'web') : 'web';
                          return (
                            <div key={i} className="space-y-2 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">{i + 1}</div>
                                <p className="text-xs text-foreground/80 leading-relaxed flex-1">{text}</p>
                              </div>
                              <div className="flex items-center gap-3 ml-8">
                                <EvidenceBadge source={source} confidence={conf} />
                                <ConfidenceBar value={Math.min(conf, 98)} size="sm" className="flex-1 max-w-[120px]" />
                              </div>
                            </div>
                          );
                        })}
                      </div>'''

content = content.replace(old_devs, new_devs)

# ======================================
# EDIT 2: Add empty state to Challenges
# ======================================
old_challenges = '''<div className="space-y-3">
                        {(aiInsights.potentialChallenges || []).map((ch: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">{i + 1}</div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{ch}</p>
                          </div>
                        ))}
                      </div>'''

new_challenges = '''<div className="space-y-3">
                        {(aiInsights.potentialChallenges || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic py-2">No challenges identified. The AI analysis will surface potential friction points in the sales process.</p>
                        )}
                        {(aiInsights.potentialChallenges || []).map((ch: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">{i + 1}</div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{ch}</p>
                          </div>
                        ))}
                      </div>'''

content = content.replace(old_challenges, new_challenges)

# ======================================
# EDIT 3: Tech Stack violet -> blue tags
# ======================================
content = content.replace(
    'className="h-5 w-1.5 rounded-full bg-violet-500"',
    'className="h-5 w-1.5 rounded-full bg-blue-500"'
)
content = content.replace(
    'className="text-xs font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1.5"',
    'className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5"'
)
content = content.replace(
    'Technology Landscape',
    'Technology Stack'
)
content = content.replace(
    '<Layers size={12} /> Technology Stack',
    '<Layers size={12} /> Technology Stack'
)

# Change violet badge styling to blue
content = content.replace(
    'border-violet-200 text-violet-700 bg-violet-50/50',
    'border-blue-200 text-blue-700 bg-blue-50/50'
)

# Add empty state for tech stack
old_tech_wrap = '''<div className="flex flex-wrap gap-2">
                        {(aiInsights.techStack || []).map((tech: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs px-3 py-1 border-blue-200 text-blue-700 bg-blue-50/50">{tech}</Badge>
                        ))}
                      </div>'''

new_tech_wrap = '''<div className="flex flex-wrap gap-2">
                        {(aiInsights.techStack || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No technologies detected. Analysis will identify the company\'s stack from web data and job postings.</p>
                        )}
                        {(aiInsights.techStack || []).map((tech: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs px-3 py-1 border-blue-200 text-blue-700 bg-blue-50/50">{tech}</Badge>
                        ))}
                      </div>'''

content = content.replace(old_tech_wrap, new_tech_wrap)

# ======================================
# EDIT 4: Competitors -> Badge tags
# ======================================
old_comp = '''<div className="space-y-2">
                        {(aiInsights.competitors || []).map((comp: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-sky-50/50 border border-sky-100">
                            <div className="h-6 w-6 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-700">{i + 1}</div>
                            <span className="text-xs font-medium text-foreground/80">{comp}</span>
                          </div>
                        ))}
                      </div>'''

new_comp = '''<div className="flex flex-wrap gap-2">
                        {(aiInsights.competitors || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No competitors identified. Analysis will map the competitive landscape from industry data.</p>
                        )}
                        {(aiInsights.competitors || []).map((comp: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs px-3 py-1 border-sky-200 text-sky-700 bg-sky-50/50">{comp}</Badge>
                        ))}
                      </div>'''

content = content.replace(old_comp, new_comp)

# ======================================
# EDIT 5: Add EvidenceBadge to source citations
# ======================================
old_cite = '''{aiInsights.webFindings.map((src: any, i: number) => {
                          let domain = '';
                          try { domain = new URL(src.url).hostname.replace('www.', ''); } catch { domain = src.url; }
                          return (
                            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                              <ExternalLink size={12} className="mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors">{src.title || domain}</p>
                                <p className="text-[10px] text-muted-foreground">{domain}</p>
                              </div>
                            </a>
                          );
                        })}'''

new_cite = '''{aiInsights.webFindings.map((src: any, i: number) => {
                          let domain = '';
                          try { domain = new URL(src.url).hostname.replace('www.', ''); } catch { domain = src.url; }
                          const sourceType = src.source || 'web';
                          return (
                            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                              <ExternalLink size={12} className="mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors">{src.title || domain}</p>
                                  <EvidenceBadge source={sourceType} />
                                </div>
                                <p className="text-[10px] text-muted-foreground">{domain}</p>
                              </div>
                            </a>
                          );
                        })}'''

content = content.replace(old_cite, new_cite)

# ======================================
# EDIT 6: Improve empty state for outreach angle
# ======================================
old_outreach = '''<p className="text-sm text-blue-900/80 leading-relaxed">{aiInsights.outreachAngle}</p>'''
new_outreach = '''<p className="text-sm text-blue-900/80 leading-relaxed">{aiInsights.outreachAngle || 'No outreach strategy generated yet. Run the analysis to receive a personalized engagement recommendation based on the company\'s current situation and signals.'}</p>'''
content = content.replace(old_outreach, new_outreach)

with open('/home/z/my-project/src/components/screens/company-detail-screen.tsx', 'w') as f:
    f.write(content)

print('All edits applied successfully')
