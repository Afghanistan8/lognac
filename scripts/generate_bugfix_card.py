"""Render the verified synthetic dose-change bug as a readable 4K source graph."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'social' / '04-dose-change-bugfix.png'
CASE = json.loads((ROOT / 'data' / 'third-case.json').read_text(encoding='utf8'))
home = CASE['homeMedications'][0]
hospital = CASE['hospitalOrders'][0]
order = CASE['dischargeOrders'][0]
instruction = CASE['patientInstructions'][0]
assert (home['dose'], hospital['dose'], order['dose'], instruction['dose']) == ('5 mg', '5 mg', '10 mg', '10 mg')
assert order['id'] == instruction['id'] == home['id']

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

def arrow(d, x1, y1, x2, y2, color=GREEN, width=7):
    d.line((x1,y1,x2-25,y2),fill=color,width=width)
    d.polygon([(x2-42,y2-25),(x2,y2),(x2-42,y2+25)],fill=color)

im = Image.new('RGB',(W,H),BG)
d = ImageDraw.Draw(im)

box(d,(130,105,242,217),PALE,GREEN,24)
d.ellipse((176,151,196,171),fill=GREEN)
for dx,dy in ((0,-35),(25,-25),(35,0),(25,25),(0,35),(-25,25),(-35,0),(-25,-25)):
    d.line((186,161,186+dx,161+dy),fill=GREEN,width=7)
text(d,280,106,'lognac.',79,INK,True)
text(d,130,226,'A REAL MISSED CHECK, NOW FIXED',36,GREEN,True)

text(d,130,333,'The dose changed. Lognac used to miss it.',103,INK,True)
text(d,134,476,'Both discharge drafts agreed with each other—but not with the home record.',49,GREY)

box(d,(130,615,3710,1555),WHITE,INK,35,5)
text(d,190,652,'A fictional patient’s medicine journey',54,INK,True)
text(d,190,730,'Simplified from the source-linked Lognac evidence graph',34,GREY)

nodes=[
    (195,'HOME RECORD',home,RED),
    (1080,'HOSPITAL ORDER',hospital,GREEN),
    (1965,'DISCHARGE ORDER',order,RED),
    (2850,'TAKE-HOME SHEET',instruction,GREEN),
]
for x,label,medicine,color in nodes:
    box(d,(x,840,x+795,1120),WHITE,color,27,5)
    text(d,x+35,862,label,33,color,True)
    text(d,x+35,918,f"{medicine['name']}  {medicine['dose']}",62,INK,True)
    text(d,x+35,1024,f"Source: {medicine['sourceId']}",31,GREY)
for x in (990,1875,2760):
    arrow(d,x,982,x+75,982,GREEN)

# The red source links are asserted by test/doseChange.test.js against buildGraph.
d.line((590,1120,590,1220),fill=RED,width=6)
d.line((2360,1120,2360,1220),fill=RED,width=6)
d.line((590,1220,2360,1220),fill=RED,width=6)
d.line((1475,1220,1475,1260),fill=RED,width=6)
box(d,(915,1260,2035,1475),ROSE,RED,29,5)
text(d,975,1283,'DOSE CHANGE FOUND',42,RED,True)
text(d,975,1365,f"{home['dose']} at home  →  {order['dose']} at discharge",52,INK,True)
arrow(d,2055,1365,2210,1365,GREEN)
box(d,(2210,1260,3545,1475),PALE,GREEN,29,5)
text(d,2270,1283,'REVIEW REQUIRED',42,GREEN,True)
text(d,2270,1365,'Clinician documents the decision',46,INK,True)

def outcome(x,fill,color,label,value,detail):
    box(d,(x,1645,x+1085,1925),fill,color,28,4)
    text(d,x+40,1674,label,37,color,True)
    text(d,x+40,1736,value,72,INK,True)
    text(d,x+40,1837,detail,36,GREY)

outcome(130,ROSE,RED,'BEFORE FIX','0 findings','The dose change was missed.')
outcome(1377,PALE,GREEN,'AFTER FIX','1 finding','Home + discharge records linked.')
outcome(2624,WHITE,GREEN,'AFTER REVIEW','0 open','Report passes after a decision.')

d.line((130,2043,3710,2043),fill=INK,width=3)
text(d,130,2070,'Synthetic UK case · Dose change may be intentional · 17 tests pass · Neatlogs trace 4ff034e7… success',28,GREY)
text(d,3290,2070,'#neatHack',31,GREEN,True)
OUT.parent.mkdir(parents=True,exist_ok=True)
im.save(OUT,optimize=True)
print(OUT)
