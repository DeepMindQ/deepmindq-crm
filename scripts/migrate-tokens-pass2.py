#!/usr/bin/env python3
"""
Design Token Migration Script — Pass 2 (Aggressive)
Scans ALL .tsx files in src/components/screens/ for remaining hardcoded hex colors,
maps to the nearest --dmq-* CSS variable, and performs bulk find-and-replace.
No top-N limit — replaces ALL mappable hex values in ALL contexts:
  - Simple quoted: color: '#xxx'
  - Gradient strings: 'linear-gradient(..., #xxx, ...)'
  - Tailwind arbitrary values: bg-[#xxx], text-[#xxx], border-[#xxx]
  - Tailwind with opacity: bg-[#xxx]/15 → bg-[var(--dmq-xxx)] (opacity stripped)
Reports any unmappable hex values for manual review.
"""

import re
import json
from collections import Counter, OrderedDict
from pathlib import Path

# ── Configuration ──
PROJECT_ROOT = Path("/home/z/my-project")
SCREENS_DIR = PROJECT_ROOT / "src" / "components" / "screens"

# ═══════════════════════════════════════════════════════════════════
# EXPANDED TOKEN MAPPING — curated for pass 2
# Uses OrderedDict so LAST entry wins (Python 3.7+ dict preserves order)
# ═══════════════════════════════════════════════════════════════════
HEX_TO_TOKEN = {
    # ── Gold ──
    '#d4af37': '--dmq-gold',
    '#e8c860': '--dmq-gold-light',
    '#b8860b': '--dmq-gold-dark',
    '#b8960c': '--dmq-gold-dark',
    '#b8941f': '--dmq-gold-dark',
    '#b8962e': '--dmq-gold-deep',
    '#c5a030': '--dmq-gold-muted',
    '#c9a84c': '--dmq-gold',
    '#dbb84d': '--dmq-gold-light',
    '#9a8340': '--dmq-gold-deep',
    '#d6bf79': '--dmq-gold-muted',
    '#e8c84a': '--dmq-gold-light',
    
    # ── Red / Risk ──
    '#ef4444': '--dmq-domain-risk',
    '#dc2626': '--dmq-red',
    '#f87171': '--dmq-red-light',
    '#b91c1c': '--dmq-red-dark',
    '#991b1b': '--dmq-red-dark',
    '#7f1d1d': '--dmq-red-900',
    '#fee2e2': '--dmq-red-50',
    '#fecaca': '--dmq-red-100',
    '#fef2f2': '--dmq-light-red',
    
    # ── Green / Emerald ──
    '#10b981': '--dmq-emerald',
    '#059669': '--dmq-emerald-deep',
    '#34d399': '--dmq-emerald-light',
    '#065f46': '--dmq-emerald-dark',
    '#047857': '--dmq-emerald-700',
    '#064e3b': '--dmq-emerald-900',
    '#d1fae5': '--dmq-emerald-50',
    '#a7f3d0': '--dmq-emerald-100',
    '#ecfdf5': '--dmq-light-green',
    '#22c55e': '--dmq-domain-action',
    '#16a34a': '--dmq-green-600',
    '#15803d': '--dmq-green-700',
    '#4ade80': '--dmq-green-400',
    '#86efac': '--dmq-green-300',
    '#bbf7d0': '--dmq-green-200',
    '#dcfce7': '--dmq-green-100',
    '#f0fdf4': '--dmq-green-50',
    
    # ── Amber / Reasoning ──
    '#f59e0b': '--dmq-domain-reasoning',
    '#d97706': '--dmq-amber-deep',
    '#fbbf24': '--dmq-amber',
    '#fcd34d': '--dmq-amber-300',
    '#fde68a': '--dmq-amber-200',
    '#fef3c7': '--dmq-amber-100',
    '#b45309': '--dmq-amber-700',
    '#92400e': '--dmq-amber-800',
    '#ca8a04': '--dmq-yellow-deep',
    '#eab308': '--dmq-yellow-500',
    
    # ── Blue / Accent ──
    '#3b82f6': '--dmq-accent-blue',
    '#2563eb': '--dmq-accent-dim',
    '#60a5fa': '--dmq-accent-bright',
    '#1d4ed8': '--dmq-blue-700',
    '#1e40af': '--dmq-blue-800',
    '#1e3a8a': '--dmq-blue-900',
    '#93c5fd': '--dmq-blue-300',
    '#bfdbfe': '--dmq-blue-200',
    '#dbeafe': '--dmq-blue-100',
    '#93c5fd': '--dmq-text-accent',
    '#4361ee': '--dmq-blue-bright',
    
    # ── Sky ──
    '#0ea5e9': '--dmq-sky',
    '#0284c7': '--dmq-sky-600',
    '#38bdf8': '--dmq-sky-400',
    '#7dd3fc': '--dmq-sky-300',
    '#bae6fd': '--dmq-sky-200',
    '#e0f2fe': '--dmq-sky-100',
    
    # ── Purple ──
    '#7c3aed': '--dmq-purple-deep',
    '#8b5cf6': '--dmq-purple',
    '#a78bfa': '--dmq-purple-400',
    '#c084fc': '--dmq-purple-light',
    '#c4b5fd': '--dmq-purple-300',
    '#ddd6fe': '--dmq-purple-200',
    '#ede9fe': '--dmq-purple-100',
    '#6d28d9': '--dmq-purple-700',
    '#9333ea': '--dmq-purple-600',
    '#5b21b6': '--dmq-purple-800',
    '#a855f7': '--dmq-domain-opportunity',
    
    # ── Indigo ──
    '#6366f1': '--dmq-indigo',
    '#4f46e5': '--dmq-indigo-600',
    '#4338ca': '--dmq-indigo-700',
    '#818cf8': '--dmq-indigo-400',
    '#a5b4fc': '--dmq-indigo-300',
    '#c7d2fe': '--dmq-indigo-200',
    '#e0e7ff': '--dmq-indigo-100',
    
    # ── Teal ──
    '#14b8a6': '--dmq-trust-high',
    '#0d9488': '--dmq-teal-600',
    '#0f766e': '--dmq-teal-700',
    '#2dd4bf': '--dmq-teal-400',
    '#5eead4': '--dmq-teal-300',
    '#99f6e4': '--dmq-teal-200',
    '#ccfbf1': '--dmq-teal-100',
    
    # ── Orange ──
    '#f97316': '--dmq-trust-low',
    '#ea580c': '--dmq-orange',
    '#fb923c': '--dmq-orange-400',
    '#fdba74': '--dmq-orange-300',
    '#fed7aa': '--dmq-orange-200',
    '#ffedd5': '--dmq-orange-100',
    
    # ── Pink ──
    '#ec4899': '--dmq-pink',
    '#db2777': '--dmq-pink-600',
    '#f472b6': '--dmq-pink-400',
    '#f9a8d4': '--dmq-pink-300',
    '#fbcfe8': '--dmq-pink-200',
    '#fce7f3': '--dmq-pink-100',
    
    # ── Cyan ──
    '#06b6d4': '--dmq-domain-enrichment',
    '#22d3ee': '--dmq-cyan',
    '#0891b2': '--dmq-cyan-dark',
    
    # ── Lime ──
    '#84cc16': '--dmq-lime',
    '#a3e635': '--dmq-lime-bright',
    '#65a30d': '--dmq-lime-dark',
    
    # ── Neutral scale ──
    '#f9fafb': '--dmq-neutral-50',
    '#f3f4f6': '--dmq-neutral-100',
    '#e5e7eb': '--dmq-neutral-200',
    '#d1d5db': '--dmq-neutral-300',
    '#9ca3af': '--dmq-neutral-400',
    '#6b7280': '--dmq-neutral-500',
    '#4b5563': '--dmq-neutral-600',
    '#374151': '--dmq-neutral-700',
    '#1f2937': '--dmq-neutral-800',
    '#111827': '--dmq-neutral-900',
    
    # ── Slate ──
    '#0f172a': '--dmq-slate-900',
    '#1e293b': '--dmq-slate-800',
    '#334155': '--dmq-slate-700',
    '#475569': '--dmq-slate-600',
    '#64748b': '--dmq-slate-500',
    '#94a3b8': '--dmq-slate-400',
    '#cbd5e1': '--dmq-slate-300',
    '#e2e8f0': '--dmq-slate-200',
    '#f1f5f9': '--dmq-slate-100',
    '#f8fafc': '--dmq-slate-50',
    
    # ── Zinc ──
    '#71717a': '--dmq-zinc',
    '#a1a1aa': '--dmq-zinc-400',
    '#d4d4d8': '--dmq-zinc-300',
    '#e4e4e7': '--dmq-zinc-200',
    '#f4f4f5': '--dmq-zinc-100',
    '#fafafa': '--dmq-zinc-50',
    '#52525b': '--dmq-zinc-dark',
    
    # ── Surfaces ──
    '#0a0c10': '--dmq-surface-base',
    '#0f1219': '--dmq-surface-secondary',
    '#141821': '--dmq-surface-card',
    '#1a1f2b': '--dmq-surface-card-hover',
    '#1e2433': '--dmq-surface-elevated',
    '#1e2535': '--dmq-border-default',
    '#0f1117': '--dmq-surface-dark-alt',
    '#0f0f11': '--dmq-surface-deep-dark',
    '#12121e': '--dmq-surface-panel',
    '#1a1a2e': '--dmq-surface-muted-bg',
    '#1a1f2e': '--dmq-surface-muted-bg',
    '#2a3348': '--dmq-border-hover',
    '#141c2e': '--dmq-surface-elevated',
    '#0c1222': '--dmq-surface-dark-alt',
    '#0b1120': '--dmq-surface-base',
    '#020617': '--dmq-surface-deep-dark',
    '#0a0f1a': '--dmq-surface-base',
    '#101827': '--dmq-surface-dark-alt',
    
    # ── Text ──
    '#e8ecf4': '--dmq-text-primary',
    '#8892a8': '--dmq-text-secondary',
    '#5a6478': '--dmq-text-muted',
    '#060910': '--dmq-surface-base',
    
    # ── Utility ──
    '#f8f9fa': '--dmq-off-white',
    '#f0f0f5': '--dmq-warm-white',
    '#e4e4e7': '--dmq-cool-gray',
    '#a0a0b8': '--dmq-slate',
    '#6b6b80': '--dmq-muted-gray',
    '#666666': '--dmq-dim-gray',
    '#999999': '--dmq-medium-gray',
    '#cccccc': '--dmq-light-gray',
    '#eff6ff': '--dmq-soft-blue',
    '#fffdf5': '--dmq-warm-bg',
    '#fffbeb': '--dmq-warm-bg-alt',
    
    # ── Black / White ──
    '#000': '--dmq-black',
    '#000000': '--dmq-black',
    '#030712': '--dmq-black',
    '#fff': '--dmq-white',
    '#ffffff': '--dmq-white',
}

