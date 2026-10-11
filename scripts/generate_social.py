"""Render a warm-white Lognac launch card from real demo screenshots."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs' / 'social'
OUT = ASSETS / 'lognac-neathack.png'
W, H = 2400, 1350
PAPER, WHITE, INK = '#F7F6F1', '#FFFFFF', '#121C1B'
FOREST, MINT, SUBTLE, LINE = '#087C68', '#BCEFE1', '#5E6965', '#D5D9D1'
FONTS = Path(r'C:\Windows\Fonts')

def font(size, heavy=False):
    return ImageFont.truetype(str(FONTS / ('seguibl.ttf' if heavy else 'segoeui.ttf')), size)

def put(x, y, value, size, color=INK, heavy=False):
    d.text((x, y), value, font=font(size, heavy), fill=color)

def box(coords, fill=WHITE, radius=22, outline=INK, width=3):
    d.rounded_rectangle(coords, radius=radius, fill=fill, outline=outline, width=width)

def chip(x, y, value, width, dark=False):
    box((x, y, x+width, y+55), fill=INK if dark else WHITE, radius=28)
    bb = d.textbbox((0, 0), value, font=font(24, True))
    put(x+(width-(bb[2]-bb[0]))//2, y+9, value, 24, WHITE if dark else INK, True)

def browser(x, y, width, height, screenshot, url, crop=None):
    d.rounded_rectangle((x+13,y+13,x+width+13,y+height+13), radius=24, fill=INK)
    box((x,y,x+width,y+height), radius=22, width=4)
    d.rounded_rectangle((x+3,y+3,x+width-3,y+60), radius=19, fill=PAPER)
    d.rectangle((x+3,y+42,x+width-3,y+60), fill=PAPER)
    d.line((x+2,y+60,x+width-2,y+60), fill=INK, width=3)
    for i,c in enumerate(('#F48A77','#F8C95A','#72D3A8')):
        d.ellipse((x+25+25*i,y+24,x+39+25*i,y+38), fill=c, outline=INK, width=2)
    box((x+116,y+11,x+min(width-22,590),y+49), fill=WHITE, radius=19, outline=LINE, width=2)
    put(x+137,y+17,url,18,SUBTLE)
    shot = Image.open(ASSETS/screenshot).convert('RGB')
    if crop: shot = shot.crop(crop)
    shot = ImageOps.fit(shot,(width-8,height-65),method=Image.Resampling.LANCZOS,centering=(0.5,0))
    im.paste(shot,(x+4,y+62))
    d.line((x+3,y+height-2,x+width-3,y+height-2),fill=INK,width=4)

im = Image.new('RGB',(W,H),PAPER)
d = ImageDraw.Draw(im)
box((94,72,163,141),fill=MINT,radius=18)
for dx,dy in ((0,-22),(16,-16),(22,0),(16,16),(0,22),(-16,16),(-22,0),(-16,-16)):
    d.line((128,106,128+dx,106+dy),fill=FOREST,width=5)
d.ellipse((123,101,133,111),fill=FOREST)
put(182,75,'lognac.',47,INK,True)
put(96,190,'Medication changes',86,INK,True)
put(96,284,'need a paper trail.',86,FOREST,True)
put(99,412,'An agent checks the discharge handoff for a fictional UK',31,SUBTLE)
put(99,456,'patient. Every finding carries its source; a simulated clinician',31,SUBTLE)
put(99,500,'records each decision before a written report is finalized.',31,SUBTLE)
chip(97,602,'Written report first',260,True)
chip(370,602,'Graph on demand',263)
chip(646,602,'Synthetic UK demo',259)

box((96,705,997,1055),radius=30,width=4)
put(128,732,'How Lognac works',38,INK,True)
steps = [
    (1,129,804,'Read the records','History, orders, instructions.'),
    (2,553,804,'Find the gaps','Dose, allergy, batch, supply.'),
    (3,129,924,'Record a decision','Clinician review is required.'),
    (4,553,924,'Check the result','Written report + timed follow-up.'),
]
for n,x,y,title,detail in steps:
    d.ellipse((x,y,x+47,y+47),fill=MINT,outline=INK,width=3)
    put(x+15,y+3,str(n),26,INK,True)
    put(x+62,y-2,title,27,INK,True)
    put(x+62,y+39,detail,21,SUBTLE)

put(100,1094,'BUSINESS-PLAN SCENARIOS',20,FOREST,True)
put(100,1125,'12-month ending cash',28,INK,True)
for i,(label,cash,color) in enumerate([('Low',65040,'#87BDB3'),('Base',57840,FOREST),('High',72240,INK)]):
    y=1169+i*48
    put(103,y-5,label,23,INK,True)
    d.rounded_rectangle((220,y,655,y+23),radius=11,fill='#E3E7E0')
    d.rounded_rectangle((220,y,220+round(435*cash/80000),y+23),radius=11,fill=color)
    put(682,y-7,f'£{cash:,.0f}',23,INK,True)
put(101,1312,'Hypothetical site counts and prices · cfo.ai plan',18,SUBTLE)

browser(1320,67,980,650,'ui-review.png','local Lognac demo / medication comparison')
browser(1080,370,1165,665,'ui-graph.png','local Lognac demo / evidence graph')
browser(1685,781,640,425,'ui-written-report.png','local Lognac demo / written report',crop=(265,100,1030,780))
box((1100,1160,1635,1233),fill=INK,radius=20)
put(1126,1174,'4 findings  →  4 decisions',31,WHITE,True)
put(1129,1258,'Fictional case · simulated clinician · no clinical deployment',20,SUBTLE)
im.save(OUT,optimize=True)
print(OUT)
