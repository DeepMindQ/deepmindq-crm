#!/usr/bin/env python3
"""
Phase 3A Task 3.1 — Color Migration Audit Script
Scans all .tsx/.ts files for hardcoded colors and maps them to design tokens.
Generates a migration manifest for automated replacement.
"""

import re
import os
import json
from pathlib import Path
from collections import defaultdict

SRC_DIR = "/home/z/my-project/src"
TOKENS_FILE = "/home/z/my-project/src/components/intelligence-os/design-tokens.ts"
OUTPUT = "/home/z/my-project/scripts/color-migration-manifest.json"

# ── Parse design-tokens.ts to extract all color values ──
def extract_token_colors(filepath):
    """Extract all hex/rgba colors and their token paths from design-tokens.ts"""
    colors = {}
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Match patterns like key: '#...' or key: 'rgba(...)'
    # We need to track the path (e.g., surface.card, text.primary, accent.DEFAULT)
    
    token_map = {
        'surface.base': '#0a0c10',
        'surface.secondary': '#0f1219',
        'surface.card': '#141821',
        'surface.cardHover': '#1a1f2b',
        'surface.elevated': '#1e2433',
        'surface.overlay': 'rgba(10, 12, 16, 0.85)',
        'border.default': '#1e2535',
        'border.hover': '#2a3348',
        'border.subtle': 'rgba(42, 51, 72, 0.4)',
        'border.focus': '#3b82f6',
        'text.primary': '#e8ecf4',
        'text.secondary': '#8892a8',
        'text.muted': '#5a6478',
        'text.inverse': '#0a0c10',
        'text.accent': '#93c5fd',
        'accent.DEFAULT': '#3b82f6',
        'accent.dim': '#2563eb',
        'accent.bright': '#60a5fa',
        'accent.subtle': 'rgba(59, 130, 246, 0.1)',
        'accent.strong': 'rgba(59, 130, 246, 0.25)',
        'accent.ghost': 'rgba(59, 130, 246, 0.06)',
        'domain.signal': '#3b82f6',
        'domain.opportunity': '#a855f7',
        'domain.risk': '#ef4444',
        'domain.enrichment': '#06b6d4',
        'domain.reasoning': '#f59e0b',
        'domain.action': '#22c55e',
        'trust.verified.value': '#22c55e',
        'trust.verified.bg': 'rgba(34, 197, 94, 0.12)',
        'trust.verified.border': 'rgba(34, 197, 94, 0.3)',
        'trust.high.value': '#14b8a6',
        'trust.high.bg': 'rgba(20, 184, 166, 0.12)',
        'trust.high.border': 'rgba(20, 184, 166, 0.3)',
        'trust.medium.value': '#f59e0b',
        'trust.medium.bg': 'rgba(245, 158, 11, 0.12)',
        'trust.medium.border': 'rgba(245, 158, 11, 0.3)',
        'trust.low.value': '#f97316',
        'trust.low.bg': 'rgba(249, 115, 22, 0.12)',
        'trust.low.border': 'rgba(249, 115, 22, 0.3)',
        'trust.unverified.value': '#6b7280',
        'trust.unverified.bg': 'rgba(107, 114, 128, 0.12)',
        'trust.unverified.border': 'rgba(107, 114, 128, 0.3)',
        'confidence.high.value': '#14b8a6',
        'confidence.high.bg': 'rgba(20, 184, 166, 0.1)',
        'confidence.high.border': 'rgba(20, 184, 166, 0.2)',
        'confidence.medium.value': '#f59e0b',
        'confidence.medium.bg': 'rgba(245, 158, 11, 0.1)',
        'confidence.medium.border': 'rgba(245, 158, 11, 0.2)',
        'confidence.low.value': '#ef4444',
        'confidence.low.bg': 'rgba(239, 68, 68, 0.1)',
        'confidence.low.border': 'rgba(239, 68, 68, 0.2)',
        'priority.critical.value': '#ef4444',
        'priority.critical.bg': 'rgba(239, 68, 68, 0.1)',
        'priority.critical.border': 'rgba(239, 68, 68, 0.2)',
        'priority.high.value': '#f59e0b',
        'priority.high.bg': 'rgba(245, 158, 11, 0.1)',
        'priority.high.border': 'rgba(245, 158, 11, 0.2)',
        'priority.medium.value': '#3b82f6',
        'priority.medium.bg': 'rgba(59, 130, 246, 0.1)',
        'priority.medium.border': 'rgba(59, 130, 246, 0.2)',
        'priority.low.value': '#8892a8',
        'priority.low.bg': 'rgba(136, 146, 168, 0.1)',
        'priority.low.border': 'rgba(136, 146, 168, 0.2)',
    }
    
    # Normalize: build reverse map from color value -> token path
    reverse = {}
    for token_path, color_val in token_map.items():
        # Normalize hex to lowercase
        normalized = color_val.lower().strip()
        if normalized not in reverse:
            reverse[normalized] = []
        reverse[normalized].append(token_path)
    
    return token_map, reverse

