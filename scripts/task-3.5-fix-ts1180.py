#!/usr/bin/env python3
"""
Fix TS1180 errors caused by incorrectly added ', error' in destructuring patterns.
The batch script matched patterns like 'const { companies...' and added ', error' 
in the wrong position — creating 'const {: companies, ..., error}' 
"""

import re
import os

SCREENS_DIR = '/home/z/my-project/src/components/screens'

def get_screen_files():
    return sorted([
        os.path.join(SCREENS_DIR, f) 
        for f in os.listdir(SCREENS_DIR) 
        if f.endswith('-screen.tsx')
    ])

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_destructuring(content):
    """Fix 'const {: ...' → 'const { ...' (remove spurious colon after {)"""
    # Pattern: const {: <field> → const { <field>
    pattern = r'const\s*\{:\s'
    fixed = re.sub(pattern, 'const { ', content)
    return fixed, fixed != content

def main():
    files = get_screen_files()
    print(f"Checking {len(files)} screens for TS1180 issues...\n")
    
    fixed_count = 0
    fixed_files = []
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        
        content, was_fixed = fix_destructuring(content)
        
        if was_fixed:
            write_file(filepath, content)
            fixed_count += content.count('const { ') - original.count('const { ')
            fixed_files.append(filename)
            print(f"  ✓ {filename}: fixed {content.count('const { ') - original.count('const { ')} instances")
    
    print(f"\nFixed {fixed_count} destructuring errors in {len(fixed_files)} files")
    for f in fixed_files:
        print(f"  - {f}")

if __name__ == '__main__':
    main()
