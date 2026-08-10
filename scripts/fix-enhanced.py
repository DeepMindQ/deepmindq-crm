#!/usr/bin/env python3
"""Fix company-workspace-enhanced.tsx: Replace Acme Corp demo data with empty defaults."""
import re

path = '/home/z/my-project/src/components/screens/company-workspace-enhanced.tsx'
with open(path, 'r') as f:
    content = f.read()

# Remove the entire fallbackCompany object (from comment to closing };)
content = re.sub(
    r'\/\* ── Fallback mock data ── \*\/\nconst fallbackCompany = \{.*?\};\n',
    '', content, flags=re.DOTALL
)

# Replace: companyData?.data ?? fallbackCompany → companyData?.data ?? null
content = content.replace('companyData?.data ?? fallbackCompany', 'companyData?.data ?? null')

# Replace: ?? fallbackCompany.scoreDimensions → ?? []
content = content.replace('?? fallbackCompany.scoreDimensions', '?? []')

# Replace: ?? fallbackCompany.calibrationFactors → ?? []
content = content.replace('?? fallbackCompany.calibrationFactors', '?? []')

# Replace hardcoded confidence and reason
content = content.replace(
    'overallReason="Score adjusted upward due to converging intelligence signals: leadership change, funding event, and active buying intent."',
    'overallReason={company?.narrative ?? "Score computed from multiple intelligence dimensions."}'
)
content = content.replace(
    'confidence={85}',
    'confidence={company?.intelligenceScore ?? 0}'
)

with open(path, 'w') as f:
    f.write(content)

# Verify
assert 'Acme' not in content, 'Acme reference still found!'
assert 'fallbackCompany' not in content, 'fallbackCompany reference still found!'
assert 'sarah@acme' not in content, 'sarah@acme reference still found!'
assert 'Sequoia' not in content, 'Sequoia reference still found!'
print(f"✅ Fixed {path} — Acme Corp demo data removed, hardcoded confidence/reason fixed")
