#!/usr/bin/env python3
"""Fix touch target sizes on interactive elements in screen files.
   WCAG minimum: 44px. Replace undersized height classes on buttons/interactive elements.
"""
import re, os, glob

SCREENS_DIR = "/home/z/my-project/src/components/screens"

# Patterns that indicate an interactive element (within ~3 lines)
INTERACTIVE_PATTERNS = [
    r'<Button[\s>]', r'<button[\s>]', r'onClick\s*=', r'role="button"',
    r'type="button"', r'type="submit"', r'<Select', r'<MenuItem',
    r'asChild', r'<Trigger',
]

# Height class replacements (only on interactive lines)
HEIGHT_MAP = {
    'h-7': 'h-10',   # 28px -> 40px
    'h-8': 'h-10',   # 32px -> 40px
    'h-9': 'h-10',   # 36px -> 40px
    # h-10 (40px) is close enough, leave as-is
}

PY_MAP = {
    'py-1.5': 'py-2.5',  # ~24px -> ~32px (combined with h-10 = >44px)
    # py-2 on buttons already ~32px, leave
}

changed_files = {}
total_changes = 0

for fpath in sorted(glob.glob(os.path.join(SCREENS_DIR, "*.tsx"))):
    with open(fpath, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    file_changed = False
    
    # Track if we're near an interactive element (look ahead 2 lines)
    for i, line in enumerate(lines):
        original = line
        
        # Check if this line or next 2 lines have interactive patterns
        context = line
        for j in range(1, 3):
            if i + j < len(lines):
                context += lines[i + j]
        
        is_interactive = any(re.search(p, context) for p in INTERACTIVE_PATTERNS)
        
        # Also check if the line itself is inside a button (has className with h-7/8/9)
        # and the line contains button-like attributes
        if not is_interactive:
            if re.search(r'className.*\bh-[789]\b', line) and re.search(r'onClick|cursor-pointer|hover:', line):
                is_interactive = True
        
        if is_interactive:
            # Replace height classes
            for old, new in HEIGHT_MAP.items():
                # Match h-7/h-8/h-9 as whole words in className strings
                line = re.sub(rf'\b{old}\b(?!\s*-)', new, line)
            
            # Replace py-1.5 on button-adjacent lines
            if re.search(r'<Button|<button', context):
                for old, new in PY_MAP.items():
                    line = re.sub(rf'\b{old}\b', new, line)
        
        if line != original:
            file_changed = True
        
        new_lines.append(line)
    
    if file_changed:
        with open(fpath, 'w') as f:
            f.writelines(new_lines)
        
        # Count changes
        count = sum(1 for a, b in zip(lines, new_lines) if a != b)
        fname = os.path.basename(fpath)
        changed_files[fname] = count
        total_changes += count

print(f"=== Touch Target Fix Report ===")
print(f"Files modified: {len(changed_files)}")
print(f"Total lines changed: {total_changes}")
print()
for fname, count in sorted(changed_files.items(), key=lambda x: -x[1]):
    print(f"  {fname}: {count} lines")
