"""Render a 4K evidence card for the verified planner-mode reporting fix."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'social' / '04-planner-mode-bugfix.png'
W, H = 3840, 2160
BG, WHITE, INK = '#FAFAF7', '#FFFFFF', '#14201D'
GREEN, PALE, GREY, RULE = '#087D69', '#DDF4EC', '#53645E', '#D8E2DB'
RED, ROSE = '#B4433C', '#FCE9E5'
FONTS = Path('C:/Windows/Fonts')

def font(size, bold=False, mono=False):
    name = 'consolab.ttf' if mono and bold else 'consola.ttf' if mono else 'seguibl.ttf' if bold else 'segoeui.ttf'
    return ImageFont.truetype(str(FONTS / name), size)

def text(d, x, y, value, size, color=INK, bold=False, mono=False):
    d.text((x, y), value, font=font(size, bold, mono), fill=color)

def box(d, bounds, fill=WHITE, outline=INK, radius=30, width=4):
    d.rounded_rectangle(bounds, fill=fill, outline=outline, radius=radius, width=width)

im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)

# Header uses the same quiet editorial system as the three submission cards.
box(d, (130, 105, 242, 217), PALE, GREEN, 24)
d.ellipse((176, 151, 196, 171), fill=GREEN)
for dx,dy in ((0,-35),(25,-25),(35,0),(25,25),(0,35),(-25,25),(-35,0),(-25,-25)):
    d.line((186,161,186+dx,161+dy),fill=GREEN,width=7)
text(d, 280, 106, 'lognac.', 79, INK, True)
text(d, 3260, 125, 'BUILD NOTE / 04', 38, GREY, True)
text(d, 130, 226, 'A REAL BUG AND ITS FIX', 37, GREEN, True)

text(d, 130, 335, 'The fallback worked. The audit label was wrong.', 101, INK, True)
text(d, 134, 475, 'If a planner choice failed, Lognac used the validated local tool order.', 49, GREY)
text(d, 134, 545, 'The run could still be incorrectly labelled “model-planned”.', 49, GREY)

box(d, (130, 690, 1810, 1565), WHITE, RED, 36, 5)
box(d, (185, 745, 555, 820), ROSE, RED, 34, 3)
text(d, 236, 755, 'BEFORE', 36, RED, True)
text(d, 185, 855, 'Asked the wrong question', 62, INK, True)
text(d, 185, 960, 'Was a model client configured?', 42, GREY)
box(d, (185, 1080, 1755, 1275), '#F6F7F4', RULE, 22, 3)
text(d, 235, 1102, 'caseFile.agentMode = modelClient ?', 44, INK, mono=True)
text(d, 235, 1170, "  'model-planned' : 'validated-local-planner';", 41, INK, mono=True)
text(d, 185, 1350, 'An invalid or unavailable model call', 42, RED, True)
text(d, 185, 1412, 'could still produce “model-planned”.', 42, RED, True)

d.line((1865,1128,1990,1128), fill=GREEN, width=8)
d.polygon([(1970,1104),(2012,1128),(1970,1152)], fill=GREEN)

box(d, (2030, 690, 3710, 1565), WHITE, GREEN, 36, 5)
box(d, (2085, 745, 2455, 820), PALE, GREEN, 34, 3)
text(d, 2134, 755, 'AFTER', 36, GREEN, True)
text(d, 2085, 855, 'Track every tool choice', 62, INK, True)
text(d, 2085, 960, 'Did the model select every required tool?', 42, GREY)
box(d, (2085, 1080, 3655, 1275), '#F6F7F4', RULE, 22, 3)
text(d, 2135, 1102, 'modelPlanned &&= modelSelected;', 45, INK, mono=True)
text(d, 2135, 1170, 'caseFile.agentMode = modelPlanned ? ...;', 41, INK, mono=True)
text(d, 2085, 1350, 'Any fallback is now labelled', 42, GREEN, True)
text(d, 2085, 1412, '“validated-local-planner”.', 42, GREEN, True)

box(d, (130, 1670, 3710, 1985), WHITE, INK, 30, 4)
text(d, 190, 1714, 'Verified in focused tests', 57, INK, True)
for x,label,result,color in (
    (190,'Valid model selections','model-planned',GREEN),
    (1350,'Invalid tool name','local fallback',RED),
    (2500,'Model unavailable','local fallback',RED),
):
    d.ellipse((x,1830,x+33,1863),fill=color)
    text(d,x+58,1805,label,38,GREY)
    text(d,x+58,1860,result,44,color,True)

d.line((130,2043,3710,2043), fill=INK, width=3)
text(d,130,2070,'Fix: commit 0396e38  ·  Entire mapped impact  ·  current full suite: 16/16 passing',29,GREY)
text(d,3290,2070,'#neatHack',31,GREEN,True)
OUT.parent.mkdir(parents=True,exist_ok=True)
im.save(OUT,optimize=True)
print(OUT)
