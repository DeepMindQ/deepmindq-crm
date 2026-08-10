#!/usr/bin/env python3
"""
Extended touch target coverage - Phase 2.
Fixes ALL remaining undersized touch targets in screen files.

Replaces:
  h-6/h-7/h-8/h-9 -> h-10 on interactive elements (Button, button, input, Input, select, Select)
  py-1/py-1.5/py-2  -> py-2.5 on interactive elements
  w-7/w-8/w-9      -> w-10 on standalone interactive icon buttons

Only modifies elements that ARE interactive, skipping decorative elements.
"""

import re
import os
import sys
import glob

SCREENS_DIR = '/home/z/my-project/src/components/screens'
CONTEXT_LINES = 3  # lines before/after to check for interactive context

# Tag names that are inherently interactive (user can click/tap)
INTERACTIVE_TAGS = {
    'button', 'Button', 'select', 'Select', 'input', 'Input', 'textarea', 'Textarea',
    'Trigger', 'MenuItem', 'a', 'motion.button',
}

# Patterns that indicate interactivity on the SAME LINE
SAME_LINE_INTERACTIVE = re.compile(
    r'\bonClick\b|\bcursor-pointer\b|role="button"|\btabindex\b|'
    r'type="submit"|type="button"|'
    r'<button[\s>]|<Button[\s>]|<select[\s>]|<Select[\s>]|<input[\s>]|<Input[\s>]|'
    r'<textarea[\s>]|<Textarea[\s>]|<Trigger[\s>]|<MenuItem[\s>]|<a[\s>]+|'
    r'hover:bg-|hover:text-|active:bg-|active:scale-|'
    r'focus:border-|focus:ring-|focus:outline-|focus-visible:',
    re.IGNORECASE
)

# Patterns that indicate interactivity in nearby CONTEXT lines
CONTEXT_INTERACTIVE = re.compile(
    r'\bonClick\b|\bcursor-pointer\b|role="button"|\btabindex\b|'
    r'<button[\s]|<Button[\s]|<select[\s]|<Select[\s]|<input[\s]|<Input[\s]|'
    r'<textarea[\s]|<Textarea[\s]|<Trigger[\s]|<MenuItem[\s]|'
    r'motion\.button',
    re.IGNORECASE
)

# Patterns that indicate a line is DECORATIVE (always skip)
DECORATIVE_PATTERNS = re.compile(
    r'<Skeleton| Skeleton |'
    r'overflow-y-auto|overflow-hidden|'
    r'w-px h-|h-6 w-px',
    re.IGNORECASE
)

# Detect lucide/heroicon icon components
ICON_TAG_RE = re.compile(r'<([A-Z][a-zA-Z0-9]+)\s')

