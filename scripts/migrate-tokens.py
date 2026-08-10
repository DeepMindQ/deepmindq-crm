#!/usr/bin/env python3
"""
Design Token Migration Script — Phase 3.1
Scans screen files for hardcoded hex colors, maps to nearest design token,
and performs bulk find-and-replace for the top 20 most common hex values.
"""

import re
import json
from collections import Counter
from pathlib import Path

# ── Configuration ──
PROJECT_ROOT = Path("/home/z/my-project")
SCREENS_DIR = PROJECT_ROOT / "src" / "components" / "screens"
TOKENS_FILE = PROJECT_ROOT / "src" / "components" / "intelligence-os" / "design-tokens.ts"
GLOBALS_CSS = PROJECT_ROOT / "src" / "app" / "globals.css"
TOP_N = 20

# ═══════════════════════════════════════════════════════════════════
# MANUAL TOKEN MAPPING — curated from design-tokens.ts
# hex_value -> css_var_name
# ═══════════════════════════════════════════════════════════════════
HEX_TOKEN_MAP = {
    # ── Surfaces ──
    '#0a0c10':  '--dmq-surface-base',
    '#0f1219':  '--dmq-surface-secondary',
    '#141821':  '--dmq-surface-card',
    '#1a1f2b':  '--dmq-surface-card-hover',
    '#1e2433':  '--dmq-surface-elevated',
    '#0f1117':  '--dmq-surface-dark-alt',
    '#0f0f11':  '--dmq-surface-deep-dark',
    '#12121e':  '--dmq-surface-panel',
    '#1a1a2e':  '--dmq-surface-muted-bg',

    # ── Borders ──
    '#1e2535':  '--dmq-border-default',
    '#2a3348':  '--dmq-border-hover',

    # ── Text ──
    '#e8ecf4':  '--dmq-text-primary',
    '#8892a8':  '--dmq-text-secondary',
    '#5a6478':  '--dmq-text-muted',
    '#93c5fd':  '--dmq-text-accent',

    # ── Accent (blue) ──
    '#3b82f6':  '--dmq-accent-blue',
    '#2563eb':  '--dmq-accent-dim',
    '#60a5fa':  '--dmq-accent-bright',

    # ── Domain colors ──
    '#a855f7':  '--dmq-domain-opportunity',
    '#06b6d4':  '--dmq-domain-enrichment',
    '#ef4444':  '--dmq-domain-risk',
    '#f59e0b':  '--dmq-domain-reasoning',
    '#22c55e':  '--dmq-domain-action',

    # ── Trust scale ──
    '#14b8a6':  '--dmq-trust-high',
    '#f97316':  '--dmq-trust-low',

    # ── Gold ──
    '#d4af37':  '--dmq-gold',
    '#e8c860':  '--dmq-gold-light',
    '#b8860b':  '--dmq-gold-dark',
    '#9a8340':  '--dmq-gold-deep',
    '#d6bf79':  '--dmq-gold-muted',

    # ── Extended domain ──
    '#10b981':  '--dmq-emerald',
    '#059669':  '--dmq-emerald-deep',
    '#8b5cf6':  '--dmq-purple',
    '#7c3aed':  '--dmq-purple-deep',
    '#6366f1':  '--dmq-indigo',
    '#0ea5e9':  '--dmq-sky',
    '#fbbf24':  '--dmq-amber',
    '#d97706':  '--dmq-amber-deep',
    '#f87171':  '--dmq-rose',
    '#dc2626':  '--dmq-red',
    '#991b1b':  '--dmq-red-dark',
    '#a78bfa':  '--dmq-violet',
    '#22d3ee':  '--dmq-cyan',
    '#0891b2':  '--dmq-cyan-dark',
    '#84cc16':  '--dmq-lime',
    '#a3e635':  '--dmq-lime-bright',
    '#65a30d':  '--dmq-lime-dark',
    '#16a34a':  '--dmq-green-deep',
    '#ea580c':  '--dmq-orange',
    '#ca8a04':  '--dmq-yellow-deep',
    '#ec4899':  '--dmq-pink',
    '#1d4ed8':  '--dmq-blue',
    '#1e40af':  '--dmq-blue-deep',
    '#4361ee':  '--dmq-blue-bright',
    '#34d399':  '--dmq-emerald-light',

    # ── Neutral scale ──
    '#f9fafb':  '--dmq-neutral-50',
    '#f3f4f6':  '--dmq-neutral-100',
    '#e5e7eb':  '--dmq-neutral-200',
    '#d1d5db':  '--dmq-neutral-300',
    '#9ca3af':  '--dmq-neutral-400',
    '#6b7280':  '--dmq-neutral-500',
    '#4b5563':  '--dmq-neutral-600',
    '#374151':  '--dmq-neutral-700',
    '#1f2937':  '--dmq-neutral-800',
    '#111827':  '--dmq-neutral-900',

    # ── Flat utility colors ──
    '#ffffff':  '--dmq-white',
    '#000000':  '--dmq-black',
    '#f8f9fa':  '--dmq-off-white',
    '#f0f0f5':  '--dmq-warm-white',
    '#e4e4e7':  '--dmq-cool-gray',
    '#a0a0b8':  '--dmq-slate',
    '#6b6b80':  '--dmq-muted-gray',
    '#666666':  '--dmq-dim-gray',
    '#999999':  '--dmq-medium-gray',
    '#cccccc':  '--dmq-light-gray',
    '#a1a1aa':  '--dmq-border-gray',
    '#71717a':  '--dmq-zinc',
    '#52525b':  '--dmq-zinc-dark',
    '#818cf8':  '--dmq-sky-blue',
    '#bfdbfe':  '--dmq-light-blue',
    '#eff6ff':  '--dmq-soft-blue',
    '#fef2f2':  '--dmq-light-red',
    '#ecfdf5':  '--dmq-light-green',
    '#fef3c7':  '--dmq-light-amber',
    '#fffdf5':  '--dmq-warm-bg',
    '#fffbeb':  '--dmq-warm-bg-alt',
    '#f8fafc':  '--dmq-cool-bg',

    # ── 3-char hex shortcuts ──
    '#fff':     '--dmq-white',
    '#000':     '--dmq-black',
}

