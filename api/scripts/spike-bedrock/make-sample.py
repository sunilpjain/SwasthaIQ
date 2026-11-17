"""DIG-23: render a SYNTHETIC lab report as a phone-photo-like PNG (slight tilt, shading, noise).

    python3 api/scripts/spike-bedrock/make-sample.py

No real patient or lab: the name, lab and values are made up. Writes sample-lab-report.png next to this file.
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

random.seed(23)
OUT = Path(__file__).with_name("sample-lab-report.png")
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

W, H = 1240, 1500
page = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(page)
f = lambda size, bold=False: ImageFont.truetype(BOLD if bold else FONT, size)  # noqa: E731

d.text((60, 50), "SAMPLE DIAGNOSTICS (SYNTHETIC TEST DOCUMENT)", font=f(34, True), fill="#123")
d.text((60, 100), "Not a real report - generated for software testing", font=f(22), fill="#a00")
d.line((60, 140, W - 60, 140), fill="#333", width=3)

rows = [
    ("Patient", "TEST PATIENT G3", "Sample ID", "SYN-0423"),
    ("Age / Sex", "47 Y / M", "Collected", "12-Nov-2026 08:40"),
    ("Referred by", "Dr. Test Doctor", "Reported", "12-Nov-2026 14:10"),
]
y = 165
for a, b, c, e in rows:
    d.text((60, y), f"{a}:", font=f(24, True), fill="#222")
    d.text((240, y), b, font=f(24), fill="#222")
    d.text((660, y), f"{c}:", font=f(24, True), fill="#222")
    d.text((820, y), e, font=f(24), fill="#222")
    y += 40

y += 25
d.text((60, y), "LIVER FUNCTION TEST (LFT)", font=f(30, True), fill="#123")
y += 55
cols = [60, 520, 700, 840, 1060]
heads = ["Test", "Result", "Flag", "Units", "Ref. range"]
d.rectangle((50, y - 8, W - 50, y + 38), fill="#e8eef3")
for x, h in zip(cols, heads):
    d.text((x, y), h, font=f(24, True), fill="#111")
y += 50
tests = [
    ("Bilirubin, Total", "1.4", "H", "mg/dL", "0.3 - 1.2"),
    ("Bilirubin, Direct", "0.4", "", "mg/dL", "0.0 - 0.3"),
    ("SGOT (AST)", "68", "H", "U/L", "5 - 40"),
    ("SGPT (ALT)", "94", "H", "U/L", "7 - 56"),
    ("Alkaline Phosphatase", "118", "", "U/L", "44 - 147"),
    ("GGT", "86", "H", "U/L", "8 - 61"),
    ("Total Protein", "7.1", "", "g/dL", "6.4 - 8.3"),
    ("Albumin", "4.0", "", "g/dL", "3.5 - 5.2"),
    ("Globulin", "3.1", "", "g/dL", "2.0 - 3.5"),
    ("A/G Ratio", "1.29", "", "", "1.0 - 2.1"),
]
for t in tests:
    for x, v in zip(cols, t):
        bold = v == "H"
        d.text((x, y), v, font=f(24, bold), fill="#b00" if bold else "#222")
    d.line((50, y + 40, W - 50, y + 40), fill="#ccc", width=1)
    y += 48

y += 30
d.text((60, y), "Impression: Mildly raised transaminases and GGT. Correlate clinically.", font=f(24), fill="#222")
d.text((60, H - 120), "-- End of report --   Page 1 of 1", font=f(22), fill="#555")

# Phone-photo look: slight tilt, uneven light, blur and noise.
photo = page.rotate(-2.2, resample=Image.BICUBIC, expand=True, fillcolor="#d9d4c7")
shade = Image.linear_gradient("L").resize(photo.size).point(lambda v: 255 - v // 6)
photo = Image.composite(photo, Image.new("RGB", photo.size, "#bdb7a8"), shade)
photo = photo.filter(ImageFilter.GaussianBlur(0.8))
px = photo.load()
for _ in range(60000):
    x, yy = random.randrange(photo.width), random.randrange(photo.height)
    r, g, b = px[x, yy]
    n = random.randint(-25, 25)
    px[x, yy] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
photo.convert("RGB").save(OUT, optimize=True)
print(OUT, photo.size)
