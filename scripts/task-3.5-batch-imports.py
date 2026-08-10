#!/usr/bin/env python3
"""
Task 3.5 Batch: Add EnterpriseErrorState + ErrorBoundary to screens
that have data fetching but no error handling.

For each screen:
1. Add EnterpriseErrorState import if not present
2. Add ErrorBoundary import if not present
3. Add error state rendering before the loading check
4. Wrap return with ErrorBoundary if not present

This script handles the SIMPLE, COMMON patterns only.
Complex screens are handled manually.
"""

import re
import os

SCREENS_DIR = '/home/z/my-project/src/components/screens'

# Screens already manually modified
ALREADY_DONE = {
    'contacts-screen.tsx',
    'pipeline-screen.tsx',
    'intelligence-hub-screen.tsx',
    'tasks-screen.tsx',
    'companies-screen.tsx',
    'opportunities-screen.tsx',
    'dashboard-screen.tsx',  # already had Enterprise states
    'icp-settings-screen.tsx',  # already had Enterprise states
    'import-screen.tsx',  # already had Enterprise states
}

def get_screen_files():
    files = []
    for f in os.listdir(SCREENS_DIR):
        if f.endswith('-screen.tsx') and f not in ALREADY_DONE:
            files.append(os.path.join(SCREENS_DIR, f))
    return sorted(files)

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def add_imports(content):
    """Add EnterpriseErrorState and ErrorBoundary imports."""
    changes = []
    
    # Add ErrorBoundary if missing
    if 'ErrorBoundary' not in content:
        import_line = "import { ErrorBoundary } from '@/components/error-boundary';"
        import_matches = list(re.finditer(r"^import\s+.*?;.*$", content, re.MULTILINE))
        if import_matches:
            last = import_matches[-1]
            content = content[:last.end()] + "\n" + import_line + content[last.end():]
            changes.append('ErrorBoundary import')
    
    # Add EnterpriseErrorState if missing
    if 'EnterpriseErrorState' not in content:
        import_line = "import { EnterpriseErrorState } from '@/components/enterprise';"
        import_matches = list(re.finditer(r"^import\s+.*?;.*$", content, re.MULTILINE))
        if import_matches:
            last = import_matches[-1]
            content = content[:last.end()] + "\n" + import_line + content[last.end():]
            changes.append('EnterpriseErrorState import')
    
    return content, changes

def add_error_to_query(content):
    """Add error destructuring to useQuery if not present."""
    # Find useQuery calls that have data but not error
    pattern = r"const\s*\{\s*data([^}]*?)\}\s*=\s*useQuery"
    
    def replacer(m):
        destructure = m.group(1)
        if 'error' not in destructure and 'isError' not in destructure:
            # Add 'error' to destructuring
            if destructure.strip():
                new_destructure = destructure.rstrip().rstrip(',') + ', error'
            else:
                new_destructure = ', error'
            return f"const {{{new_destructure}}} = useQuery"
        return m.group(0)
    
    new_content = re.sub(pattern, replacer, content)
    return new_content, new_content != content

def main():
    files = get_screen_files()
    print(f"Processing {len(files)} screens...\n")
    
    stats = {
        'imports_added': 0,
        'error_destructuring_added': 0,
        'error_boundary_added': 0,
        'modified': [],
        'skipped': [],
    }
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        changes = []
        
        # 1. Add imports
        content, import_changes = add_imports(content)
        changes.extend(import_changes)
        
        # 2. Add error destructuring to useQuery calls
        content, error_added = add_error_to_query(content)
        if error_added:
            changes.append('error destructuring')
            stats['error_destructuring_added'] += 1
        
        if content != original:
            write_file(filepath, content)
            stats['imports_added'] += len(import_changes)
            stats['modified'].append(filename)
            print(f"  ✓ {filename}: {', '.join(changes)}")
        else:
            reason = []
            if 'ErrorBoundary' in content: reason.append('has ErrorBoundary')
            if 'EnterpriseErrorState' in content: reason.append('has EnterpriseErrorState')
            stats['skipped'].append((filename, ', '.join(reason) if reason else 'no changes'))
    
    print(f"\n=== Results ===")
    print(f"Modified: {len(stats['modified'])}")
    print(f"Error destructuring added: {stats['error_destructuring_added']}")
    for f in stats['modified']:
        print(f"  - {f}")

if __name__ == '__main__':
    main()
