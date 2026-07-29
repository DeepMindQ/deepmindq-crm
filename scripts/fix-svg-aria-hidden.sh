#!/bin/bash
# Add aria-hidden="true" to decorative SVGs missing it
# These are circular progress indicators — purely visual

FILES=(
  src/components/screens/enterprise-screen.tsx
  src/components/shared/design-system.tsx
  src/components/screens/contact-detail-screen.tsx
  src/components/screens/command-center-screen.tsx
  src/components/screens/signal-intelligence-screen.tsx
  src/components/screens/revops-screen.tsx
  src/components/screens/data-health-screen.tsx
  src/components/screens/intelligence-reasoning-screen.tsx
  src/components/screens/pursuit-workspace-screen.tsx
  src/components/screens/companies-screen.tsx
  src/components/screens/pipeline-forecast-screen.tsx
  src/components/screens/company-detail-screen.tsx
  src/components/screens/leads-screen.tsx
  src/components/screens/opportunity-workspace-screen.tsx
)

cd /home/z/my-project

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # Add aria-hidden="true" to <svg tags that don't have it
    # Use perl for reliable in-place editing
    perl -i -pe 's/<svg(?!.*aria-hidden)/<svg aria-hidden="true"/g' "$f"
    echo "Fixed: $f"
  else
    echo "SKIP (not found): $f"
  fi
done

echo "Done. Verifying..."