# ═══════════════════════════════════════════════════════════════════
# CSS variable → raw value (for generating the :root block)
# ═══════════════════════════════════════════════════════════════════
CSS_VAR_VALUES = {
    # Surfaces
    '--dmq-surface-base': '#0a0c10',
    '--dmq-surface-secondary': '#0f1219',
    '--dmq-surface-card': '#141821',
    '--dmq-surface-card-hover': '#1a1f2b',
    '--dmq-surface-elevated': '#1e2433',
    '--dmq-surface-dark-alt': '#0f1117',
    '--dmq-surface-deep-dark': '#0f0f11',
    '--dmq-surface-panel': '#12121e',
    '--dmq-surface-muted-bg': '#1a1a2e',
    '--dmq-surface-overlay': 'rgba(10, 12, 16, 0.85)',

    # Borders
    '--dmq-border-default': '#1e2535',
    '--dmq-border-hover': '#2a3348',
    '--dmq-border-subtle': 'rgba(42, 51, 72, 0.4)',

    # Text
    '--dmq-text-primary': '#e8ecf4',
    '--dmq-text-secondary': '#8892a8',
    '--dmq-text-muted': '#5a6478',
    '--dmq-text-accent': '#93c5fd',

    # Accent blue
    '--dmq-accent-blue': '#3b82f6',
    '--dmq-accent-dim': '#2563eb',
    '--dmq-accent-bright': '#60a5fa',
    '--dmq-accent-subtle': 'rgba(59, 130, 246, 0.1)',
    '--dmq-accent-strong': 'rgba(59, 130, 246, 0.25)',
    '--dmq-accent-ghost': 'rgba(59, 130, 246, 0.06)',

    # Domain
    '--dmq-domain-opportunity': '#a855f7',
    '--dmq-domain-enrichment': '#06b6d4',
    '--dmq-domain-risk': '#ef4444',
    '--dmq-domain-reasoning': '#f59e0b',
    '--dmq-domain-action': '#22c55e',
    '--dmq-domain-signal': '#3b82f6',

    # Trust
    '--dmq-trust-verified': '#22c55e',
    '--dmq-trust-high': '#14b8a6',
    '--dmq-trust-medium': '#f59e0b',
    '--dmq-trust-low': '#f97316',
    '--dmq-trust-unverified': '#6b7280',
    '--dmq-trust-verified-bg': 'rgba(34, 197, 94, 0.12)',
    '--dmq-trust-verified-border': 'rgba(34, 197, 94, 0.3)',
    '--dmq-trust-high-bg': 'rgba(20, 184, 166, 0.12)',
    '--dmq-trust-high-border': 'rgba(20, 184, 166, 0.3)',
    '--dmq-trust-medium-bg': 'rgba(245, 158, 11, 0.12)',
    '--dmq-trust-medium-border': 'rgba(245, 158, 11, 0.3)',
    '--dmq-trust-low-bg': 'rgba(249, 115, 22, 0.12)',
    '--dmq-trust-low-border': 'rgba(249, 115, 22, 0.3)',
    '--dmq-trust-unverified-bg': 'rgba(107, 114, 128, 0.12)',
    '--dmq-trust-unverified-border': 'rgba(107, 114, 128, 0.3)',

    # Gold
    '--dmq-gold': '#d4af37',
    '--dmq-gold-light': '#e8c860',
    '--dmq-gold-dark': '#b8860b',
    '--dmq-gold-deep': '#9a8340',
    '--dmq-gold-muted': '#d6bf79',
    '--dmq-gold-bg': 'rgba(212, 175, 55, 0.1)',
    '--dmq-gold-bg-medium': 'rgba(212, 175, 55, 0.12)',
    '--dmq-gold-bg-subtle': 'rgba(212, 175, 55, 0.06)',
    '--dmq-gold-border': 'rgba(212, 175, 55, 0.3)',
    '--dmq-gold-border-light': 'rgba(212, 175, 55, 0.2)',
    '--dmq-gold-border-faint': 'rgba(212, 175, 55, 0.15)',
    '--dmq-gold-bg-bright': 'rgba(212, 175, 55, 0.25)',
    '--dmq-gold-bg-strong': 'rgba(212, 175, 55, 0.4)',
    '--dmq-gold-bg-dark': 'rgba(184, 134, 11, 0.12)',
    '--dmq-gold-bg-dark-light': 'rgba(184, 134, 11, 0.06)',

    # Extended domain
    '--dmq-emerald': '#10b981',
    '--dmq-emerald-deep': '#059669',
    '--dmq-emerald-light': '#34d399',
    '--dmq-emerald-bg': 'rgba(16, 185, 129, 0.1)',
    '--dmq-emerald-bg-medium': 'rgba(16, 185, 129, 0.12)',
    '--dmq-emerald-border': 'rgba(16, 185, 129, 0.2)',
    '--dmq-emerald-deep-bg': 'rgba(5, 150, 105, 0.1)',
    '--dmq-purple': '#8b5cf6',
    '--dmq-purple-deep': '#7c3aed',
    '--dmq-purple-bg': 'rgba(139, 92, 246, 0.1)',
    '--dmq-purple-bg-medium': 'rgba(139, 92, 246, 0.12)',
    '--dmq-purple-border': 'rgba(139, 92, 246, 0.2)',
    '--dmq-purple-bg-subtle': 'rgba(139, 92, 246, 0.06)',
    '--dmq-purple-bg-faint': 'rgba(139, 92, 246, 0.15)',
    '--dmq-purple-deep-bg': 'rgba(124, 58, 237, 0.1)',
    '--dmq-purple-deep-border': 'rgba(124, 58, 237, 0.2)',
    '--dmq-indigo': '#6366f1',
    '--dmq-indigo-bg': 'rgba(99, 102, 241, 0.1)',
    '--dmq-indigo-bg-subtle': 'rgba(99, 102, 241, 0.06)',
    '--dmq-sky': '#0ea5e9',
    '--dmq-sky-bg': 'rgba(14, 165, 233, 0.1)',
    '--dmq-sky-border': 'rgba(14, 165, 233, 0.2)',
    '--dmq-amber': '#fbbf24',
    '--dmq-amber-deep': '#d97706',
    '--dmq-amber-bg': 'rgba(251, 191, 36, 0.1)',
    '--dmq-amber-border': 'rgba(251, 191, 36, 0.2)',
    '--dmq-rose': '#f87171',
    '--dmq-rose-bg': 'rgba(248, 113, 113, 0.1)',
    '--dmq-rose-border': 'rgba(248, 113, 113, 0.2)',
    '--dmq-red': '#dc2626',
    '--dmq-red-dark': '#991b1b',
    '--dmq-red-bg': 'rgba(220, 38, 38, 0.1)',
    '--dmq-red-border': 'rgba(220, 38, 38, 0.2)',
    '--dmq-violet': '#a78bfa',
    '--dmq-violet-bg': 'rgba(167, 139, 250, 0.1)',
    '--dmq-cyan': '#22d3ee',
    '--dmq-cyan-dark': '#0891b2',
    '--dmq-cyan-bg': 'rgba(34, 211, 238, 0.1)',
    '--dmq-cyan-border': 'rgba(34, 211, 238, 0.2)',
    '--dmq-lime': '#84cc16',
    '--dmq-lime-bright': '#a3e635',
    '--dmq-lime-dark': '#65a30d',
    '--dmq-lime-bg': 'rgba(132, 204, 22, 0.1)',
    '--dmq-green-deep': '#16a34a',
    '--dmq-orange': '#ea580c',
    '--dmq-orange-light': '#f97316',
    '--dmq-yellow-deep': '#ca8a04',
    '--dmq-pink': '#ec4899',
    '--dmq-blue': '#1d4ed8',
    '--dmq-blue-deep': '#1e40af',
    '--dmq-blue-bright': '#4361ee',
    '--dmq-blue-bg': 'rgba(29, 78, 216, 0.1)',
    '--dmq-blue-border': 'rgba(29, 78, 216, 0.2)',
    '--dmq-blue-bright-bg': 'rgba(67, 97, 238, 0.1)',
    '--dmq-blue-bright-border': 'rgba(67, 97, 238, 0.2)',

    # Neutral
    '--dmq-neutral-50': '#f9fafb',
    '--dmq-neutral-100': '#f3f4f6',
    '--dmq-neutral-200': '#e5e7eb',
    '--dmq-neutral-300': '#d1d5db',
    '--dmq-neutral-400': '#9ca3af',
    '--dmq-neutral-500': '#6b7280',
    '--dmq-neutral-600': '#4b5563',
    '--dmq-neutral-700': '#374151',
    '--dmq-neutral-800': '#1f2937',
    '--dmq-neutral-900': '#111827',
    '--dmq-neutral-bg': 'rgba(161, 161, 170, 0.12)',
    '--dmq-neutral-border': 'rgba(161, 161, 170, 0.2)',

    # Flat utility
    '--dmq-white': '#ffffff',
    '--dmq-black': '#000000',
    '--dmq-off-white': '#f8f9fa',
    '--dmq-warm-white': '#f0f0f5',
    '--dmq-cool-gray': '#e4e4e7',
    '--dmq-slate': '#a0a0b8',
    '--dmq-muted-gray': '#6b6b80',
    '--dmq-dim-gray': '#666666',
    '--dmq-medium-gray': '#999999',
    '--dmq-light-gray': '#cccccc',
    '--dmq-border-gray': '#a1a1aa',
    '--dmq-zinc': '#71717a',
    '--dmq-zinc-dark': '#52525b',
    '--dmq-sky-blue': '#818cf8',
    '--dmq-light-blue': '#bfdbfe',
    '--dmq-soft-blue': '#eff6ff',
    '--dmq-light-red': '#fef2f2',
    '--dmq-light-green': '#ecfdf5',
    '--dmq-light-amber': '#fef3c7',
    '--dmq-warm-bg': '#fffdf5',
    '--dmq-warm-bg-alt': '#fffbeb',
    '--dmq-cool-bg': '#f8fafc',

    # Surface extended
    '--dmq-surface-extended-overlay': 'rgba(6, 9, 15, 0.88)',
    '--dmq-surface-extended-overlay-alt': 'rgba(8, 8, 22, 0.85)',
    '--dmq-surface-extended-overlay-deep': 'rgba(15, 15, 26, 0.85)',
    '--dmq-surface-extended-backdrop': 'rgba(30, 37, 53, 0.8)',
    '--dmq-surface-extended-backdrop-alt': 'rgba(17, 24, 39, 0.8)',
}


