#!/usr/bin/env python3
"""
Task 3.5: Safely add EnterpriseErrorState imports and ErrorBoundary 
imports to all screens that don't have them.

This script ONLY adds imports — no JSX modifications.
The JSX changes will be done manually for key screens.
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

def add_import(content, import_stmt):
    """Add import after last existing import."""
    # Check if already imported
    match = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'"]([^\'"]+)[\'"]', import_stmt)
    if not match:
        return content
    from_path = match.group(2)
    new_imports = set(x.strip() for x in match.group(1).split(','))
    
    # Check existing imports from same path
    existing = re.finditer(r'import\s*\{([^}]+)\}\s*from\s*[\'"]' + re.escape(from_path) + r'[\'"]', content)
    for ex in existing:
        existing_imports = set(x.strip() for x in ex.group(1).split(','))
        to_add = new_imports - existing_imports
        if not to_add:
            return content  # Nothing to add
        merged = ex.group(1).rstrip() + ', ' + ', '.join(to_add)
        content = content[:ex.start()] + f"import {{{merged}}} from '{from_path}';" + content[ex.end():]
        return content
    
    # Add as new import after last import
    import_matches = list(re.finditer(r"^import\s+.*?;.*$", content, re.MULTILINE))
    if import_matches:
        last = import_matches[-1]
        content = content[:last.end()] + "\n" + import_stmt + content[last.end():]
    return content

def main():
    files = get_screen_files()
    print(f"Adding imports to {len(files)} screens...\n")
    
    modified = []
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        
        # Add ErrorBoundary import if missing
        if 'ErrorBoundary' not in content:
            content = add_import(content, "import { ErrorBoundary } from '@/components/error-boundary';")
        
        # Add EnterpriseErrorState import if missing  
        if 'EnterpriseErrorState' not in content:
            content = add_import(content, "import { EnterpriseErrorState } from '@/components/enterprise';")
        
        if content != original:
            write_file(filepath, content)
            modified.append(filename)
    
    print(f"Modified: {len(modified)} files")
    for f in modified:
        print(f"  - {f}")

if __name__ == '__main__':
    main()