# Known icon component names (common lucide icons)
KNOWN_ICONS = {
    'Activity', 'AlertCircle', 'AlertTriangle', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowUpDown', 'Atom', 'Ban', 'BarChart3', 'Bell', 'Bookmark',
    'Brain', 'BrainCircuit', 'Building2', 'Calendar', 'Camera', 'Check', 'CheckCircle',
    'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronsUpDown',
    'Circle', 'CircleAlert', 'CircleCheck', 'CircleDashed', 'CircleSlash', 'CircleX',
    'Clipboard', 'Clock', 'Code', 'Copy', 'Crosshair', 'Cpu', 'Database',
    'Diamond', 'Dna', 'DollarSign', 'Dot', 'Download', 'Edit', 'Edit2', 'Edit3',
    'Eye', 'EyeOff', 'ExternalLink', 'File', 'FileText', 'Filter', 'Flag', 'Flame',
    'FlaskConical', 'Gem', 'Github', 'Globe', 'Grip', 'GripVertical', 'Hash',
    'Heart', 'HeartPulse', 'Home', 'Hourglass', 'Image', 'Info', 'Key', 'KeyRound',
    'Laptop', 'LayoutGrid', 'Lightbulb', 'LineChart', 'Link', 'Linkedin', 'List',
    'Lock', 'LockKeyhole', 'Loader2', 'LogOut', 'Mail', 'Map', 'MapPin', 'MathOperations',
    'Maximize', 'Megaphone', 'Menu', 'MessageSquare', 'Mic', 'Microscope',
    'MindMap', 'Minus', 'Monitor', 'Moon', 'MoreHorizontal', 'MoreVertical',
    'MousePointer', 'Move', 'Navigation', 'Network', 'Octagon', 'Package', 'Palette',
    'Paperclip', 'Pause', 'Pencil', 'Phone', 'PieChart', 'Pin', 'Play', 'Plus',
    'Presentation', 'Printer', 'Puzzle', 'QrCode', 'Radar', 'Radio', 'Redo',
    'RefreshCw', 'Rewind', 'Rocket', 'RotateCcw', 'RotateCw', 'Ruler', 'Save',
    'Scan', 'ScanFace', 'Scale', 'Search', 'Send', 'SeparatorHorizontal',
    'Settings', 'Share', 'Share2', 'Shield', 'ShieldAlert', 'ShieldCheck',
    'ShieldMinus', 'ShieldPlus', 'ShoppingCart', 'Sidebar', 'SignpostBig',
    'Signal', 'Sigma', 'Sliders', 'Smartphone', 'Sparkles', 'Split', 'Square',
    'Star', 'Stethoscope', 'Sun', 'Syringe', 'Table', 'Tag', 'Target', 'TestTube',
    'TestTubes', 'Text', 'Thermometer', 'Timer', 'TimerReset', 'ToggleLeft',
    'ToggleRight', 'Tool', 'TriangleAlert', 'Truck', 'Undo', 'UnfoldVertical',
    'Unlink', 'Unlock', 'Unplug', 'Upload', 'UploadCloud', 'User', 'UserCheck',
    'Users', 'UserPlus', 'UserX', 'Video', 'Vibrate', 'Volume', 'Wand2', 'Waypoints',
    'Webhook', 'WholeWord', 'Wifi', 'WrapText', 'Wrench', 'X', 'XCircle', 'Zap',
    'ZoomIn', 'ZoomOut', 'BadgeCheck', 'BadgeDollarSign', 'BadgeInfo',
    'BadgeMinus', 'BadgePlus', 'Bot', 'Hand', 'Languages', 'Proportions',
    'Satellite', 'Swords', 'TreePine', 'Trophy', 'Workflow',
}


def get_tag_on_line(line):
    """Get the JSX tag name at the start of the line (if any)."""
    m = re.match(r'^\s*<(motion\.)?([A-Za-z][A-Za-z0-9]*)', line)
    if m:
        return m.group(2)
    return None


def get_tag_from_context(lines, idx):
    """Look backwards from idx to find the opening tag."""
    for i in range(idx, max(idx - 12, -1), -1):
        line = lines[i]
        m = re.match(r'^\s*<(motion\.)?([A-Za-z][A-Za-z0-9]*)\b', line)
        if m:
            tag = m.group(2)
            # Skip closing tags
            if tag.startswith('/'):
                continue
            return tag
        # Stop if we hit a closing bracket (previous element ended)
        # But allow className lines (they're part of the same element)
        if re.search(r'/>\s*$', line) and 'className=' not in line:
            break
    return None


def is_icon_line(line):
    """Check if a line is an icon component (lucide/heroicon)."""
    m = ICON_TAG_RE.match(line.strip())
    if m:
        tag = m.group(1)
        if tag in KNOWN_ICONS:
            return True
    return False


def is_decorative_line(line):
    """Check if a line contains known decorative patterns."""
    if DECORATIVE_PATTERNS.search(line):
        return True
    if is_icon_line(line):
        return True
    return False


def has_interactive_context(lines, idx):
    """Check if surrounding lines have interactive indicators."""
    start = max(0, idx - CONTEXT_LINES)
    end = min(len(lines), idx + CONTEXT_LINES + 1)
    for i in range(start, end):
        if i == idx:
            continue
        if CONTEXT_INTERACTIVE.search(lines[i]):
            return True
    return False