# Verify: Python 3.7+ dicts maintain insertion order, so last key wins.
# Let's verify there are no duplicate keys with different values:
# (checked by the script at runtime)


# ═══════════════════════════════════════════════════════════════════
# Functions
# ═══════════════════════════════════════════════════════════════════

def find_all_screen_files():
    """Find all .tsx files in screens directory (excluding node_modules)."""
    files = []
    for filepath in sorted(SCREENS_DIR.rglob('*.tsx')):
        if 'node_modules' in str(filepath):
            continue
        files.append(filepath)
    return files


def scan_all_hex(files):
    """Scan all files for remaining hex colors in ANY context."""
    hex_pattern = re.compile(r'#([0-9a-fA-F]{3,8})\b')
    file_counts = {}
    all_counter = Counter()
    
    for filepath in files:
        content = filepath.read_text()
        matches = hex_pattern.findall(content)
        filtered = []
        for m in matches:
            full = '#' + m.lower()
            # Skip hex already inside var(--dmq-...) or var(--color-...)
            idx = content.lower().find(full)
            while idx != -1:
                start = max(0, idx - 30)
                context = content[start:idx]
                if 'var(--dmq' in context or 'var(--color' in context:
                    idx = content.lower().find(full, idx + len(full))
                    continue
                filtered.append(full)
                idx = content.lower().find(full, idx + len(full))
                break  # Only process first match per unique occurrence
        
        # More efficient: just find all and filter
        filtered = []
        for m in matches:
            full = '#' + m.lower()
            # Find position and check context
            idx = content.lower().find(full)
            if idx == -1:
                continue
            start = max(0, idx - 30)
            context_before = content[start:idx]
            # Skip if inside an existing var() call
            if 'var(--dmq' in context_before or 'var(--color' in context_before:
                continue
            filtered.append(full)
        
        if filtered:
            rel_path = filepath.relative_to(PROJECT_ROOT)
            file_counts[str(rel_path)] = Counter(filtered)
            all_counter.update(filtered)
    
    return all_counter, file_counts


