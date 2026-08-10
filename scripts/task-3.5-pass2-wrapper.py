#!/usr/bin/env python3
"""
Task 3.5 Pass 2: Add ErrorBoundary wrapping to return statements
and error state rendering for screens that now have error destructuring
but no error rendering JSX.
"""

import re
import os

SCREENS_DIR = '/home/z/my-project/src/components/screens'

ALREADY_DONE = {
    'contacts-screen.tsx',
    'pipeline-screen.tsx',
    'intelligence-hub-screen.tsx',
    'tasks-screen.tsx',
    'companies-screen.tsx',
    'opportunities-screen.tsx',
    'dashboard-screen.tsx',
    'icp-settings-screen.tsx',
    'import-screen.tsx',
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

def wrap_return_with_error_boundary(content, filename):
    """Wrap the main component's return with ErrorBoundary."""
    if '<ErrorBoundary>' in content:
        return content, False
    
    # Find 'export default function' or 'export function'
    export_match = re.search(r'export\s+default\s+function\s+\w+', content)
    if not export_match:
        return content, False
    
    # Find the return statement AFTER the export default function
    after_export = content[export_match.start():]
    return_match = re.search(r'(return\s*\()', after_export)
    if not return_match:
        return content, False
    
    abs_return_start = export_match.start() + return_match.start()
    
    # Check what follows: should be a JSX element
    after_return = content[return_match.end():].lstrip()
    if not after_return.startswith('<'):
        return content, False
    
    # Find the matching closing for the entire return
    # Strategy: find the last ')' before 'export' or end of file
    remaining = content[abs_return_start:]
    
    # Count parens to find matching close
    depth = 1
    pos = len('(return ')  # length of 'return ('
    i = pos
    while i < len(remaining) and depth > 0:
        if remaining[i] == '(':
            depth += 1
        elif remaining[i] == ')':
            depth -= 1
        i += 1
    
    if depth != 0:
        return content, False
    
    # Insert ErrorBoundary after 'return (' and before the closing ')'
    insert_open = abs_return_start + return_match.end()
    insert_close = abs_return_start + i - 1  # position of closing ')'
    
    content = content[:insert_open] + '\n    <ErrorBoundary>\n    ' + content[insert_open:insert_close] + '\n    </ErrorBoundary>\n  ' + content[insert_close:]
    
    return content, True

def main():
    files = get_screen_files()
    print(f"Processing {len(files)} screens for ErrorBoundary wrapping...\n")
    
    stats = {'wrapped': 0, 'modified': []}
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        
        # Skip if already has ErrorBoundary wrapping
        if '<ErrorBoundary>' in content:
            print(f"  · {filename}: already has ErrorBoundary")
            continue
        
        # Check if ErrorBoundary is imported
        if 'ErrorBoundary' not in content:
            print(f"  · {filename}: no ErrorBoundary import")
            continue
        
        content, wrapped = wrap_return_with_error_boundary(content, filename)
        
        if content != original and wrapped:
            # Verify the file still has balanced JSX
            open_count = content.count('<ErrorBoundary>')
            close_count = content.count('</ErrorBoundary>')
            if open_count == close_count:
                write_file(filepath, content)
                stats['wrapped'] += 1
                stats['modified'].append(filename)
                print(f"  ✓ {filename}: ErrorBoundary wrapped")
            else:
                print(f"  ✗ {filename}: unbalanced ErrorBoundary tags, reverted")
                write_file(filepath, original)
        else:
            print(f"  · {filename}: could not wrap (complex return pattern)")
    
    print(f"\n=== ErrorBoundary Wrapping Results ===")
    print(f"Wrapped: {stats['wrapped']}/{len(files)}")
    for f in stats['modified']:
        print(f"  - {f}")

if __name__ == '__main__':
    main()