def is_interactive_element(lines, idx):
    """
    Determine if the element at lines[idx] is itself interactive.
    Returns True only if the element the user taps on is undersized.
    """
    line = lines[idx]
    
    # Skip decorative lines immediately
    if is_decorative_line(line):
        return False
    
    # Check if this line IS an interactive element
    # Case 1: The line starts an interactive tag
    tag = get_tag_on_line(line)
    if tag and tag in INTERACTIVE_TAGS:
        return True
    
    # Case 2: The line has onClick, cursor-pointer, role="button", tabindex
    if re.search(r'\bonClick\b|\bcursor-pointer\b|role="button"|\btabindex\b', line):
        return True
    
    # Case 3: className on a continuation line (no < on this line)
    if 'className=' in line and '<' not in line:
        # Look backward for the opening tag
        opening_tag = get_tag_from_context(lines, idx)
        if opening_tag and opening_tag in INTERACTIVE_TAGS:
            return True
        # Also check if the context has onClick on the tag-opening lines
        if has_interactive_context(lines, idx):
            return True

    # Case 3b: String continuation inside className={cn(...)} or className="..."
    # Detects lines like: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md...'
    if '<' not in line and ('className=' in '\n'.join(lines[max(0,idx-3):idx]) or 'className=' in '\n'.join(lines[max(0,idx-6):idx])):
        if re.search(r'flex|items-center|rounded|px-|gap-', line):
            if has_interactive_context(lines, idx):
                return True
    
    # Case 4: The line has hover/active/focus AND context has onClick
    if re.search(r'hover:bg-|hover:text-|active:bg-|active:scale-', line):
        if has_interactive_context(lines, idx):
            return True
    
    # Case 5: Same-line input/select/textarea tags
    if re.search(r'<input[\s>]|<Input[\s>]|<select[\s>]|<Select[\s>]|<textarea[\s>]|<Textarea[\s>]', line, re.IGNORECASE):
        return True
    
    # Case 6: className continuation line for Input (look back for <Input specifically)
    if 'className=' in line and '<' not in line:
        for i in range(idx - 1, max(idx - 8, -1), -1):
            if re.search(r'<input\s|<Input\s|<select\s|<Select\s|<textarea\s|<Textarea\s', lines[i]):
                return True
            if re.search(r'/>\s*$', lines[i]) and 'className=' not in lines[i]:
                break
    
    return False


def fix_height_classes(line, is_interactive):
    """Replace h-6/h-7/h-8/h-9 with h-10 on interactive elements."""
    if not is_interactive:
        return line, False
    
    changed = False
    for h in ['h-6', 'h-7', 'h-8', 'h-9']:
        pattern = r'\b' + h + r'\b'
        if re.search(pattern, line):
            line = re.sub(pattern, 'h-10', line)
            changed = True
    return line, changed


def fix_padding_classes(line, is_interactive):
    """Replace py-1/py-1.5 with py-2.5 on interactive elements."""
    if not is_interactive:
        return line, False
    
    changed = False
    if re.search(r'\bpy-1\.5\b', line):
        line = re.sub(r'\bpy-1\.5\b', 'py-2.5', line)
        changed = True
    if re.search(r'\bpy-1\b', line):
        line = re.sub(r'\bpy-1\b', 'py-2.5', line)
        changed = True
    return line, changed


def fix_width_classes(line, is_interactive):
    """
    Replace w-7/w-8/w-9 with w-10 on interactive elements.
    Only for standalone icon buttons (element has both w-X and h-X).
    """
    if not is_interactive:
        return line, False
    
    has_h = bool(re.search(r'\bh-[6-9]\b', line))
    
    if has_h:
        changed = False
        for w in ['w-7', 'w-8', 'w-9']:
            pattern = r'\b' + w + r'\b'
            if re.search(pattern, line):
                line = re.sub(pattern, 'w-10', line)
                changed = True
        return line, changed
    
    return line, False


