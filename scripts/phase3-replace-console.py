#!/usr/bin/env python3
"""
Phase 3: Replace all console.log/warn/error/info/debug with structured logger.
Optimized single-pass version.
"""

import re
import os

SRC_DIR = '/home/z/my-project/src'
LOGGER_IMPORT = "import { logger } from '@/lib/logger';"

METHOD_MAP = {
    'error': 'error',
    'warn': 'warn',
    'info': 'info',
    'debug': 'debug',
    'log': 'info',
}

stats = {'files': 0, 'replacements': 0, 'imports_added': 0}

CONSOLE_CALL_RE = re.compile(r'console\.(error|warn|log|info|debug)\s*\(')


def find_matching_paren(text: str, start: int) -> int:
    depth = 0
    in_string = False
    string_char = None
    in_template = 0
    i = start
    n = len(text)
    while i < n:
        ch = text[i]
        if in_template > 0:
            if ch == '`':
                in_template -= 1
            elif ch == '{':
                in_template += 1
            elif ch == '}':
                in_template -= 1
        elif in_string:
            if ch == '\\' and i + 1 < n:
                i += 2
                continue
            elif ch == string_char:
                in_string = False
        elif ch in ('"', "'"):
            in_string = True
            string_char = ch
        elif ch == '`':
            in_template = 1
        elif ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def split_args(args_str: str) -> list:
    args = []
    current = []
    depth = 0
    in_string = False
    string_char = None
    in_template = 0
    for ch in args_str:
        if in_template > 0:
            current.append(ch)
            if ch == '`':
                in_template -= 1
            elif ch == '{':
                in_template += 1
            elif ch == '}':
                in_template -= 1
            continue
        if in_string:
            current.append(ch)
            if ch == '\\':
                continue
            elif ch == string_char:
                in_string = False
            continue
        if ch in ('"', "'"):
            in_string = True
            string_char = ch
            current.append(ch)
        elif ch == '`':
            in_template = 1
            current.append(ch)
        elif ch in ('(', '[', '{'):
            depth += 1
            current.append(ch)
        elif ch in (')', ']', '}'):
            depth -= 1
            current.append(ch)
        elif ch == ',' and depth == 0:
            args.append(''.join(current).strip())
            current = []
        else:
            current.append(ch)
    remainder = ''.join(current).strip()
    if remainder:
        args.append(remainder)
    return args


def process_file(filepath: str) -> bool:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if any console calls exist (and not logger.ts)
    if not CONSOLE_CALL_RE.search(content):
        return False
    if "from '@/lib/logger'" in content or 'from "@/lib/logger"' in content:
        # Already imports logger, but may still have console calls
        pass

    original = content
    offset = 0
    result_parts = []
    last_end = 0

    for match in CONSOLE_CALL_RE.finditer(content):
        method = match.group(1)
        logger_method = METHOD_MAP.get(method, 'info')

        # Adjust positions based on previous replacements
        abs_start = match.start() + offset
        paren_start = match.end() - 1 + offset  # position of '('

        close_idx = find_matching_paren(content, match.end() - 1)
        if close_idx < 0:
            continue

        abs_close = close_idx + offset
        args_str = content[match.end():close_idx]
        args = split_args(args_str)

        if len(args) == 0:
            continue

        elif len(args) == 1:
            new_call = f'logger.{logger_method}({args[0]})'

        elif len(args) == 2:
            msg = args[0]
            extra = args[1].strip()
            var_name = extra.split('.')[0].split('[')[0].strip()
            if var_name in ('error', 'err', 'e', 'ex', 'exception', 'reason', 'reasons'):
                meta_key = 'error'
            elif var_name in ('data', 'result', 'res', 'response'):
                meta_key = 'data'
            elif var_name in ('msg', 'message', 'detail'):
                meta_key = 'detail'
            else:
                meta_key = 'error'
            new_call = f'logger.{logger_method}({msg}, {{ {meta_key}: {extra} }})'

        else:
            msg = args[0]
            meta_parts = []
            for arg in args[1:]:
                var_name = arg.strip().split('.')[0].split('[')[0].strip()
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', var_name) or 'detail'
                meta_parts.append(f'{safe_name}: {arg.strip()}')
            new_call = f'logger.{logger_method}({msg}, {{ {", ".join(meta_parts)} }})'

        stats['replacements'] += 1

        # Append the part before this call
        result_parts.append(content[last_end:match.start()])
        result_parts.append(new_call)
        last_end = close_idx + 1

    if not result_parts:
        return False

    result_parts.append(content[last_end:])
    content = ''.join(result_parts)

    # Add logger import if not present
    if "from '@/lib/logger'" not in content and 'from "@/lib/logger"' not in content:
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            stripped = line.strip()
            # A complete import line starts with 'import' and ends with ';' or closing quote
            if stripped.startswith('import ') and (stripped.endswith(';') or stripped.endswith("'") or stripped.endswith('"')):
                last_import_idx = i
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, LOGGER_IMPORT)
            stats['imports_added'] += 1
            content = '\n'.join(lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    stats['files'] += 1
    return True


def main():
    files = []
    for root, dirs, filenames in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in ('__tests__', '__mocks__')]
        for fname in filenames:
            if fname.endswith(('.bak', '.bak2')):
                continue
            if '.test.' in fname or '.spec.' in fname:
                continue
            if fname == 'logger.ts':
                continue
            if not fname.endswith(('.ts', '.tsx')):
                continue
            fpath = os.path.join(root, fname)
            files.append(fpath)

    modified_count = 0
    for fpath in sorted(files):
        rel = os.path.relpath(fpath, SRC_DIR)
        if process_file(fpath):
            modified_count += 1
            print(f"  + {rel}")

    print(f"\n=== Phase 3 Summary ===")
    print(f"Files modified: {stats['files']}")
    print(f"Replacements:   {stats['replacements']}")
    print(f"Imports added:  {stats['imports_added']}")


if __name__ == '__main__':
    main()
