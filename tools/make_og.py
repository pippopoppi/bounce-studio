#!/usr/bin/env python3
"""Generate public/og.png (1200x630) for link previews. Run: python3 tools/make_og.py"""
from PIL import Image, ImageDraw, ImageFont
import os, math
W, H = 1200, 630
img = Image.new('RGB', (W, H), '#0f1216')
d = ImageDraw.Draw(img)
cx, cy, R = 300, 315, 230
d.ellipse((cx - R, cy - R, cx + R, cy + R), fill='#1a2129', outline='#ffffff', width=14)
balls = [('#ff4d4d', -90, -40, 46), ('#4da6ff', 60, 30, 52), ('#ffd93d', -30, 110, 40), ('#ff4d4d', 110, -120, 34), ('#4da6ff', -120, 80, 30)]
for col, dx, dy, r in balls:
    x, y = cx + dx, cy + dy
    d.ellipse((x - r, y - r, x + r, y + r), fill=col, outline='#ffffff', width=5)
    d.ellipse((x - r * 0.35 - r * 0.25, y - r * 0.2 - r * 0.12, x - r * 0.35 + r * 0.25, y - r * 0.2 + r * 0.12), fill='#1b1b1b')
    d.ellipse((x + r * 0.35 - r * 0.25, y - r * 0.2 - r * 0.12, x + r * 0.35 + r * 0.25, y - r * 0.2 + r * 0.12), fill='#1b1b1b')
    d.arc((x - r * 0.45, y - r * 0.1, x + r * 0.45, y + r * 0.55), 20, 160, fill='#1b1b1b', width=max(3, r // 9))
def font(sz, bold=True):
    for f in (['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] if bold else ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
d.text((600, 190), 'Bounce Studio', font=font(78), fill='#ffffff')
d.text((604, 290), 'Physics bouncing-ball video maker', font=font(34, False), fill='#8b98a8')
d.text((604, 350), 'Your characters · your sounds · 1080×1920', font=font(28, False), fill='#8b98a8')
d.rounded_rectangle((604, 420, 900, 482), radius=31, fill='#3fb950')
d.text((640, 434), 'Free · in your browser', font=font(26), fill='#04120a')
d.text((604, 540), 'pippopoppi.github.io/bounce-studio', font=font(26, False), fill='#58a6ff')
os.makedirs('public', exist_ok=True)
img.save('public/og.png', optimize=True)
print('public/og.png written')
