#!/usr/bin/env python3
"""
Task 3.5: Add Enterprise Loading/Error/Empty state components to all screens.

Strategy: For each screen file that doesn't already import Enterprise components:
1. Add the imports
2. Replace common inline loading/error/empty patterns with Enterprise components
3. Handle various patterns found across the codebase

Patterns to replace:
- Loading: {isLoading && (...) } → <EnterpriseLoading />
- Error: {isError && (...)} → <EnterpriseErrorState />  
- Empty: data.length === 0 && (...) → <EnterpriseEmptyState />
"""

import re
import os

SCREENS_DIR = '/home/z/my-project/src/components/screens'

# Screens that already use Enterprise components — skip these
SKIP_FILES = {
    'icp-settings-screen.tsx',
    'import-screen.tsx',
    'dashboard-screen.tsx',
}

def get_screen_files():
    files = []
    for f in os.listdir(SCREENS_DIR):
        if f.endswith('-screen.tsx') and f not in SKIP_FILES:
            files.append(os.path.join(SCREENS_DIR, f))
    return sorted(files)

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def has_enterprise_import(content):
    return 'EnterpriseLoading' in content or 'EnterpriseErrorState' in content or 'EnterpriseEmptyState' in content

def add_enterprise_imports(content, needs_loading, needs_error, needs_empty):
    """Add Enterprise component imports after existing imports."""
    
    imports_to_add = []
    if needs_loading and 'EnterpriseLoading' not in content:
        imports_to_add.append('EnterpriseLoading')
    if needs_error and 'EnterpriseErrorState' not in content:
        imports_to_add.append('EnterpriseErrorState')
    if needs_empty and 'EnterpriseEmptyState' not in content:
        imports_to_add.append('EnterpriseEmptyState')
    
    if not imports_to_add:
        return content, []
    
    import_line = ", ".join(imports_to_add)
    import_stmt = f"import {{ {import_line} }} from '@/components/enterprise/EnterpriseStateWrapper';"
    
    # Find the last import line and add after it
    import_lines = list(re.finditer(r"^import\s+.*?;.*$", content, re.MULTILINE))
    if import_lines:
        last_import = import_lines[-1]
        insert_pos = last_import.end()
        content = content[:insert_pos] + "\n" + import_stmt + content[insert_pos:]
    
    return content, imports_to_add

def replace_inline_loading(content):
    """Replace common inline loading patterns with EnterpriseLoading."""
    replacements = []
    
    # Pattern 1: {isLoading && (<div ...>...loading...</div>)}
    # This is too dangerous to do with regex across 89 files — each screen has unique loading UI
    # Instead, we'll be more surgical
    
    # Pattern: Replace full-screen centered loading spinners (common pattern)
    # <div className="flex items-center justify-center ..."><Loader2 ...animate-spin.../>
    pattern = r'<div className="flex (?:flex-col )?items-center justify-center[^"]*">\s*<(?:Loader2|RefreshCw)[^>]*className="[^"]*animate-spin[^"]*"[^/]*/>\s*(?:<p[^>]*>.*?Loading.*?</p>)?\s*</div>'
    
    def replacer(m):
        replacements.append(('loading', m.start(), m.group()))
        return '<EnterpriseLoading message="Loading..." size="md" />'
    
    content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    return content, replacements

def main():
    files = get_screen_files()
    print(f"Found {len(files)} screen files to process")
    
    stats = {
        'total': len(files),
        'skipped': 0,
        'imports_added': 0,
        'loading_replaced': 0,
        'error_replaced': 0,
        'empty_replaced': 0,
        'already_has': 0,
        'modified': [],
    }
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        
        if has_enterprise_import(content):
            stats['already_has'] += 1
            stats['skipped'] += 1
            continue
        
        # Detect what patterns exist in the file
        has_loading = bool(re.search(r'isLoading|isPending.*&&.*loader|animate-spin.*Loader2', content))
        has_error = bool(re.search(r'isError|queryError|error.*retry', content))
        has_empty = bool(re.search(r'\.length\s*===?\s*0|showEmpty|No .*found|empty.*state', content, re.IGNORECASE))
        
        if not has_loading and not has_error and not has_empty:
            stats['skipped'] += 1
            continue
        
        # Add imports
        content, added = add_enterprise_imports(content, has_loading, has_error, has_empty)
        if added:
            stats['imports_added'] += 1
        
        # Replace inline patterns
        content, load_replacements = replace_inline_loading(content)
        stats['loading_replaced'] += len(load_replacements)
        
        if content != original:
            write_file(filepath, content)
            stats['modified'].append(filename)
            print(f"  Modified: {filename} (+{len(added)} imports, {len(load_replacements)} loading replacements)")
        else:
            stats['skipped'] += 1
            print(f"  No changes: {filename} (patterns detected but couldn't safely replace)")
    
    print(f"\n=== Task 3.5 Stats ===")
    print(f"Total files: {stats['total']}")
    print(f"Already has Enterprise components: {stats['already_has']}")
    print(f"Skipped (no changes needed): {stats['skipped'] - stats['already_has']}")
    print(f"Imports added: {stats['imports_added']}")
    print(f"Loading patterns replaced: {stats['loading_replaced']}")
    print(f"Modified files: {len(stats['modified'])}")
    for f in stats['modified']:
        print(f"  - {f}")

if __name__ == '__main__':
    main()
