#!/usr/bin/env python3
"""Fix capability-library-screen.tsx — convert remaining dark theme to light."""
import re

filepath = '/home/z/my-project/src/components/screens/capability-library-screen.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Map dark zinc backgrounds to light equivalents
replacements = [
    # Dark backgrounds → light
    ('bg-zinc-900/60', 'bg-gray-50'),
    ('bg-zinc-900/80', 'bg-gray-50'),
    ('bg-zinc-900/50', 'bg-gray-50'),
    ('bg-zinc-900/40', 'bg-gray-50/80'),
    ('bg-zinc-900', 'bg-white'),
    ('bg-zinc-800/80', 'bg-gray-100'),
    ('bg-zinc-800/60', 'bg-gray-100'),
    ('bg-zinc-800/50', 'bg-gray-100/80'),
    ('bg-zinc-800/40', 'bg-gray-100/60'),
    ('bg-zinc-800/30', 'bg-gray-50'),
    ('bg-zinc-800', 'bg-gray-200'),
    ('bg-zinc-700', 'bg-gray-200'),
    
    # Dark borders → light
    ('border-zinc-800/60', 'border-gray-200'),
    ('border-zinc-800', 'border-gray-200'),
    ('border-zinc-700/40', 'border-gray-200/60'),
    ('border-zinc-700', 'border-gray-300'),
    ('border-zinc-600', 'border-gray-300'),
    
    # Dark text → light-readable text
    ('text-zinc-200', 'text-gray-900'),
    ('text-zinc-300', 'text-gray-700'),
    ('text-zinc-400', 'text-gray-500'),
    ('text-zinc-500', 'text-gray-400'),
    ('text-zinc-600', 'text-gray-500'),
    
    # Dark hover states → light
    ('hover:text-zinc-200', 'hover:text-gray-900'),
    ('hover:bg-zinc-800', 'hover:bg-gray-100'),
    ('hover:bg-zinc-800/30', 'hover:bg-gray-50'),
    ('hover:border-amber-500/20', 'hover:border-amber-500/40'),
    
    # Dark separators → light
    ('bg-zinc-800', 'bg-gray-200'),
    
    # Dark input styles → light
    ('placeholder:text-zinc-500', 'placeholder:text-gray-400'),
    ('focus-visible:ring-amber-500/30', 'focus-visible:ring-amber-500/20'),
    ('focus-visible:border-amber-500/40', 'focus-visible:border-amber-500/30'),
    
    # Dark badge
    ('bg-zinc-700 text-zinc-400 border-zinc-600', 'bg-gray-100 text-gray-500 border-gray-200'),
    
    # Dark dialog
    ('bg-zinc-900 border-zinc-800', 'bg-white border-gray-200'),
    
    # Dark snippet index badges
    ('text-[9px] text-zinc-500 bg-zinc-800', 'text-[9px] text-gray-500 bg-gray-100'),
    ('text-[10px] text-zinc-400 bg-zinc-800', 'text-[10px] text-gray-500 bg-gray-100'),
    
    # Dark content area  
    ('text-sm text-zinc-600 leading-relaxed bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50',
     'text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-200'),
    
    # Dark document card icon bg
    ('size-20 rounded-2xl bg-zinc-800/50', 'size-20 rounded-2xl bg-amber-50'),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(filepath, 'w') as f:
    f.write(content)

print(f"Fixed {filepath}")
# Count changes