# ── Step 1: Generate CSS custom property block ──
def generate_css_block():
    lines = []
    lines.append("  /* ═══════════════════════════════════════════════════")
    lines.append("     Design Token Bridge — --dmq-* Custom Properties")
    lines.append("     Auto-generated from design-tokens.ts")
    lines.append("     Use these in screen files: var(--dmq-xxx)")
    lines.append("     ═══════════════════════════════════════════════════ */")
    lines.append("")

    for var_name in sorted(CSS_VAR_VALUES.keys()):
        lines.append(f"  {var_name}: {CSS_VAR_VALUES[var_name]};")

    return '\n'.join(lines)


# ── Step 2: Find all hardcoded hex colors in screen files ──
def find_hex_colors_in_files(directory, extensions=('.tsx', '.jsx', '.ts')):
    hex_pattern = re.compile(r'#[0-9a-fA-F]{3,8}\b')
    file_hex_counts = {}
    all_hex_counter = Counter()

    for filepath in sorted(directory.rglob('*')):
        if filepath.suffix in extensions:
            content = filepath.read_text()
            matches = hex_pattern.findall(content)
            normalized = [m.lower() for m in matches]

            if normalized:
                rel_path = filepath.relative_to(PROJECT_ROOT)
                file_hex_counts[str(rel_path)] = Counter(normalized)
                all_hex_counter.update(normalized)

    return all_hex_counter, file_hex_counts