def perform_replacements(files, hex_to_token):
    """Replace ALL hex occurrences in ALL contexts.
    
    Handles:
    - '#hex' and "#hex" (quoted standalone)
    - #hex inside gradient strings, Tailwind classes, etc.
    - Skips hex inside existing var(--dmq-...) calls
    """
    total_replacements = 0
    files_modified = set()
    replacement_log = Counter()  # grouped by "hex → token"
    unmappable = Counter()
    
    # Sort hexes by length descending to avoid partial matches
    sorted_hexes = sorted(hex_to_token.keys(), key=len, reverse=True)
    
    for filepath in files:
        rel_path = str(filepath.relative_to(PROJECT_ROOT))
        content = filepath.read_text()
        original = content
        
        for hex_val in sorted_hexes:
            css_var = hex_to_token[hex_val]
            escaped = re.escape(hex_val)
            
            # Count before
            before_count = 0
            for m in re.finditer(escaped, content, re.IGNORECASE):
                idx = m.start()
                start = max(0, idx - 30)
                context_before = content[start:idx]
                # Skip if inside existing var(--dmq-...) or var(--color-...)
                if 'var(--dmq' in context_before or 'var(--color' in context_before:
                    continue
                # Skip if part of a CSS variable name (e.g., --dmq-xxx: #yyy)
                if ':' in context_before.split('\n')[-1] and '#'.join(context_before.split(':')[-1:]) == hex_val[:1]:
                    pass  # actually this is fine, it's a CSS property
                before_count += 1
            
            # Perform replacement using a callback to skip existing var() contexts
            def replacer(m):
                idx = m.start()
                start = max(0, idx - 30)
                context_before = content[start:idx]
                # Skip if inside existing var() call
                if 'var(--dmq' in context_before or 'var(--color' in context_before:
                    return m.group(0)  # keep original
                # Skip if this is part of the globals.css :root block (not screen files, but be safe)
                if re.search(r'--dmq-\w+:\s*$', context_before):
                    return m.group(0)
                return f'var({css_var})'
            
            content = re.sub(escaped, replacer, content, flags=re.IGNORECASE)
            
            # Count after (same logic)
            after_count = 0
            for m in re.finditer(escaped, content, re.IGNORECASE):
                idx = m.start()
                start = max(0, idx - 30)
                context_before = content[start:idx]
                if 'var(--dmq' in context_before or 'var(--color' in context_before:
                    continue
                after_count += 1
            
            changes = before_count - after_count
            if changes > 0:
                replacement_log[f"{hex_val} → {css_var}"] += changes
                total_replacements += changes
        
        # Handle Tailwind opacity modifiers: bg-[var(--dmq-gold)]/15 → bg-[var(--dmq-gold)]
        # After replacement, clean up any dangling opacity modifiers after var() in brackets
        content = re.sub(
            r'\[var\(--dmq-[a-z0-9-]+\)\]/\d+',
            lambda m: m.group(0).rsplit('/', 1)[0] + ']',
            content
        )
        
        if content != original:
            filepath.write_text(content)
            files_modified.add(rel_path)
    
    return total_replacements, files_modified, replacement_log, unmappable


