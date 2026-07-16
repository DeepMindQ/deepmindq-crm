#!/usr/bin/env python3
"""Generate OG image and favicon for DeepMindQ."""
import cairosvg
from PIL import Image, ImageDraw, ImageFont
import io, os

BG = '#0A0E1A'
GOLD = '#c9a84c'
GOLD_BRIGHT = '#e2c565'
WHITE = '#F9FAFB'
TEXT_DIM = '#6B7280'
TEXT_SUB = '#9CA3AF'

# ── OG Image (1200x630) via SVG → PNG ──
og_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0E1A"/>
      <stop offset="100%" stop-color="#0D1220"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c9a84c"/>
      <stop offset="100%" stop-color="#e2c565"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="rgba(201,168,76,0.06)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <ellipse cx="900" cy="315" rx="500" ry="350" fill="url(#glow)"/>

  <!-- Subtle grid -->
  <g stroke="rgba(255,255,255,0.02)" stroke-width="0.5">
    {''.join(f'<line x1="{x}" y1="0" x2="{x}" y2="630"/>' for x in range(0, 1201, 60))}
    {''.join(f'<line x1="0" y1="{y}" x2="1200" y2="{y}"/>' for y in range(0, 631, 60))}
  </g>

  <!-- Left accent line -->
  <rect x="100" y="200" width="3" height="230" rx="1.5" fill="url(#goldGrad)" opacity="0.6"/>

  <!-- Logo icon -->
  <rect x="100" y="180" width="40" height="40" rx="8" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.18)" stroke-width="1.5"/>
  <text x="120" y="207" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#c9a84c">✦</text>

  <!-- Brand -->
  <text x="152" y="206" font-family="system-ui, sans-serif" font-size="20" font-weight="600" fill="{WHITE}">DeepMindQ</text>

  <!-- Main headline -->
  <text x="100" y="310" font-family="system-ui, sans-serif" font-size="64" font-weight="700" fill="{WHITE}" letter-spacing="-2">Understand Before</text>
  <text x="100" y="385" font-family="system-ui, sans-serif" font-size="64" font-weight="700" fill="#c9a84c" letter-spacing="-2">You Sell.</text>

  <!-- Subtitle -->
  <text x="100" y="435" font-family="system-ui, sans-serif" font-size="18" fill="{TEXT_SUB}" letter-spacing="0.5">A personal AI workspace for enterprise growth intelligence</text>

  <!-- Bottom tag -->
  <text x="100" y="560" font-family="system-ui, sans-serif" font-size="13" fill="{TEXT_DIM}" letter-spacing="2" font-weight="500">BUILT BY RAVI SHANKER</text>

  <!-- Right side: abstract intelligence node -->
  <g transform="translate(900, 315)" opacity="0.4">
    <circle cx="0" cy="0" r="80" fill="none" stroke="rgba(201,168,76,0.1)" stroke-width="1" stroke-dasharray="4 6"/>
    <circle cx="0" cy="0" r="45" fill="none" stroke="rgba(201,168,76,0.15)" stroke-width="0.8" stroke-dasharray="3 5"/>
    <circle cx="0" cy="0" r="20" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.3)" stroke-width="1.2"/>
    <circle cx="0" cy="0" r="8" fill="#c9a84c"/>
    <!-- Orbit nodes -->
    <circle cx="65" cy="-47" r="5" fill="rgba(201,168,76,0.3)" stroke="rgba(201,168,76,0.4)" stroke-width="0.8"/>
    <circle cx="80" cy="10" r="4" fill="rgba(201,168,76,0.25)" stroke="rgba(201,168,76,0.35)" stroke-width="0.8"/>
    <circle cx="30" cy="68" r="5" fill="rgba(201,168,76,0.3)" stroke="rgba(201,168,76,0.4)" stroke-width="0.8"/>
    <circle cx="-55" cy="50" r="4" fill="rgba(201,168,76,0.25)" stroke="rgba(201,168,76,0.35)" stroke-width="0.8"/>
    <circle cx="-70" cy="-15" r="5" fill="rgba(201,168,76,0.3)" stroke="rgba(201,168,76,0.4)" stroke-width="0.8"/>
    <circle cx="-20" cy="-75" r="4" fill="rgba(201,168,76,0.25)" stroke="rgba(201,168,76,0.35)" stroke-width="0.8"/>
    <!-- Connection lines -->
    <g stroke="rgba(201,168,76,0.08)" stroke-width="0.5">
      <line x1="0" y1="0" x2="65" y2="-47"/>
      <line x1="0" y1="0" x2="80" y2="10"/>
      <line x1="0" y1="0" x2="30" y2="68"/>
      <line x1="0" y1="0" x2="-55" y2="50"/>
      <line x1="0" y1="0" x2="-70" y2="-15"/>
      <line x1="0" y1="0" x2="-20" y2="-75"/>
    </g>
  </g>
</svg>'''

pub = '/home/z/my-project/public'
og_png = os.path.join(pub, 'og-image.png')
cairosvg.svg2png(bytestring=og_svg.encode(), write_to=og_png, output_width=1200, output_height=630)
print(f'✓ OG image: {og_png} ({os.path.getsize(og_png)} bytes)')

# ── Favicon (32x32 + 16x16) ──
favicon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0A0E1A"/>
  <rect x="2" y="2" width="28" height="28" rx="5" fill="none" stroke="rgba(201,168,76,0.18)" stroke-width="1"/>
  <text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#c9a84c">D</text>
</svg>'''

favicon_png = os.path.join(pub, 'favicon.ico')
# Generate as PNG first
cairosvg.svg2png(bytestring=favicon_svg.encode(), write_to=favicon_png, output_width=32, output_height=32)

# Also create apple-touch-icon (180x180)
apple_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="36" fill="#0A0E1A"/>
  <rect x="2" y="2" width="176" height="176" rx="35" fill="none" stroke="rgba(201,168,76,0.18)" stroke-width="1.5"/>
  <text x="90" y="115" text-anchor="middle" font-family="system-ui, sans-serif" font-size="90" font-weight="700" fill="#c9a84c">D</text>
</svg>'''

apple_png = os.path.join(pub, 'apple-touch-icon.png')
cairosvg.svg2png(bytestring=apple_svg.encode(), write_to=apple_png, output_width=180, output_height=180)
print(f'✓ Favicon: {favicon_png} ({os.path.getsize(favicon_png)} bytes)')
print(f'✓ Apple touch icon: {apple_png} ({os.path.getsize(apple_png)} bytes)')