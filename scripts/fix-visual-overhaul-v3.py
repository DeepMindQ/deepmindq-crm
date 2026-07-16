#!/usr/bin/env python3
"""
Comprehensive visual overhaul v3 — fixes ALL remaining dark-theme remnants.
Addresses: badge colors, tooltips, hex colors, dark panels, chart elements, hover states.
"""
import re, os, glob

BASE = "/home/z/my-project/src"

# ══════════════════════════════════════════════════════════════════
# PHASE 1: Badge/Status colors — -300 variants invisible on white
# ══════════════════════════════════════════════════════════════════
BADGE_FIXES = [
    # text-emerald-300 → text-emerald-700 (green badges)
    (re.compile(r'text-emerald-300'), 'text-emerald-700'),
    (re.compile(r'border-emerald-300'), 'border-emerald-700'),
    (re.compile(r'bg-emerald-300/'), 'bg-emerald-700/'),
    (re.compile(r'bg-emerald-300\b'), 'bg-emerald-700'),
    
    # text-amber-300 → text-amber-700 (yellow/warning badges)
    (re.compile(r'text-amber-300'), 'text-amber-700'),
    (re.compile(r'border-amber-300'), 'border-amber-700'),
    (re.compile(r'bg-amber-300/'), 'bg-amber-700/'),
    (re.compile(r'bg-amber-300\b'), 'bg-amber-700'),
    
    # text-red-300 → text-red-600 (red/error badges - 600 for better visibility)
    (re.compile(r'text-red-300'), 'text-red-600'),
    (re.compile(r'border-red-300'), 'border-red-600'),
    (re.compile(r'bg-red-300/'), 'bg-red-600/'),
    (re.compile(r'bg-red-300\b'), 'bg-red-600'),
    
    # text-blue-300 → text-blue-700 (info badges)
    (re.compile(r'text-blue-300'), 'text-blue-700'),
    (re.compile(r'border-blue-300'), 'border-blue-700'),
    (re.compile(r'bg-blue-300/'), 'bg-blue-700/'),
    (re.compile(r'bg-blue-300\b'), 'bg-blue-700'),
    
    # text-purple-300 → text-purple-700
    (re.compile(r'text-purple-300'), 'text-purple-700'),
    (re.compile(r'border-purple-300'), 'border-purple-700'),
    
    # text-zinc-300 → text-zinc-600 (muted/neutral badges)
    (re.compile(r'text-zinc-300'), 'text-zinc-600'),
    (re.compile(r'border-zinc-300'), 'border-zinc-600'),
    
    # text-slate-300 → text-slate-600 (if any)
    (re.compile(r'text-slate-300'), 'text-slate-600'),
    
    # text-cyan-300 → text-cyan-700
    (re.compile(r'text-cyan-300'), 'text-cyan-700'),
    
    # text-violet-300 → text-violet-700
    (re.compile(r'text-violet-300'), 'text-violet-700'),
    
    # text-rose-300 → text-rose-600
    (re.compile(r'text-rose-300'), 'text-rose-600'),
    
    # text-pink-300 → text-pink-700
    (re.compile(r'text-pink-300'), 'text-pink-700'),
    
    # text-orange-300 → text-orange-700
    (re.compile(r'text-orange-300'), 'text-orange-700'),
    
    # text-teal-300 → text-teal-700
    (re.compile(r'text-teal-300'), 'text-teal-700'),
    
    # text-indigo-300 → text-indigo-700
    (re.compile(r'text-indigo-300'), 'text-indigo-700'),
    
    # text-lime-300 → text-lime-700
    (re.compile(r'text-lime-300'), 'text-lime-700'),
    
    # text-sky-300 → text-sky-700
    (re.compile(r'text-sky-300'), 'text-sky-700'),
]

# ══════════════════════════════════════════════════════════════════
# PHASE 2: Dark tooltip/popover backgrounds (inline styles)
# ══════════════════════════════════════════════════════════════════
TOOLTIP_FIXES = [
    # Various dark rgba backgrounds used for tooltips/popovers/menus
    (re.compile(r"background:\s*'rgba\(10,\s*12,\s*20,\s*0\.9[0-5]\)'"), "background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'"),
    (re.compile(r"background:\s*'rgba\(12,\s*18,\s*30,\s*0\.9[0-5]\)'"), "background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'"),
    (re.compile(r"background:\s*'rgba\(15,\s*17,\s*25,\s*0\.9[0-5]\)'"), "background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'"),
    (re.compile(r"background:\s*'rgba\(15,\s*23,\s*42,\s*0\.9[0-5]\)'"), "background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'"),
    (re.compile(r"background:\s*'rgba\(10,\s*12,\s*20,\s*0\.8[0-9]\)'"), "background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'"),
    # className dark bg patterns
    (re.compile(r'bg-\[#12141E\]'), 'bg-white border border-gray-200 shadow-lg'),
    (re.compile(r'bg-\[#1a1c2e\]'), 'bg-white border border-gray-200 shadow-lg'),
    (re.compile(r'bg-\[#0d1117\]'), 'bg-white'),
    (re.compile(r'bg-\[#0a0f1a\]'), 'bg-white'),
    (re.compile(r'bg-\[#0A0C14\]'), 'bg-white'),
    (re.compile(r'bg-\[#0a0c14\]'), 'bg-white'),
    # Dashboard chart tooltip specific
    (re.compile(r"background:\s*'rgba\(12,\s*18,\s*30,\s*0\.95\)'\s*,\s*borderColor:\s*'[#a-zA-Z0-9]+'"), 
     "background: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'"),
]

