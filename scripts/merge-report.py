#!/usr/bin/env python3
"""Merge cover + body into final PDF."""

from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize(page, target_w=A4_W, target_h=A4_H):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - target_w) > 0.5 or abs(h - target_h) > 0.5:
        page.scale_to(target_w, target_h)
    return page

cover_pdf = '/home/z/my-project/scripts/phase7-cover.pdf'
body_pdf = '/home/z/my-project/download/Phase7_Stabilisation_Evidence_Report.pdf'
output_pdf = '/home/z/my-project/download/Phase7_Stabilisation_Evidence_Report.pdf'

writer = PdfWriter()
writer.add_page(normalize(PdfReader(cover_pdf).pages[0]))
for page in PdfReader(body_pdf).pages:
    writer.add_page(normalize(page))

writer.add_metadata({
    '/Title': 'Phase 7 Stabilisation Evidence Report - DeepMindQ',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Platform readiness assessment after Phase 7 stabilisation sprint',
})

with open(output_pdf, 'wb') as f:
    writer.write(f)

print(f'Final PDF: {output_pdf}')
import os
size = os.path.getsize(output_pdf)
print(f'Size: {size/1024:.1f} KB')

reader = PdfReader(output_pdf)
print(f'Pages: {len(reader.pages)}')