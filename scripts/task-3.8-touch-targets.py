#!/usr/bin/env python3
"""
Task 3.8: Batch-fix small touch targets in screen files.
Replace h-7 (28px) with h-8 (32px) and add min-h-[36px] for better touch targets.
Only modify button/icon-btn elements, not divs.
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

def fix_touch_targets(content):
    """Fix small button touch targets."""
    changes = 0
    
    # Pattern 1: Button with h-7 w-7 p-0 (icon buttons)
    pattern1 = r'className="([^"]*?)h-7 w-7 p-0([^"]*?)"'
    def repl1(m):
        nonlocal changes
        changes += 1
        return f'className="{m.group(1)}h-8 w-8 p-0 min-h-[36px] min-w-[36px]{m.group(2)}"'
    content = re.sub(pattern1, repl1, content)
    
    # Pattern 2: <button ... className="p-1 ..."> with small icons (no explicit h-7)
    pattern2 = r'<button\s+onClick([^>]*?)className="p-1([^"]*?)"'
    def repl2(m):
        nonlocal changes
        changes += 1
        return f'<button onClick{m.group(1)}className="p-1.5 min-h-[36px] min-w-[36px]{m.group(2)}"'
    content = re.sub(pattern2, repl2, content)
    
    return content, changes

def main():
    files = get_screen_files()
    print(f"Fixing touch targets across {len(files)} screens...\n")
    
    total_changes = 0
    modified = []
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        
        content, changes = fix_touch_targets(content)
        
        if changes > 0:
            write_file(filepath, content)
            total_changes += changes
            modified.append((filename, changes))
            print(f"  ✓ {filename}: {changes} fixes")
    
    print(f"\nTotal: {total_changes} touch target fixes across {len(modified)} files")

if __name__ == '__main__':
    main()