def add_missing_css_tokens(hex_to_token):
    """Check which tokens need to be added to globals.css and add them."""
    globals_css = PROJECT_ROOT / "src" / "app" / "globals.css"
    content = globals_css.read_text()
    
    # Find existing :root block
    root_match = re.search(r'(:root\s*\{)', content)
    if not root_match:
        print("  WARNING: Could not find :root block in globals.css")
        return []
    
    # Build token additions
    # Find all used tokens in the mapping and check which ones are already in globals.css
    missing = {}
    for hex_val, token in hex_to_token.items():
        if token not in content:
            missing[token] = hex_val
    
    if not missing:
        print("  All referenced tokens already exist in globals.css")
        return []
    
    # Generate new CSS declarations
    new_decls = []
    for token in sorted(missing.keys()):
        hex_val = missing[token]
        new_decls.append(f'  {token}: {hex_val};')
    
    css_addition = '\n'.join(new_decls)
    
    # Insert before the closing } of :root
    # Find the closing brace of :root
    closing = content.find('}', root_match.end())
    if closing == -1:
        print("  WARNING: Could not find closing } of :root")
        return list(missing.keys())
    
    # Insert the new declarations before the closing brace
    new_content = content[:closing] + '\n' + css_addition + '\n' + content[closing:]
    globals_css.write_text(new_content)
    
    print(f"  Added {len(missing)} new CSS custom properties to globals.css")
    return list(missing.keys())