# ── Step 3: Perform safe replacements ──
def perform_safe_replacements(file_hex_counts, hex_to_var, top_n):
    all_hexes = Counter()
    for counter in file_hex_counts.values():
        all_hexes.update(counter)

    top_hexes = all_hexes.most_common(top_n)
    actionable = [(hex_val, count) for hex_val, count in top_hexes if hex_val in hex_to_var]
    unhandled = [(hex_val, count) for hex_val, count in top_hexes if hex_val not in hex_to_var]

    total_replacements = 0
    files_modified = set()
    replacement_log = []

    for hex_val, total_count in actionable:
        css_var = hex_to_var[hex_val]
        instance_count = 0

        for rel_path, counter in file_hex_counts.items():
            if hex_val not in counter:
                continue

            filepath = PROJECT_ROOT / rel_path
            content = filepath.read_text()
            new_content = content

            # Replace quoted hex values: '#hex' or "#hex" → var(--dmq-xxx)
            # Pattern: single or double quote, then the hex, then same quote
            # This handles: color: '#hex', color: "#hex"
            # We only replace when the hex is inside quotes (used as a value in JS/TSX)
            escaped = re.escape(hex_val)

            # Replace '#hex' → 'var(--dmq-xxx)'  (single quotes, PRESERVED)
            new_content = re.sub(
                rf"'({escaped})'",
                f"'var({css_var})'",
                new_content,
                flags=re.IGNORECASE
            )

            # Replace "#hex" → "var(--dmq-xxx)"  (double quotes, PRESERVED)
            new_content = re.sub(
                rf'"({escaped})"',
                f'"var({css_var})"',
                new_content,
                flags=re.IGNORECASE
            )

            if new_content != content:
                old_count = len(re.findall(escaped, content, re.IGNORECASE))
                new_count = len(re.findall(escaped, new_content, re.IGNORECASE))
                actual_changes = old_count - new_count

                if actual_changes > 0:
                    filepath.write_text(new_content)
                    files_modified.add(rel_path)
                    instance_count += actual_changes

        if instance_count > 0:
            replacement_log.append({
                'hex': hex_val,
                'var': css_var,
                'files': len([rp for rp in files_modified if hex_val in file_hex_counts.get(rp, {})]),
                'instances': instance_count,
                'total_available': total_count
            })
            total_replacements += instance_count

    return replacement_log, unhandled, total_replacements, len(files_modified)


