#!/usr/bin/env python3
"""
Comprehensive light-theme fix script v2.
Fixes all broken patterns from the bad bulk regex conversion.
"""
import re, os, glob

BASE = "/home/z/my-project/src"

# ── Pattern definitions (order matters: more specific first) ──

# 1. CRITICAL: bg-black/90, bg-black/30 — dropdowns/popovers that are nearly black
#    These should be white with border + shadow (popovers, select dropdowns, tooltips)
REPLACEMENTS = [
    # ── CRITICAL: Dark panels/overlays used as UI containers ──
    # bg-black/90 used for TooltipContent, PopoverContent → white panel
    (re.compile(r'bg-black/90\s+backdrop-blur-xl'), 'bg-white border border-gray-200 shadow-lg'),
    (re.compile(r'bg-black/90\s+backdrop-blur-2xl'), 'bg-white border border-gray-200 shadow-lg'),
    (re.compile(r'bg-black/30\s+backdrop-blur-2xl'), 'bg-white border border-gray-200 shadow-lg'),
    
    # bg-black/20 used for SelectContent, PopoverContent (NOT overlays) → white
    # But be careful: bg-black/20 backdrop-blur-sm as overlay is OK
    # Pattern: bg-black/20 backdrop-blur-2xl (used for dropdowns)
    (re.compile(r'bg-black/20\s+backdrop-blur-2xl'), 'bg-white border border-gray-200 shadow-lg'),
    (re.compile(r'bg-black/25\s+backdrop-blur-sm'), 'bg-black/30 backdrop-blur-sm'),  # modal overlay - keep dark but reduce
    
    # bg-black/20 used for stat cards → bg-white with border
    (re.compile(r'bg-black/20\s+border\s+border-gray-200'), 'bg-white border border-gray-200 shadow-sm'),
    
    # ── CRITICAL: bg-zinc-950 panels → white ──
    (re.compile(r'bg-zinc-950'), 'bg-white'),
    (re.compile(r'border-zinc-800/80'), 'border-gray-200'),
    
    # ── CRITICAL: bg-gray-900 panels → white ──
    (re.compile(r'bg-gray-900(?!\s*\/)'), 'bg-white'),  # not bg-gray-900/opacity
    
    # ── CRITICAL: text-white on white backgrounds ──
    # "bg-white text-white" → "bg-amber-600 text-white" (toggle buttons)
    (re.compile(r"bg-white\s+text-white\s+shadow-xs"), 'bg-amber-600 text-white shadow-xs'),
    # "text-white" as heading on white bg → "text-gray-900"
    # We'll handle specific files manually below
    
    # ── bg-black/[0.0X] smudge backgrounds → bg-white or bg-gray-50 ──
    # Very subtle backgrounds (0.01-0.04) → just remove or use bg-gray-50
    (re.compile(r'bg-black/\[0\.01\]'), 'bg-gray-50/50'),
    (re.compile(r'bg-black/\[0\.02\]'), 'bg-gray-50'),
    (re.compile(r'bg-black/\[0\.03\]'), 'bg-gray-50'),
    (re.compile(r'bg-black/\[0\.04\]'), 'bg-gray-100/50'),
    (re.compile(r'bg-black/\[0\.05\]'), 'bg-gray-100/50'),
    (re.compile(r'bg-black/\[0\.06\]'), 'bg-gray-100'),
    
    # ── hover:bg-black/[0.0X] → hover:bg-gray-100 or hover:bg-gray-50 ──
    (re.compile(r'hover:bg-black/\[0\.01\]'), 'hover:bg-gray-50'),
    (re.compile(r'hover:bg-black/\[0\.02\]'), 'hover:bg-gray-50'),
    (re.compile(r'hover:bg-black/\[0\.03\]'), 'hover:bg-gray-100/60'),
    (re.compile(r'hover:bg-black/\[0\.04\]'), 'hover:bg-gray-100/60'),
    (re.compile(r'hover:bg-black/\[0\.05\]'), 'hover:bg-gray-100'),
    (re.compile(r'hover:bg-black/\[0\.06\]'), 'hover:bg-gray-100'),
    (re.compile(r'hover:bg-black/5'), 'hover:bg-gray-100'),
    (re.compile(r'hover:bg-black/10'), 'hover:bg-gray-100'),
    (re.compile(r'hover:bg-black/20'), 'hover:bg-gray-200'),
    
    # ── border-white/[0.X] ghost borders → border-gray-200 ──
    (re.compile(r'border-white/\[0\.0[1-5]\]'), 'border-gray-100'),
    (re.compile(r'border-white/\[0\.0[6-9]\]'), 'border-gray-200'),
    (re.compile(r'border-white/\[0\.1\]'), 'border-gray-200'),
    (re.compile(r'border-white/\[0\.15\]'), 'border-gray-200'),
    (re.compile(r'border-white/\[0\.2\]'), 'border-gray-300'),
    (re.compile(r'border-white/5'), 'border-gray-100'),
    (re.compile(r'border-white/10'), 'border-gray-200'),
    (re.compile(r'border-white/20'), 'border-gray-300'),
    
    # ── bg-white/[0.01-0.02] no-op on white → bg-gray-50 or remove ──
    (re.compile(r'bg-white/\[0\.01\]'), 'bg-gray-50/50'),
    (re.compile(r'bg-white/\[0\.02\]'), 'bg-gray-50'),
    (re.compile(r'bg-white/\[0\.03\]'), 'bg-gray-50'),
    (re.compile(r'bg-white/\[0\.04\]'), 'bg-gray-100/50'),
    (re.compile(r'bg-white/\[0\.05\]'), 'bg-gray-100/50'),
    
    # ── rgba(0,0,0,0.0X) inline styles → proper light equivalents ──
    (re.compile(r"rgba\(0,0,0,0\.01\)"), 'rgba(0,0,0,0.02)'),
    (re.compile(r"rgba\(0,0,0,0\.015\)"), '#F9FAFB'),
    (re.compile(r"rgba\(0,0,0,0\.02\)"), '#F9FAFB'),
    (re.compile(r"rgba\(0,0,0,0\.03\)"), '#F3F4F6'),
    (re.compile(r"rgba\(0,0,0,0\.04\)"), '#F3F4F6'),
    (re.compile(r"rgba\(0,0,0,0\.05\)"), '#F3F4F6'),
    (re.compile(r"rgba\(0,0,0,0\.06\)"), '#E5E7EB'),
    
    # ── shadow-black/X → shadow-gray ──
    (re.compile(r'shadow-black/20'), 'shadow-gray-300/30'),
    (re.compile(r'shadow-black/30'), 'shadow-gray-300/40'),
    (re.compile(r'shadow-black/40'), 'shadow-gray-400/30'),
    (re.compile(r'shadow-black/50'), 'shadow-gray-400/40'),
    
    # ── bg-black/5 used for checkbox backgrounds → bg-gray-100 ──
    (re.compile(r'bg-black/5(?!\s*hover)'), 'bg-gray-100'),
]

