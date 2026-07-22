"""Replace hardcoded gold colors with CSS variable equivalents in style attributes."""
import re
import os

# Map of hardcoded gold hex to their CSS variable / Tailwind class equivalents
# These are used in style={{}} attributes, so we map to CSS variable references
GOLD_MAP = {
    '#D4AF37': 'var(--color-gold)',
    '#d4af37': 'var(--color-gold)',
    '#B8860B': 'var(--color-gold-dim)',
    '#b8860b': 'var(--color-gold-dim)',
    '#D4A843': 'var(--color-gold)',
    '#d4a843': 'var(--color-gold)',
    '#c9a84c': 'var(--color-gold)',
    '#C9A84C': 'var(--color-gold)',
    '#8B6914': 'var(--color-gold-dim)',
    '#8b6914': 'var(--color-gold-dim)',
}

src_dir = '/home/z/my-project/src'
files_changed = 0
total_replacements = 0

for root, dirs, files in os.walk(src_dir):
    # Skip node_modules, .next, etc.
    dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
    for fname in files:
        if not fname.endswith(('.tsx', '.ts', '.jsx', '.js', '.css')):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        new_content = content
        for old_hex, new_var in GOLD_MAP.items():
            # Only replace in style={{}} contexts (hex values in JS/TSX style objects)
            # Match patterns like: color: '#D4AF37' or backgroundColor: "#B8860B"
            new_content = new_content.replace("'" + old_hex + "'", "'" + new_var + "'")
            new_content = new_content.replace('"' + old_hex + '"', '"' + new_var + '"')
            # Also handle in gradient strings, etc.
        
        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count = sum(content.count(old_hex) for old_hex in GOLD_MAP)
            files_changed += 1
            total_replacements += count
            rel = os.path.relpath(fpath, src_dir)
            print(f"  {rel}: {count} replacements")

print(f"\nTotal: {files_changed} files, {total_replacements} replacements")