# ── Main ──
def main():
    print("=" * 70)
    print("DESIGN TOKEN MIGRATION — Phase 3.1")
    print("=" * 70)

    # Step 1: Generate CSS
    print("\n[1] Generating CSS custom property bridge...")
    css_block = generate_css_block()
    css_output = PROJECT_ROOT / "scripts" / "generated-dmq-tokens.css"
    css_output.write_text(css_block)
    print(f"    Generated {len(CSS_VAR_VALUES)} CSS custom properties")
    print(f"    Saved to {css_output}")

    # Step 2: Scan
    print("\n[2] Scanning screen files for hardcoded hex colors...")
    all_hex_counter, file_hex_counts = find_hex_colors_in_files(SCREENS_DIR)
    unique_hexes = len(all_hex_counter)
    total_instances = sum(all_hex_counter.values())
    files_affected = len(file_hex_counts)
    print(f"    Found {total_instances} hardcoded hex instances across {unique_hexes} unique values in {files_affected} files")

    # Step 3: Coverage
    covered_hexes = set(all_hex_counter.keys()) & set(HEX_TOKEN_MAP.keys())
    covered_instances = sum(all_hex_counter[h] for h in covered_hexes)
    print(f"    Token coverage: {len(covered_hexes)}/{unique_hexes} unique values, {covered_instances}/{total_instances} instances ({100*covered_instances/total_instances:.1f}%)")

    # Step 4: Perform replacements
    print(f"\n[3] Performing bulk replacements for top {TOP_N} hex values...")
    replacement_log, unhandled, total_replacements, files_modified_count = perform_safe_replacements(
        file_hex_counts, HEX_TOKEN_MAP, TOP_N
    )
    print(f"    Replaced {total_replacements} instances across {files_modified_count} files")

    # Top 20 report
    print("\n" + "=" * 70)
    print("TOP 20 MOST COMMON HARDCODED HEX VALUES")
    print("=" * 70)
    print(f"{'Rank':<5} {'Hex Value':<12} {'Count':<7} {'Mapped':<8} {'CSS Variable'}")
    print("-" * 70)
    for i, (hex_val, count) in enumerate(all_hex_counter.most_common(20), 1):
        mapped = "✓" if hex_val in HEX_TOKEN_MAP else "✗"
        var_name = HEX_TOKEN_MAP.get(hex_val, "—")
        print(f"{i:<5} {hex_val:<12} {count:<7} {mapped:<8} {var_name}")

    # Replacement log
    if replacement_log:
        print("\n" + "=" * 70)
        print("REPLACEMENTS PERFORMED")
        print("=" * 70)
        for entry in replacement_log:
            print(f"  {entry['hex']} → {entry['var']} ({entry['instances']} instances)")

    if unhandled:
        print("\n" + "=" * 70)
        print("TOP HEX VALUES WITHOUT TOKEN MAPPING (need manual review)")
        print("=" * 70)
        for hex_val, count in unhandled:
            print(f"  {hex_val}: {count} instances")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  CSS custom properties generated:  {len(CSS_VAR_VALUES)}")
    print(f"  Total hardcoded hex instances:     {total_instances}")
    print(f"  Unique hex values:                  {unique_hexes}")
    print(f"  Files with hardcoded hex:          {files_affected}")
    print(f"  Instances replaced:                 {total_replacements}")
    print(f"  Files modified:                    {files_modified_count}")
    print(f"  Remaining technical debt:          {total_instances - total_replacements} instances")
    print(f"  Migration coverage:                 {100*total_replacements/total_instances:.1f}%")
    print(f"  Theoretical max coverage:           {100*covered_instances/total_instances:.1f}%")
    print("=" * 70)

    # JSON report
    report = {
        'css_properties_generated': len(CSS_VAR_VALUES),
        'total_hex_instances': total_instances,
        'unique_hex_values': unique_hexes,
        'files_affected': files_affected,
        'instances_replaced': total_replacements,
        'files_modified': files_modified_count,
        'replacements': replacement_log,
        'top_20': [{
            'hex': h, 'count': c, 'mapped': h in HEX_TOKEN_MAP,
            'var': HEX_TOKEN_MAP.get(h)
        } for h, c in all_hex_counter.most_common(20)],
        'unhandled_top': [{'hex': h, 'count': c} for h, c in unhandled],
        'theoretical_coverage_pct': round(100 * covered_instances / total_instances, 1),
        'migration_coverage_pct': round(100 * total_replacements / total_instances, 1),
    }
    report_path = PROJECT_ROOT / "scripts" / "migration-report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\n  Full report saved to: {report_path}")


if __name__ == '__main__':
    main()