# ── File-specific fixes ──

SPECIFIC_FIXES = {
    "companies-screen.tsx": [
        # Fix invisible "Companies" heading
        (re.compile(r'text-lg font-bold tracking-tight text-white'), 'text-lg font-bold tracking-tight text-gray-900'),
        # Fix invisible company name
        (re.compile(r'text-sm font-medium text-white truncate'), 'text-sm font-medium text-gray-900 truncate'),
    ],
    "opportunities-screen.tsx": [
        (re.compile(r"bg-white text-white shadow-xs"), 'bg-amber-600 text-white shadow-xs'),
    ],
    "tasks-screen.tsx": [
        (re.compile(r"bg-white text-white shadow-xs"), 'bg-amber-600 text-white shadow-xs'),
    ],
    "contacts-screen.tsx": [
        # Fix dark floating toolbar
        (re.compile(r'bg-gray-900 text-white rounded-2xl shadow-2xl'), 'bg-white text-gray-900 rounded-2xl shadow-lg border border-gray-200'),
    ],
    "design-system.tsx": [
        # Fix nearly invisible sort icon
        (re.compile(r'text-gray-300 group-hover:text-gray-400'), 'text-gray-400 group-hover:text-gray-600'),
    ],
}

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    filename = os.path.basename(filepath)
    
    # Apply general replacements
    for pattern, replacement in REPLACEMENTS:
        content = pattern.sub(replacement, content)
    
    # Apply file-specific fixes
    if filename in SPECIFIC_FIXES:
        for pattern, replacement in SPECIFIC_FIXES[filename]:
            content = pattern.sub(replacement, content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        
        # Count changes
        changes = sum(1 for a, b in zip(original.split('\n'), content.split('\n')) if a != b)
        return changes
    
    return 0

def main():
    total_changes = 0
    files_changed = 0
    
    # Process all screen files
    patterns = [
        os.path.join(BASE, "components", "screens", "*.tsx"),
        os.path.join(BASE, "components", "shared", "*.tsx"),
        os.path.join(BASE, "app", "page.tsx"),
    ]
    
    for pattern in patterns:
        for filepath in glob.glob(pattern):
            changes = fix_file(filepath)
            if changes > 0:
                files_changed += 1
                total_changes += changes
                print(f"  ✅ {os.path.basename(filepath)}: {changes} lines changed")
    
    print(f"\n{'='*60}")
    print(f"Total: {files_changed} files changed, {total_changes} lines modified")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()