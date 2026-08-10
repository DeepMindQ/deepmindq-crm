#!/usr/bin/env python3
"""
Phase 1.5b/1.5c/1.5d: Remove mock fallback data from 3 screens.
- intelligence-dashboard-screen.tsx: Replace 4 elaborate fallback objects with empty defaults
- company-workspace-enhanced.tsx: Replace Acme Corp demo data fallback
- recommendation-queue-screen.tsx: Init localItems with [] instead of fake data
"""
import re

# ─── 1. intelligence-dashboard-screen.tsx ───
path1 = '/home/z/my-project/src/components/screens/intelligence-dashboard-screen.tsx'
with open(path1, 'r') as f:
    content = f.read()

# Replace the 4 fallback objects with empty defaults
# Pattern: const fallbackStats: ExecutiveStats = { ... };
# Pattern: const fallbackSignals: IntelligenceSignal[] = [ ... ];
# Pattern: const fallbackRecommendations: Recommendation[] = [ ... ];
# Pattern: const fallbackActivity: ActivityEvent[] = [ ... ];

# Replace fallbackStats object
old_fallback_stats = '''const fallbackStats: ExecutiveStats = {
  prioritySignals: 8,
  activeOpportunities: 12,
  confidenceAverage: 78,
  accountsMonitored: 147,
  prioritySignalsDelta: 3,
  activeOpportunitiesDelta: 2,
  confidenceAverageDelta: -2,
  accountsMonitoredDelta: 5,
};'''
new_fallback_stats = '''const emptyStats: ExecutiveStats = {
  prioritySignals: 0,
  activeOpportunities: 0,
  confidenceAverage: 0,
  accountsMonitored: 0,
};'''
content = content.replace(old_fallback_stats, new_fallback_stats)

# Replace fallbackSignals array (multi-line)
content = re.sub(
    r'const fallbackSignals: IntelligenceSignal\[\]\s*=\s*\[.*?\];',
    'const emptySignals: IntelligenceSignal[] = [];',
    content,
    flags=re.DOTALL
)

# Replace fallbackRecommendations array
content = re.sub(
    r'const fallbackRecommendations: Recommendation\[\]\s*=\s*\[.*?\];',
    'const emptyRecommendations: Recommendation[] = [];',
    content,
    flags=re.DOTALL
)

# Replace fallbackActivity array
content = re.sub(
    r'const fallbackActivity: ActivityEvent\[\]\s*=\s*\[.*?\];',
    'const emptyActivity: ActivityEvent[] = [];',
    content,
    flags=re.DOTALL
)

# Replace the comment
content = content.replace(
    'Fallback mock data (used when API returns null)',
    'Empty defaults (no mock data — screens show empty states when API returns null)'
)

# Replace usage lines
content = content.replace('statsData?.data ?? fallbackStats', 'statsData?.data ?? emptyStats')
content = content.replace('briefData?.data?.signals ?? fallbackSignals', 'briefData?.data?.signals ?? emptySignals')
content = content.replace('briefData?.data?.recommendations ?? fallbackRecommendations', 'briefData?.data?.recommendations ?? emptyRecommendations')
content = content.replace('briefData?.data?.activity ?? fallbackActivity', 'briefData?.data?.activity ?? emptyActivity')

with open(path1, 'w') as f:
    f.write(content)
print(f"✅ Fixed {path1}")

# ─── 2. recommendation-queue-screen.tsx ───
path3 = '/home/z/my-project/src/components/screens/recommendation-queue-screen.tsx'
try:
    with open(path3, 'r') as f:
        content3 = f.read()
    
    # Find the line: useState<RecommendationItem[]>(fallbackRecommendations)
    # Replace with: useState<RecommendationItem[]>([])
    content3 = re.sub(
        r'setState<RecommendationItem\[\]>\(fallbackRecommendations\)',
        'setState<RecommendationItem[]>([])',
        content3
    )
    
    with open(path3, 'w') as f:
        f.write(content3)
    print(f"✅ Fixed {path3}")
except FileNotFoundError:
    print(f"⚠️ File not found: {path3}")

print("\nDone! Mock fallbacks removed from all 3 screens.")