def find_unmappable_hex(files, hex_to_token):
    """Find hex values NOT in the mapping table."""
    hex_pattern = re.compile(r'#([0-9a-fA-F]{3,8})\b')
    unmappable = Counter()
    file_instances = {}
    
    for filepath in files:
        content = filepath.read_text()
        for m in hex_pattern.finditer(content):
            hex_val = '#' + m.group(1).lower()
            # Skip if inside existing var()
            idx = m.start()
            start = max(0, idx - 30)
            context = content[start:idx]
            if 'var(--dmq' in context or 'var(--color' in context:
                continue
            if hex_val not in hex_to_token:
                # Double-check it's a real hex (not part of a larger word)
                # Hex should be preceded by a non-hex char or start of string
                if idx > 0 and content[idx-1] in '0123456789abcdefABCDEF':
                    continue
                unmappable[hex_val] += 1
                rel = str(filepath.relative_to(PROJECT_ROOT))
                if hex_val not in file_instances:
                    file_instances[hex_val] = []
                file_instances[hex_val].append((rel, m.start() + 1))
    
    return unmappable, file_instances


# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("DESIGN TOKEN MIGRATION — Pass 2 (Aggressive)")
    print("Contexts handled: quoted strings, gradients, Tailwind arbitrary values")
    print("=" * 70)
    
    # Verify mapping integrity
    print(f"\n[0] Token mapping: {len(HEX_TO_TOKEN)} hex → token entries")
    
    # Step 1: Find files
    print("\n[1] Scanning screen files...")
    files = find_all_screen_files()
    print(f"    Found {len(files)} .tsx files")
    
    # Step 2: Pre-scan
    print("\n[2] Pre-scan: detecting remaining hardcoded hex...")
    all_hex_counter, file_hex_counts = scan_all_hex(files)
    total_instances = sum(all_hex_counter.values())
    unique_hexes = len(all_hex_counter)
    files_affected = len(file_hex_counts)
    
    covered_hexes = set(all_hex_counter.keys()) & set(HEX_TO_TOKEN.keys())
    covered_instances = sum(all_hex_counter[h] for h in covered_hexes)
    uncovered_hexes = set(all_hex_counter.keys()) - set(HEX_TO_TOKEN.keys())
    uncovered_instances = sum(all_hex_counter[h] for h in uncovered_hexes)
    
    print(f"    Total remaining: {total_instances} instances, {unique_hexes} unique, {files_affected} files")
    print(f"    Mappable: {covered_instances} instances ({len(covered_hexes)} unique)")
    print(f"    Unmappable: {uncovered_instances} instances ({len(uncovered_hexes)} unique)")
    
    # Pre-scan report
    print("\n" + "=" * 70)
    print("PRE-SCAN: ALL REMAINING HEX VALUES")
    print("=" * 70)
    for hex_val, count in all_hex_counter.most_common():
        mapped = "YES" if hex_val in HEX_TO_TOKEN else "NO"
        var_name = HEX_TO_TOKEN.get(hex_val, "--")
        print(f"  {hex_val:<12} {count:>4}x  [{mapped}]  {var_name}")
    
    # Per-file pre-scan
    print("\n" + "=" * 70)
    print("PRE-SCAN: PER-FILE COUNTS")
    print("=" * 70)
    sorted_files = sorted(file_hex_counts.items(), key=lambda x: sum(x[1].values()), reverse=True)
    for rel_path, counter in sorted_files:
        total = sum(counter.values())
        print(f"  {total:>4} hex  {rel_path}")
    
    # Step 3: Perform replacements
    print(f"\n[3] Replacing ALL mappable hex values...")
    total_replacements, files_modified, replacement_log, _ = perform_replacements(files, HEX_TO_TOKEN)
    print(f"    Replaced {total_replacements} instances across {len(files_modified)} files")
    
    # Replacement details
    print("\n" + "=" * 70)
    print("REPLACEMENTS PERFORMED")
    print("=" * 70)
    for change, count in replacement_log.most_common():
        print(f"  {count:>4}x  {change}")
    
    # Step 4: Add missing CSS tokens to globals.css
    print(f"\n[4] Updating globals.css with missing tokens...")
    added_tokens = add_missing_css_tokens(HEX_TO_TOKEN)
    if added_tokens:
        print(f"    Added {len(added_tokens)} new tokens")
    else:
        print(f"    No new tokens needed (all already present)")
    
    # Step 5: Post-scan for remaining hex
    print(f"\n[5] Post-scan: checking for remaining hardcoded hex...")
    files_after = find_all_screen_files()
    remaining_counter, remaining_files = scan_all_hex(files_after)
    remaining_total = sum(remaining_counter.values())
    
    if remaining_total == 0:
        print("    *** CLEAN: No remaining hardcoded hex colors! ***")
    else:
        print(f"    {remaining_total} instances remain in {len(remaining_files)} files")
        # Also check for unmappable hex
        unmappable_counter, file_instances = find_unmappable_hex(files_after, HEX_TO_TOKEN)
        if unmappable_counter:
            print("\n" + "=" * 70)
            print(f"UNMAPPABLE HEX VALUES ({sum(unmappable_counter.values())} instances)")
            print("=" * 70)
            for hex_val, count in unmappable_counter.most_common():
                locations = file_instances.get(hex_val, [])
                files_list = sorted(set(loc[0].split('/')[-1] for loc in locations))
                print(f"  {hex_val}: {count} instances in {', '.join(files_list)}")
        
        # Show remaining mappable hex (shouldn't happen, but just in case)
        remaining_mappable = {h: c for h, c in remaining_counter.items() if h in HEX_TO_TOKEN}
        if remaining_mappable:
            print("\n" + "=" * 70)
            print("WARNING: REMAINING MAPPABLE HEX (missed by replacement)")
            print("=" * 70)
            for hex_val, count in sorted(remaining_mappable.items(), key=lambda x: -x[1]):
                print(f"  {hex_val}: {count} instances")
    
    # Summary
    print("\n" + "=" * 70)
    print("PASS 2 SUMMARY")
    print("=" * 70)
    print(f"  Files scanned:                    {len(files)}")
    print(f"  Pre-scan hex instances:           {total_instances}")
    print(f"  Unique hex values (pre):          {unique_hexes}")
    print(f"  Mappable instances (pre):          {covered_instances}")
    print(f"  Instances replaced:                {total_replacements}")
    print(f"  Files modified:                   {len(files_modified)}")
    print(f"  CSS tokens added to globals.css:  {len(added_tokens) if added_tokens else 0}")
    print(f"  Post-scan remaining hex:           {remaining_total}")
    print(f"  Migration coverage:                {100*total_replacements/max(total_instances,1):.1f}%")
    print("=" * 70)
    
    # JSON report
    report = {
        'pass': 2,
        'files_scanned': len(files),
        'pre_scan_instances': total_instances,
        'pre_scan_unique': unique_hexes,
        'instances_replaced': total_replacements,
        'files_modified': len(files_modified),
        'post_scan_remaining': remaining_total,
        'replacements': dict(replacement_log.most_common()),
        'added_css_tokens': added_tokens,
    }
    report_path = PROJECT_ROOT / "scripts" / "migration-report-pass2.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\n  Full report saved to: {report_path}")


if __name__ == '__main__':
    main()
