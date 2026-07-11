# Task 6-a: Mobile & Dark Mode Agent

## Files Modified
1. `src/app/globals.css` — Added ~200 lines of dark mode CSS overrides
2. `src/components/screens/settings-screen.tsx` — Wired theme selector to next-themes
3. `src/app/layout.tsx` — Changed `enableSystem={false}` to `enableSystem={true}`
4. `src/components/app-shell.tsx` — Added Sun/Moon theme toggle button in header

## Key Decisions
- Used CSS-level `!important` overrides as an intermediate approach since components use hardcoded Tailwind classes without `dark:` variants
- The `@custom-variant dark (&:is(.dark *))` was already declared in globals.css, so the `.dark` class from next-themes `attribute="class"` works correctly
- oklch color space used for consistency with the existing light mode variables
- Theme toggle in header provides quick access; Settings > Appearance provides Light/Dark/System with visual preview cards

## Notes for Future Agents
- To properly support dark mode, components should be refactored to use `dark:` Tailwind variants instead of relying on CSS `!important` overrides
- The `.dark .bg-white` selector with `!important` is a broad hammer — some specific elements may need exceptions
- The notification panel's white ring around the amber dot is overridden to dark background color