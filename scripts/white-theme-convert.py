#!/usr/bin/env python3
"""
Bulk white theme conversion script for DeepMindQ CRM.
Converts dark-theme patterns to light-theme equivalents across all .tsx files.
"""

import os
import re
import glob

SRC_DIR = '/home/z/my-project/src'

def convert_file(filepath: str):
    """Convert a single file from dark to light theme patterns."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # ═══════════════════════════════════════════════════
    # 1. bg-white/N opacity classes → bg-black/N
    # These were used as subtle overlays on dark backgrounds
    # On white backgrounds, we need black overlays instead
    # ═══════════════════════════════════════════════════
    
    # bg-white/[0.03] → bg-black/[0.03]
    content = re.sub(r'bg-white/\[0\.03\]', 'bg-black/[0.03]', content)
    # bg-white/[0.04] → bg-black/[0.04] 
    content = re.sub(r'bg-white/\[0\.04\]', 'bg-black/[0.04]', content)
    # bg-white/[0.05] → bg-black/[0.05]
    content = re.sub(r'bg-white/\[0\.05\]', 'bg-black/[0.05]', content)
    # bg-white/[0.06] → bg-black/[0.06]
    content = re.sub(r'bg-white/\[0\.06\]', 'bg-black/[0.06]', content)
    # bg-white/[0.08] → bg-black/[0.05]
    content = re.sub(r'bg-white/\[0\.08\]', 'bg-black/[0.05]', content)
    # bg-white/3 → bg-black/3
    content = re.sub(r'bg-white/3\b', 'bg-black/3', content)
    # bg-white/4 → bg-black/4
    content = re.sub(r'bg-white/4\b', 'bg-black/4', content)
    # bg-white/5 → bg-black/5
    content = re.sub(r'bg-white/5\b', 'bg-black/5', content)
    # bg-white/6 → bg-black/5
    content = re.sub(r'bg-white/6\b', 'bg-black/5', content)
    # bg-white/8 → bg-black/5
    content = re.sub(r'bg-white/8\b', 'bg-black/5', content)
    # bg-white/10 → bg-black/[0.04]
    content = re.sub(r'bg-white/10\b', 'bg-black/[0.04]', content)
    # bg-white/20 → bg-gray-100
    content = re.sub(r'bg-white/20\b', 'bg-gray-100', content)
    # bg-white/30 → bg-gray-100
    content = re.sub(r'bg-white/30\b', 'bg-gray-100', content)
    # bg-white/40 → bg-gray-200
    content = re.sub(r'bg-white/40\b', 'bg-gray-200', content)
    # bg-white/50 → bg-gray-200
    content = re.sub(r'bg-white/50\b', 'bg-gray-200', content)
    # bg-white/60 → bg-gray-200
    content = re.sub(r'bg-white/60\b', 'bg-gray-200', content)
    # bg-white/70 → bg-gray-200
    content = re.sub(r'bg-white/70\b', 'bg-gray-200', content)
    # bg-white/80 → bg-white/90
    content = re.sub(r'bg-white/80\b', 'bg-white/90', content)
    # bg-white/90 → bg-white/95
    content = re.sub(r'bg-white/90\b', 'bg-white/95', content)
    
    # border-white/N → border-black/N or border-gray-N
    content = re.sub(r'border-white/\[0\.04\]', 'border-gray-200', content)
    content = re.sub(r'border-white/\[0\.06\]', 'border-gray-200', content)
    content = re.sub(r'border-white/\[0\.08\]', 'border-gray-200', content)
    content = re.sub(r'border-white/5\b', 'border-gray-200', content)
    content = re.sub(r'border-white/10\b', 'border-gray-200', content)
    content = re.sub(r'border-white/20\b', 'border-gray-300', content)
    
    # hover:bg-white/N → hover:bg-gray-N or hover:bg-black/N
    content = re.sub(r'hover:bg-white/\[0\.03\]', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/\[0\.04\]', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/\[0\.05\]', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/\[0\.06\]', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/3\b', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/4\b', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/5\b', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/6\b', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/8\b', 'hover:bg-gray-50', content)
    content = re.sub(r'hover:bg-white/10\b', 'hover:bg-gray-100', content)
    content = re.sub(r'hover:bg-white/20\b', 'hover:bg-gray-100', content)
    
    # ═══════════════════════════════════════════════════
    # 2. rgba(255,255,255, X) → rgba(0,0,0, X) in inline styles
    # ═══════════════════════════════════════════════════
    
    # rgba(255, 255, 255, X) patterns (with spaces)
    # Very subtle: 0.02-0.06 → same opacity black
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.02\s*\)', 'rgba(0, 0, 0, 0.02)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.03\s*\)', 'rgba(0, 0, 0, 0.03)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.04\s*\)', 'rgba(0, 0, 0, 0.04)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.05\s*\)', 'rgba(0, 0, 0, 0.04)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.06\s*\)', 'rgba(0, 0, 0, 0.05)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.08\s*\)', 'rgba(0, 0, 0, 0.06)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.1\s*\)', 'rgba(0, 0, 0, 0.06)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.12\s*\)', 'rgba(0, 0, 0, 0.06)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.15\s*\)', 'rgba(0, 0, 0, 0.06)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.2\s*\)', 'rgba(0, 0, 0, 0.08)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.3\s*\)', 'rgba(0, 0, 0, 0.1)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.4\s*\)', 'rgba(0, 0, 0, 0.1)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.5\s*\)', 'rgba(0, 0, 0, 0.12)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.6\s*\)', 'rgba(0, 0, 0, 0.15)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.7\s*\)', 'rgba(0, 0, 0, 0.2)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.8\s*\)', 'rgba(0, 0, 0, 0.25)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.85\s*\)', 'rgba(0, 0, 0, 0.3)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.9\s*\)', 'rgba(0, 0, 0, 0.35)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.95\s*\)', 'rgba(0, 0, 0, 0.4)', content)
    content = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*1\s*\)', 'rgba(0, 0, 0, 0.5)', content)
    
    # rgba(255,255,255, X) patterns (no spaces)
    content = re.sub(r'rgba\(255,255,255,\s*0\.02\)', 'rgba(0,0,0,0.02)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.03\)', 'rgba(0,0,0,0.03)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.04\)', 'rgba(0,0,0,0.04)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.05\)', 'rgba(0,0,0,0.04)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.06\)', 'rgba(0,0,0,0.05)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.08\)', 'rgba(0,0,0,0.06)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.1\)', 'rgba(0,0,0,0.06)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.12\)', 'rgba(0,0,0,0.06)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.15\)', 'rgba(0,0,0,0.06)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.2\)', 'rgba(0,0,0,0.08)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.3\)', 'rgba(0,0,0,0.1)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.4\)', 'rgba(0,0,0,0.1)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.5\)', 'rgba(0,0,0,0.12)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.6\)', 'rgba(0,0,0,0.15)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.7\)', 'rgba(0,0,0,0.2)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.8\)', 'rgba(0,0,0,0.25)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.85\)', 'rgba(0,0,0,0.3)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.9\)', 'rgba(0,0,0,0.35)', content)
    content = re.sub(r'rgba\(255,255,255,\s*0\.95\)', 'rgba(0,0,0,0.4)', content)
    content = re.sub(r'rgba\(255,255,255,\s*1\)', 'rgba(0,0,0,0.5)', content)
    
    # ═══════════════════════════════════════════════════
    # 3. Dark backgrounds → light backgrounds
    # ═══════════════════════════════════════════════════
    
    # Hardcoded dark backgrounds
    content = re.sub(r"'rgba\(\s*8\s*,\s*10\s*,\s*18\s*,\s*0\.92\)'", "'rgba(255, 255, 255, 0.92)'", content)
    content = re.sub(r"'rgba\(\s*8\s*,\s*10\s*,\s*18\s*,\s*0\.88\)'", "'rgba(255, 255, 255, 0.95)'", content)
    content = re.sub(r"'rgba\(\s*8\s*,\s*10\s*,\s*18\s*,\s*0\.75\)'", "'rgba(255, 255, 255, 0.85)'", content)
    content = re.sub(r"'rgba\(\s*10\s*,\s*14\s*,\s*24\s*,\s*0\.95\)'", "'rgba(255, 255, 255, 0.97)'", content)
    content = re.sub(r"'rgba\(\s*10\s*,\s*14\s*,\s*24\s*,\s*0\.9\)'", "'rgba(255, 255, 255, 0.95)'", content)
    content = re.sub(r"'rgba\(\s*10\s*,\s*14\s*,\s*24\s*,\s*0\.85\)'", "'rgba(255, 255, 255, 0.92)'", content)
    content = re.sub(r"'rgba\(\s*10\s*,\s*14\s*,\s*24\s*,\s*0\.8\)'", "'rgba(255, 255, 255, 0.9)'", content)
    content = re.sub(r"'rgba\(\s*12\s*,\s*18\s*,\s*30\s*,\s*0\.7\)'", "'rgba(255, 255, 255, 0.85)'", content)
    content = re.sub(r"'rgba\(\s*12\s*,\s*18\s*,\s*30\s*,\s*0\.6\)'", "'rgba(255, 255, 255, 0.8)'", content)
    content = re.sub(r"'rgba\(\s*12\s*,\s*18\s*,\s*30\s*,\s*0\.9\)'", "'rgba(255, 255, 255, 0.95)'", content)
    content = re.sub(r"'rgba\(\s*15\s*,\s*20\s*,\s*35\s*,\s*0\.8\)'", "'rgba(255, 255, 255, 0.9)'", content)
    content = re.sub(r"'rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*0\.6\)'", "'rgba(255, 255, 255, 0.85)'", content)
    content = re.sub(r'rgba\(\s*8\s*,\s*10\s*,\s*18\s*,\s*0\.92\)', 'rgba(255, 255, 255, 0.92)', content)
    content = re.sub(r'rgba\(\s*10\s*,\s*14\s*,\s*24\s*,\s*0\.95\)', 'rgba(255, 255, 255, 0.97)', content)
    content = re.sub(r'rgba\(\s*10\s*,\s*14\s*,\s*24\s*,\s*0\.9\)', 'rgba(255, 255, 255, 0.95)', content)
    content = re.sub(r'rgba\(\s*12\s*,\s*18\s*,\s*30\s*,\s*0\.7\)', 'rgba(255, 255, 255, 0.85)', content)
    content = re.sub(r'rgba\(\s*12\s*,\s*18\s*,\s*30\s*,\s*0\.6\)', 'rgba(255, 255, 255, 0.8)', content)
    
    # Hex dark backgrounds
    content = re.sub(r"'#06090F'", "'#FAFAFA'", content)
    content = re.sub(r"'#080C14'", "'#F3F4F6'", content)
    content = re.sub(r"'#0A0E17'", "'#FFFFFF'", content)
    content = re.sub(r"'#0D1117'", "'#FFFFFF'", content)
    content = re.sub(r'#06090F', '#FAFAFA', content)
    content = re.sub(r'#080C14', '#F3F4F6', content)
    content = re.sub(r'#0A0E17', '#FFFFFF', content)
    content = re.sub(r'#0D1117', '#FFFFFF', content)
    
    # ═══════════════════════════════════════════════════
    # 4. Dark border colors → light border colors
    # ═══════════════════════════════════════════════════
    content = re.sub(r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.06\s*\)", 'rgba(0, 0, 0, 0.06)', content)
    content = re.sub(r"rgba\(255,255,255,\s*0\.06\)", 'rgba(0,0,0,0.06)', content)
    content = re.sub(r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.08\s*\)", 'rgba(0, 0, 0, 0.06)', content)
    content = re.sub(r"rgba\(255,255,255,\s*0\.08\)", 'rgba(0,0,0,0.06)', content)
    content = re.sub(r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.1\s*\)", 'rgba(0, 0, 0, 0.08)', content)
    content = re.sub(r"rgba\(255,255,255,\s*0\.1\)", 'rgba(0,0,0,0.08)', content)
    
    # ═══════════════════════════════════════════════════
    # 5. bg-black/60 overlay → lighter for white theme
    # ═══════════════════════════════════════════════════
    content = re.sub(r'bg-black/60\b', 'bg-black/20', content)
    content = re.sub(r'bg-black/70\b', 'bg-black/25', content)
    content = re.sub(r'bg-black/80\b', 'bg-black/30', content)
    
    # ═══════════════════════════════════════════════════
    # 6. Text color inversions for dormant screens
    #    In dark mode: text-gray-400 for subtle = light gray
    #    In light mode: text-gray-400 for subtle = need darker
    # ═══════════════════════════════════════════════════
    
    # These are contextual — only change when used as secondary/subtle text on dark cards
    # text-gray-400 (light gray, was subtle on dark) → text-gray-500 (for subtle on light)
    # We'll be conservative and only do the most obvious inversions
    
    # bg-gray-900 (near-black bg) → bg-white or bg-gray-50
    content = re.sub(r'\bbg-gray-900\b', 'bg-white', content)
    content = re.sub(r'\bbg-gray-900/', 'bg-gray-50/', content)
    content = re.sub(r'\bhover:bg-gray-900\b', 'hover:bg-gray-100', content)
    
    # bg-gray-800 (very dark bg) → bg-gray-50
    content = re.sub(r'\bbg-gray-800\b', 'bg-gray-50', content)
    content = re.sub(r'\bbg-gray-800/', 'bg-gray-100/', content)
    content = re.sub(r'\bhover:bg-gray-800\b', 'hover:bg-gray-100', content)
    
    # bg-gray-700 (dark bg) → bg-gray-100
    content = re.sub(r'\bbg-gray-700\b(?![/])', 'bg-gray-100', content)
    content = re.sub(r'\bbg-gray-700/', 'bg-gray-200/', content)
    
    # border-gray-800 → border-gray-200
    content = re.sub(r'\bborder-gray-800\b', 'border-gray-200', content)
    # border-gray-700 → border-gray-200
    content = re.sub(r'\bborder-gray-700\b', 'border-gray-200', content)
    # border-gray-600 → border-gray-300
    content = re.sub(r'\bborder-gray-600\b', 'border-gray-300', content)
    
    # hover:border-gray-700 → hover:border-gray-300
    content = re.sub(r'\bhover:border-gray-700\b', 'hover:border-gray-300', content)
    # hover:border-gray-600 → hover:border-gray-400
    content = re.sub(r'\bhover:border-gray-600\b', 'hover:border-gray-400', content)
    
    # ═══════════════════════════════════════════════════
    # 7. Color-specific: emerald/red/blue text on dark → adjust for white
    # ═══════════════════════════════════════════════════
    
    # text-emerald-400 (bright green on dark) → text-emerald-600 (readable on white)
    content = re.sub(r'\btext-emerald-400\b', 'text-emerald-600', content)
    # text-red-400 → text-red-600
    content = re.sub(r'\btext-red-400\b', 'text-red-600', content)
    # text-blue-400 → text-blue-600
    content = re.sub(r'\btext-blue-400\b', 'text-blue-600', content)
    # text-yellow-400 → text-yellow-600
    content = re.sub(r'\btext-yellow-400\b', 'text-yellow-600', content)
    # text-purple-400 → text-purple-600
    content = re.sub(r'\btext-purple-400\b', 'text-purple-600', content)
    # text-orange-400 → text-orange-600
    content = re.sub(r'\btext-orange-400\b', 'text-orange-600', content)
    # text-cyan-400 → text-cyan-600
    content = re.sub(r'\btext-cyan-400\b', 'text-cyan-600', content)
    # text-pink-400 → text-pink-600
    content = re.sub(r'\btext-pink-400\b', 'text-pink-600', content)
    # text-indigo-400 → text-indigo-600
    content = re.sub(r'\btext-indigo-400\b', 'text-indigo-600', content)
    # text-violet-400 → text-violet-600
    content = re.sub(r'\btext-violet-400\b', 'text-violet-600', content)
    # text-teal-400 → text-teal-600
    content = re.sub(r'\btext-teal-400\b', 'text-teal-600', content)
    # text-amber-400 → text-amber-600
    content = re.sub(r'\btext-amber-400\b', 'text-amber-600', content)
    # text-lime-400 → text-lime-600
    content = re.sub(r'\btext-lime-400\b', 'text-lime-600', content)
    
    # bg-emerald-400 → bg-emerald-500
    content = re.sub(r'\bbg-emerald-400\b', 'bg-emerald-500', content)
    # bg-red-400 → bg-red-500
    content = re.sub(r'\bbg-red-400\b', 'bg-red-500', content)
    # bg-blue-400 → bg-blue-500
    content = re.sub(r'\bbg-blue-400\b', 'bg-blue-500', content)
    
    # emerald-500/10 → emerald-50
    content = re.sub(r'\bbg-emerald-500/10\b', 'bg-emerald-50', content)
    content = re.sub(r'\bbg-red-500/10\b', 'bg-red-50', content)
    content = re.sub(r'\bbg-blue-500/10\b', 'bg-blue-50', content)
    content = re.sub(r'\bbg-amber-500/10\b', 'bg-amber-50', content)
    content = re.sub(r'\bbg-purple-500/10\b', 'bg-purple-50', content)
    
    # ═══════════════════════════════════════════════════
    # 8. ring-white → ring-gray-200
    # ═══════════════════════════════════════════════════
    content = re.sub(r'\bring-white\b', 'ring-white', content)  # ring-white is fine on light bg
    
    # ═══════════════════════════════════════════════════
    # 9. Special: color-scheme dark → light
    # ═══════════════════════════════════════════════════
    content = re.sub(r"color-scheme:\s*dark", "color-scheme: light", content)
    
    # ═══════════════════════════════════════════════════
    # 10. Dark specific hover: hover:bg-gray-50 on dark meant lighter → on light means slightly darker
    # ═══════════════════════════════════════════════════
    # Actually bg-gray-50 hover is fine on white bg, leave it
    
    # Write back only if changed
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    # Find all .tsx files in src/
    all_files = glob.glob(os.path.join(SRC_DIR, '**/*.tsx'), recursive=True)
    
    changed = 0
    unchanged = 0
    errors = 0
    
    for filepath in sorted(all_files):
        # Skip files we already manually converted
        if filepath in [
            f'{SRC_DIR}/app/page.tsx',
            f'{SRC_DIR}/app/layout.tsx',
            f'{SRC_DIR}/app/globals.css',  # not tsx but just in case
            f'{SRC_DIR}/components/shared/ai-chat-sidebar.tsx',
            f'{SRC_DIR}/components/error-boundary.tsx',
            f'{SRC_DIR}/components/ui/animated-components.tsx',
        ]:
            continue
        
        try:
            if convert_file(filepath):
                changed += 1
                rel = os.path.relpath(filepath, SRC_DIR)
                print(f'  ✓ {rel}')
            else:
                unchanged += 1
        except Exception as e:
            errors += 1
            print(f'  ✗ {os.path.relpath(filepath, SRC_DIR)}: {e}')
    
    print(f'\nDone: {changed} changed, {unchanged} unchanged, {errors} errors')


if __name__ == '__main__':
    main()