# ══════════════════════════════════════════════════════════════════
# PHASE 3: Invisible text from dark-mode hex colors
# ══════════════════════════════════════════════════════════════════
HEX_TEXT_FIXES = [
    # '#e2e8f0' (slate-200) → '#374151' (gray-700) — primary text on white
    (re.compile(r"color:\s*'#e2e8f0'"), "color: '#374151'"),
    # '#cbd5e1' (slate-300) → '#6B7280' (gray-500) — secondary text on white
    (re.compile(r"color:\s*'#cbd5e1'"), "color: '#6B7280'"),
    # '#94a3b8' (slate-400) → '#6B7280' (gray-500)
    (re.compile(r"color:\s*'#94a3b8'"), "color: '#6B7280'"),
    # '#64748b' (slate-500) → '#4B5563' (gray-600)
    (re.compile(r"color:\s*'#64748b'(?!\s*,)"), "color: '#4B5563'"),
    # borderColor '#e2e8f0' → '#E5E7EB' (fine, but let's be consistent)
    (re.compile(r"borderColor:\s*'#e2e8f0'"), "borderColor: '#E5E7EB'"),
]

# ══════════════════════════════════════════════════════════════════
# PHASE 4: Dark hover states referencing -300 variants
# ══════════════════════════════════════════════════════════════════
HOVER_FIXES = [
    (re.compile(r'hover:text-emerald-300'), 'hover:text-emerald-700'),
    (re.compile(r'hover:text-amber-300'), 'hover:text-amber-700'),
    (re.compile(r'hover:text-red-300'), 'hover:text-red-600'),
    (re.compile(r'hover:text-blue-300'), 'hover:text-blue-700'),
    (re.compile(r'hover:text-purple-300'), 'hover:text-purple-700'),
    (re.compile(r'hover:text-zinc-300'), 'hover:text-zinc-600'),
    (re.compile(r'hover:text-slate-300'), 'hover:text-slate-600'),
    (re.compile(r'hover:text-cyan-300'), 'hover:text-cyan-700'),
    (re.compile(r'hover:text-violet-300'), 'hover:text-violet-700'),
    (re.compile(r'hover:text-rose-300'), 'hover:text-rose-600'),
    (re.compile(r'hover:text-orange-300'), 'hover:text-orange-700'),
    (re.compile(r'hover:text-teal-300'), 'hover:text-teal-700'),
    (re.compile(r'hover:text-indigo-300'), 'hover:text-indigo-700'),
    (re.compile(r'hover:text-pink-300'), 'hover:text-pink-700'),
    (re.compile(r'hover:text-sky-300'), 'hover:text-sky-700'),
    (re.compile(r'hover:text-lime-300'), 'hover:text-lime-700'),
]

# ══════════════════════════════════════════════════════════════════
# PHASE 5: Dark inline color references in style props
# ══════════════════════════════════════════════════════════════════
DARK_INLINE_COLOR_FIXES = [
    # stroke: '#0A0C14' → stroke: '#FFFFFF' (chart dots meant for dark bg)
    (re.compile(r"stroke:\s*'#0A0C14'"), "stroke: '#FFFFFF'"),
    (re.compile(r"stroke:\s*'#0a0c14'"), "stroke: '#FFFFFF'"),
    # Chart stop colors
    (re.compile(r"stopColor=\"rgba\(255,255,255,0\.\d+\)\""), 'stopColor="rgba(0,0,0,0.06)"'),
    # Dark chart grid lines
    (re.compile(r"stroke=\"#1a1c2e\""), 'stroke="#E5E7EB"'),
    (re.compile(r"stroke=\"#1A1C2E\""), 'stroke="#E5E7EB"'),
]

# ══════════════════════════════════════════════════════════════════
# ALL REPLACEMENTS COMBINED
# ══════════════════════════════════════════════════════════════════
ALL_REPLACEMENTS = BADGE_FIXES + TOOLTIP_FIXES + HEX_TEXT_FIXES + HOVER_FIXES + DARK_INLINE_COLOR_FIXES

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    for pattern, replacement in ALL_REPLACEMENTS:
        content = pattern.sub(replacement, content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        changes = sum(1 for a, b in zip(original.split('\n'), content.split('\n')) if a != b)
        return changes
    return 0

def main():
    total_changes = 0
    files_changed = 0
    
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
                fname = os.path.basename(filepath)
                print(f"  ✅ {fname}: {changes} lines")
    
    print(f"\n{'='*60}")
    print(f"Total: {files_changed} files, {total_changes} lines")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()