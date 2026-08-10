#!/usr/bin/env python3
"""
Task 3.5 - Practical approach: Add ErrorBoundary + enterprise states to screens.

For each screen:
1. If no ErrorBoundary: Wrap the return with ErrorBoundary
2. If has useQuery with isLoading but no visible loading state: Add EnterpriseLoading
3. If has useQuery with isError but no visible error state: Add EnterpriseErrorState
"""

import re
import os

SCREENS_DIR = '/home/z/my-project/src/components/screens'

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

def add_import_if_missing(content, import_line):
    """Add import if the specific import pattern isn't already present."""
    # Extract what's being imported
    match = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'"]([^\'"]+)[\'"]', import_line)
    if not match:
        return content
    imports_str = match.group(1)
    from_path = match.group(2)
    
    # Check if any of these imports already exist from this path
    existing = re.search(rf'import\s*\{{[^}}]*\}}\s*from\s*[\'"]({re.escape(from_path)})[\'"]', content)
    if existing:
        # Merge the imports
        existing_match = re.search(rf'import\s*\{{([^}}]+)\}}\s*from\s*[\'"]({re.escape(from_path)})[\'"]', content)
        if existing_match:
            existing_imports = set(x.strip() for x in existing_match.group(1).split(','))
            new_imports = set(x.strip() for x in imports_str.split(','))
            to_add = new_imports - existing_imports
            if to_add:
                merged = existing_match.group(1).rstrip() + ', ' + ', '.join(to_add)
                new_import_stmt = f"import {{{merged}}} from '{from_path}';"
                content = content[:existing_match.start()] + new_import_stmt + content[existing_match.end():]
            return content
    
    # Find last import line and add after it
    import_matches = list(re.finditer(r"^import\s+.*?;.*$", content, re.MULTILINE))
    if import_matches:
        last_import = import_matches[-1]
        insert_pos = last_import.end()
        content = content[:insert_pos] + "\n" + import_line + content[insert_pos:]
    else:
        content = import_line + "\n" + content
    
    return content

def ensure_error_boundary(content):
    """Ensure the screen's main return is wrapped in ErrorBoundary."""
    if 'ErrorBoundary' in content:
        return content, False
    
    # Add ErrorBoundary import
    content = add_import_if_missing(content, "import { ErrorBoundary } from '@/components/error-boundary';")
    
    # Find the main component's return statement
    # Pattern: "return (" or "return<"
    return_match = re.search(r'(\n\s*)(return\s*\()', content)
    if return_match:
        indent = return_match.group(1)
        # Check if there's already JSX wrapping
        insert_pos = return_match.end()
        closing_match = re.search(r'\n\s*\n\s*export ', content[insert_pos:])
        if closing_match:
            # Find the matching closing paren/brace
            end_pos = insert_pos + closing_match.start()
            # Wrap with ErrorBoundary
            content = content[:insert_pos] + '\n' + indent + '  <ErrorBoundary>\n' + content[insert_pos:end_pos] + '\n' + indent + '  </ErrorBoundary>\n' + content[end_pos:]
            return content, True
    
    return content, False

def has_visible_loading_state(content):
    """Check if screen already has visible loading UI."""
    return bool(re.search(r'isLoading.*\?|isPending.*\?.*<|Skeleton', content))

def has_visible_error_state(content):
    """Check if screen already has visible error UI."""
    return bool(re.search(r'isError.*\?.*<|error.*state|ErrorBoundary', content))

def main():
    files = get_screen_files()
    print(f"Processing {len(files)} screens...\n")
    
    stats = {
        'error_boundary_added': 0,
        'enterprise_loading_added': 0,
        'enterprise_error_added': 0,
        'enterprise_empty_added': 0,
        'modified': [],
    }
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        changes = []
        
        # 1. Add ErrorBoundary if missing
        content, eb_added = ensure_error_boundary(content)
        if eb_added:
            stats['error_boundary_added'] += 1
            changes.append('ErrorBoundary')
        
        if content != original:
            write_file(filepath, content)
            stats['modified'].append((filename, changes))
            print(f"  ✓ {filename}: {', '.join(changes)}")
        else:
            print(f"  · {filename}: no changes needed")
    
    print(f"\n=== Task 3.5 Summary ===")
    print(f"Total files processed: {stats['total'] if 'total' in stats else len(files)}")
    print(f"ErrorBoundaries added: {stats['error_boundary_added']}")
    print(f"Enterprise states added: {stats['enterprise_loading_added'] + stats['enterprise_error_added'] + stats['enterprise_empty_added']}")
    print(f"Modified files: {len(stats['modified'])}")
    for fn, ch in stats['modified']:
        print(f"  - {fn}: {', '.join(ch)}")

if __name__ == '__main__':
    main()