def process_file(filepath):
    """Process a single file and return (changes, details)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    new_lines = []
    total_changes = 0
    details = []
    
    for idx, line in enumerate(lines):
        new_line = line
        line_changes = 0
        
        has_h_small = bool(re.search(r'\bh-[6-9]\b', line))
        has_py_small = bool(re.search(r'\bpy-1(\b|\.5\b)', line))
        has_w_small = bool(re.search(r'\bw-[7-9]\b', line))
        
        if has_h_small or has_py_small or has_w_small:
            interactive = is_interactive_element(lines, idx)
            
            if has_h_small:
                new_line, changed = fix_height_classes(new_line, interactive)
                if changed:
                    line_changes += 1
            
            if has_py_small:
                new_line, changed = fix_padding_classes(new_line, interactive)
                if changed:
                    line_changes += 1
            
            if has_w_small:
                new_line, changed = fix_width_classes(new_line, interactive)
                if changed:
                    line_changes += 1
            
            if line_changes > 0:
                total_changes += line_changes
                lineno = idx + 1
                details.append(f"  L{lineno}: {'INTERACTIVE' if interactive else 'SKIP'}")
        
        new_lines.append(new_line)
    
    if total_changes > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
    
    return total_changes, details


def count_remaining():
    """Count remaining undersized patterns across all screen files."""
    files = sorted(glob.glob(os.path.join(SCREENS_DIR, '*-screen.tsx')))
    counts = {'h-6': 0, 'h-7': 0, 'h-8': 0, 'h-9': 0, 'py-1': 0, 'py-1.5': 0, 'w-7': 0, 'w-8': 0, 'w-9': 0}
    
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for line in lines:
            for key in counts:
                if key == 'py-1.5':
                    if re.search(r'\bpy-1\.5\b', line):
                        counts[key] += 1
                elif key == 'py-1':
                    if re.search(r'\bpy-1\b', line) and not re.search(r'\bpy-1[0-9.]', line):
                        counts[key] += 1
                else:
                    if re.search(r'\b' + key + r'\b', line):
                        counts[key] += 1
    
    return counts


def main():
    screen_files = sorted(glob.glob(os.path.join(SCREENS_DIR, '*-screen.tsx')))
    extra_files = sorted(glob.glob(os.path.join(SCREENS_DIR, '*-modal.tsx')) +
                        glob.glob(os.path.join(SCREENS_DIR, '*-panel.tsx')))
    all_files = screen_files + extra_files
    
    print(f'=== Touch Target Coverage - Phase 2 (pass 2) ===\n')
    print(f'Scanning {len(all_files)} files ({len(screen_files)} screens, {len(extra_files)} modals/panels)\n')
    
    # Before counts
    print('--- BEFORE counts ---')
    before = count_remaining()
    for k, v in before.items():
        print(f'  {k}: {v}')
    print(f'  TOTAL: {sum(before.values())}\n')
    
    # Process files
    print('--- Processing files ---')
    total_changes = 0
    modified_files = []
    
    for filepath in all_files:
        filename = os.path.basename(filepath)
        changes, details = process_file(filepath)
        if changes > 0:
            total_changes += changes
            modified_files.append((filename, changes))
            print(f'  \u2713 {filename}: {changes} fix(es)')
            for d in details:
                print(f'    {d}')
    
    print(f'\nTotal fixes applied: {total_changes} across {len(modified_files)} files\n')
    
    # After counts
    print('--- AFTER counts ---')
    after = count_remaining()
    for k, v in after.items():
        diff = v - before[k]
        arrow = '\u2193' if diff < 0 else ('\u2191' if diff > 0 else '=')
        print(f'  {k}: {v} ({arrow}{abs(diff)})')
    print(f'  TOTAL: {sum(after.values())} (was {sum(before.values())})')
    print(f'  Net reduction: {sum(before.values()) - sum(after.values())} undersized instances')


if __name__ == '__main__':
    main()
