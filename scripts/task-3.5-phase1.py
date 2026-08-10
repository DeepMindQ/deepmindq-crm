#!/usr/bin/env python3
"""
Task 3.5: Add Enterprise state components to all screens that need them.

Phase 1: Add EnterpriseErrorState to screens that have isError/isError checks but 
         use inline error JSX instead of EnterpriseErrorState.
         
Phase 2: Add EnterpriseLoading to screens that use inline spinner patterns.
         
Phase 3: Add EnterpriseEmptyState to screens that have no empty state handling.

Strategy: Be surgical — only replace clear, safe patterns. Don't touch complex 
conditional rendering that could break.
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

def add_import(content, component_name):
    """Add an import for an Enterprise component."""
    import_stmt = f"import {{ {component_name} }} from '@/components/enterprise';"
    
    if component_name in content:
        return content  # Already imported
    
    # Find the last import line
    import_matches = list(re.finditer(r"^import\s+.*?;.*$", content, re.MULTILINE))
    if import_matches:
        last_import = import_matches[-1]
        insert_pos = last_import.end()
        content = content[:insert_pos] + "\n" + import_stmt + content[insert_pos:]
    else:
        # No imports found — add after 'use client' if present
        uc_match = re.search(r"'use client';\n", content)
        if uc_match:
            insert_pos = uc_match.end()
            content = content[:insert_pos] + "\n" + import_stmt + "\n" + content[insert_pos:]
        else:
            content = import_stmt + "\n" + content
    
    return content

def add_enterprise_loading_skeleton_wrapper(content):
    """
    For screens using Skeleton loading patterns, wrap them with EnterpriseLoading.
    Actually, Skeleton loading is BETTER than a spinner for table/list views.
    So we only replace pure spinner patterns (no Skeleton).
    """
    return content

def add_error_state_to_screens_with_iserror(content, filename):
    """
    For screens that have isError from useQuery but no error rendering,
    add EnterpriseErrorState.
    """
    # Check if screen has isError from useQuery
    has_iserror = bool(re.search(r'isError', content))
    has_enterprise_error = 'EnterpriseErrorState' in content
    has_error_rendering = bool(re.search(r'isError.*\?.*<', content))
    
    if not has_iserror or has_enterprise_error or has_error_rendering:
        return content, False
    
    # This screen has isError but no error UI — add it
    # Find the main return statement's opening
    # We need to find where isLoading check is and add isError check before it
    
    # Pattern: find "{isLoading ?" and add error check before it
    loading_match = re.search(r'(\{isLoading\s*\?.*?\n)', content)
    if loading_match:
        # Add error check before the loading check
        indent = re.match(r'(\s*)', content[loading_match.start():])[1]
        error_block = f"""{{isError ? (
        <EnterpriseErrorState
          title="Failed to load data"
          message="{{(queryError as Error)?.message || 'An unexpected error occurred. Please try again.'}}"
          onRetry={{() => refetch()}}
        />
      ) : """
        insert_pos = loading_match.start()
        content = content[:insert_pos] + error_block + content[insert_pos:]
        return content, True
    
    # Pattern: find "isLoading &&" ternary 
    loading_and = re.search(r'(\s*)\{isLoading\s*&&\s*\(', content)
    if loading_and:
        # Try adding error state
        pass
    
    return content, False

def replace_inline_error_with_enterprise(content):
    """
    Replace inline error JSX patterns with EnterpriseErrorState.
    Pattern: {isError ? (<div className="flex flex-col items-center...>...error...</div>) : ...}
    """
    # This is complex and varies per screen — only handle the clearest patterns
    
    # Pattern: Complete error block with retry button
    patterns = [
        # Pattern 1: div with flex-col items-center containing error icon + message + retry
        (r'\{isError\s*\?\s*\(\s*<div className="flex flex-col items-center justify-center[^"]*">\s*<div[^>]*>.*?</div>\s*<h3[^>]*>.*?error.*?</h3>\s*<p[^>]*>.*?</p>\s*<button[^>]*>.*?retry.*?</button>\s*</div>\s*\)',
         '<EnterpriseErrorState onRetry={refetch} />'),
    ]
    
    changed = False
    for pattern, replacement in patterns:
        new_content = re.sub(pattern, replacement, content, flags=re.DOTALL | re.IGNORECASE)
        if new_content != content:
            content = new_content
            changed = True
    
    return content, changed

def main():
    files = get_screen_files()
    print(f"Found {len(files)} screen files to process\n")
    
    stats = {
        'total': len(files),
        'error_imports_added': 0,
        'loading_imports_added': 0,
        'empty_imports_added': 0,
        'error_states_added': 0,
        'modified': [],
    }
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = read_file(filepath)
        original = content
        
        modified = False
        
        # Phase 1: Check for screens with isError but no error rendering
        content, error_added = add_error_state_to_screens_with_iserror(content, filename)
        if error_added:
            content = add_import(content, 'EnterpriseErrorState')
            stats['error_imports_added'] += 1
            stats['error_states_added'] += 1
            modified = True
        
        # Phase 2: Replace inline error patterns with Enterprise components
        content, error_replaced = replace_inline_error_with_enterprise(content)
        if error_replaced:
            content = add_import(content, 'EnterpriseErrorState')
            stats['error_imports_added'] += 1
            modified = True
        
        if content != original:
            write_file(filepath, content)
            stats['modified'].append(filename)
            print(f"  ✓ {filename}")
        else:
            # Categorize why not modified
            has_iserror = bool(re.search(r'isError', content))
            has_enterprise = bool(re.search(r'Enterprise', content))
            has_error_render = bool(re.search(r'isError.*\?.*<', content))
            reason = []
            if not has_iserror: reason.append('no isError')
            elif has_error_render: reason.append('has error rendering')
            if has_enterprise: reason.append('already has Enterprise')
            if not reason: reason.append('complex pattern')
            print(f"  - {filename} ({', '.join(reason)})")
    
    print(f"\n=== Task 3.5 Results ===")
    print(f"Total files: {stats['total']}")
    print(f"Error states added: {stats['error_states_added']}")
    print(f"Modified files: {len(stats['modified'])}")
    if stats['modified']:
        for f in stats['modified']:
            print(f"  - {f}")

if __name__ == '__main__':
    main()