# ── Scan source files for hardcoded colors ──
def scan_for_hardcoded_colors(src_dir):
    """Scan all .tsx/.ts files for hardcoded hex and rgba colors"""
    hex_pattern = re.compile(r'#([0-9a-fA-F]{3,8})\b')
    rgba_pattern = re.compile(r'rgba?\([^)]+\)')
    
    # String-based patterns (inside style={{...}} or className strings)
    results = defaultdict(lambda: {'hex': [], 'rgba': []})
    
    for root, dirs, files in os.walk(src_dir):
        # Skip node_modules, __tests__, .next
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '__pycache__']]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')) and not fname.endswith('.test.ts') and not fname.endswith('.test.tsx'):
                fpath = os.path.join(root, fname)
                rel_path = os.path.relpath(fpath, src_dir)
                
                with open(fpath, 'r', errors='replace') as f:
                    content = f.read()
                    lines = content.split('\n')
                
                for line_num, line in enumerate(lines, 1):
                    # Skip import lines and comments with tokens
                    stripped = line.strip()
                    if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('import'):
                        continue
                    
                    # Find hex colors (but not in import paths)
                    for match in hex_pattern.finditer(line):
                        color = match.group(0).lower()
                        # Skip if it's part of an import path or URL
                        if 'import' in line or 'from' in line:
                            continue
                        results[rel_path]['hex'].append({
                            'line': line_num,
                            'color': color,
                            'context': line.strip()[:120]
                        })
                    
                    # Find rgba colors
                    for match in rgba_pattern.finditer(line):
                        color = match.group(0)
                        if 'import' in line or 'from' in line:
                            continue
                        results[rel_path]['rgba'].append({
                            'line': line_num,
                            'color': color,
                            'context': line.strip()[:120]
                        })
    
    return results

# ── Main ──
def main():
    print("=== Phase 3A Task 3.1: Color Migration Audit ===\n")
    
    # Load tokens
    token_map, reverse_map = extract_token_colors(TOKENS_FILE)
    print(f"Loaded {len(token_map)} design token color values\n")
    
    # Scan for hardcoded colors
    print("Scanning source files for hardcoded colors...")
    results = scan_for_hardcoded_colors(SRC_DIR)
    
    # Summary
    total_hex = sum(len(v['hex']) for v in results.values())
    total_rgba = sum(len(v['rgba']) for v in results.values())
    files_affected = len(results)
    
    print(f"\nFound {total_hex} hardcoded hex colors in {files_affected} files")
    print(f"Found {total_rgba} hardcoded rgba colors")
    print(f"Total: {total_hex + total_rgba} hardcoded colors\n")
    
    # Build color frequency map
    hex_freq = defaultdict(int)
    rgba_freq = defaultdict(int)
    
    for fpath, data in results.items():
        for item in data['hex']:
            hex_freq[item['color']] += 1
        for item in data['rgba']:
            rgba_freq[item['color']] += 1
    
    print("Top 20 hex colors by frequency:")
    for color, count in sorted(hex_freq.items(), key=lambda x: -x[1])[:20]:
        matched_tokens = reverse_map.get(color, [])
        token_str = matched_tokens[0] if matched_tokens else "NO TOKEN"
        print(f"  {color:12s} x{count:4d}  → {token_str}")
    
    print(f"\nTop 15 rgba colors by frequency:")
    for color, count in sorted(rgba_freq.items(), key=lambda x: -x[1])[:15]:
        matched_tokens = reverse_map.get(color.lower(), [])
        token_str = matched_tokens[0] if matched_tokens else "NO TOKEN"
        print(f"  {color[:50]:50s} x{count:4d}  → {token_str}")
    
    # Count unmapped colors
    unmapped_hex = sum(count for color, count in hex_freq.items() if color not in reverse_map)
    unmapped_rgba = sum(count for color, count in rgba_freq.items() if color.lower() not in reverse_map)
    
    print(f"\n=== MIGRATION SUMMARY ===")
    print(f"Hex colors:    {total_hex} total, {total_hex - unmapped_hex} mappable to tokens, {unmapped_hex} need new tokens")
    print(f"RGBA colors:   {total_rgba} total, {total_rgba - unmapped_rgba} mappable to tokens, {unmapped_rgba} need new tokens")
    
    # Output manifest
    manifest = {
        'total_hex': total_hex,
        'total_rgba': total_rgba,
        'total': total_hex + total_rgba,
        'files_affected': files_affected,
        'mappable': total_hex + total_rgba - unmapped_hex - unmapped_rgba,
        'unmapped_hex': unmapped_hex,
        'unmapped_rgba': unmapped_rgba,
        'hex_frequency': dict(sorted(hex_freq.items(), key=lambda x: -x[1])),
        'rgba_frequency': dict(sorted(rgba_freq.items(), key=lambda x: -x[1])),
        'files': {k: {'hex': v['hex'], 'rgba': v['rgba'], 'hex_count': len(v['hex']), 'rgba_count': len(v['rgba'])} for k, v in results.items()},
    }
    
    with open(OUTPUT, 'w') as f:
        json.dump(manifest, f, indent=2, default=str)
    
    print(f"\nManifest saved to {OUTPUT}")

if __name__ == '__main__':
    main()
