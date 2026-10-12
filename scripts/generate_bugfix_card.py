"""Render a plain-language 4K card for Lognac's verified audit-label fix."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'social' / '04-planner-mode-bugfix.png'
W, H = 3840, 2160
BG, WHITE, INK = '#FAFAF7', '#FFFFFF', '#14201D'
GREEN, PALE, GREY, RULE = '#087D69', '#DDF4EC', '#53645E', '#D8E2DB'
RED, ROSE = '#B4433C', '#FCE9E5'
FONTS = Path('C:/Windows/Fonts')

def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('seguibl.ttf' if bold else 'segoeui.ttf')), size)

def text(d, x, y, value, size, color=INK, bold=False):
    d.text((x, y), value, font=font(size, bold), fill=color)

def box(d, bounds, fill=WHITE, outline=INK, radius=30, width=4):
    d.rounded_rectangle(bounds, fill=fill, outline=outline, radius=radius, width=width)

def block(d, y, number, heading, lines, color=GREEN, fill=WHITE):
    box(d,(130,y,2050,y+365),fill,color,30,4)
    box(d,(185,y+40,280,y+135),PALE if color==GREEN else ROSE,color,47,3)
    text(d,210,y+52,number,40,color,True)
    text(d,330,y+37,heading,58,INK,True)
    for i,line in enumerate(lines):
        text(d,330,y+145+i*60,line,42,GREY)

im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)

box(d,(130,105,242,217),PALE,GREEN,24)
d.ellipse((176,151,196,171),fill=GREEN)
for dx,dy in ((0,-35),(25,-25),(35,0),(25,25),(0,35),(-25,25),(-35,0),(-25,-25)):
    d.line((186,161,186+dx,161+dy),fill=GREEN,width=7)
text(d,280,106,'lognac.',79,INK,True)
text(d,130,226,'A REAL BUG, EXPLAINED THROUGH THE PATIENT JOURNEY',35,GREEN,True)

text(d,130,335,'Going home with a new medicine list?',104,INK,True)
text(d,134,480,'In this prototype, Lognac checks what a patient is told to take home.',50,GREY)

block(d,635,'01','The review',[
    'Compare home medicines, hospital orders,',
    'take-home instructions and recorded allergies.'
])
block(d,1025,'02','The bug we found',[
    'If AI planning failed, backup checks still ran.',
    'But the audit trail still said “AI planned”.'
],RED)
block(d,1415,'03','What we fixed',[
    'The audit trail now records when backup took over.',
    'A reviewer can see which path did the checks.'
],GREEN,PALE)

# The actual product screenshot grounds the explanation. The planner-mode audit
# field is separate from the written report; its caption makes this clear.
box(d,(2200,651,3710,1840),INK,INK,28)
box(d,(2180,635,3690,1820),WHITE,INK,28)
for i,c in enumerate(('#EF7D70','#EFC653','#74CFA5')):
    d.ellipse((2210+i*34,660,2231+i*34,681),fill=c,outline=INK,width=2)
text(d,2335,649,'Actual Lognac written review',32,GREY)
src=Image.open(ROOT/'docs'/'social'/'ui-written-report.png').convert('RGB')
shot=ImageOps.fit(src,(1498,1104),method=Image.Resampling.LANCZOS,centering=(0.5,0))
im.paste(shot,(2186,708))
box(d,(2180,1850,3690,1988),PALE,GREEN,22,3)
text(d,2220,1870,'Fictional UK case · clinician decision simulated',34,GREEN,True)

d.line((130,2043,3710,2043),fill=INK,width=3)
text(d,130,2070,'Fix verified in commit 0396e38  ·  current test suite: 16/16 passing  ·  no real patient care claim',29,GREY)
text(d,3290,2070,'#neatHack',31,GREEN,True)
OUT.parent.mkdir(parents=True,exist_ok=True)
im.save(OUT,optimize=True)
print(OUT)
