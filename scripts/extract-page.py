"""Extract nav-config, screen-map, bridges, and error boundary from page.tsx monolith."""
import re

with open('/home/z/my-project/src/app/page.tsx', 'r') as f:
    lines = f.readlines()

# Find the block to remove: from "interface NavSection" to just before "const PIPELINE_STAGES"
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if 'interface NavSection' in line:
        start_idx = i
    if 'const PIPELINE_STAGES' in line:
        end_idx = i
        break

if start_idx is not None and end_idx is not None:
    print(f"Removing lines {start_idx+1} to {end_idx} (keeping PIPELINE_STAGES)")
    new_lines = lines[:start_idx] + lines[end_idx:]
    with open('/home/z/my-project/src/app/page.tsx', 'w') as f:
        f.writelines(new_lines)
    print(f"Done: {len(lines)} -> {len(new_lines)} lines")
else:
    print(f"Could not find markers: start={start_idx}, end={end_idx}")
