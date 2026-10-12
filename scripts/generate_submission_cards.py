"""Three 4K editorial cards built from saved Lognac evidence and UI captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'social'
W, H = 3840, 2160
BG, WHITE, INK = '#FAFAF7', '#FFFFFF', '#14201D'
GREEN, PALE, GREY, RULE = '#087D69', '#DDF4EC', '#53645E', '#D8E2DB'
RED, ROSE, BLUE, AMBER = '#B4433C', '#FCE9E5', '#315E9A', '#FFF0D1'
FONTS = Path('C:/Windows/Fonts')

def f(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('seguibl.ttf' if bold else 'segoeui.ttf')), size)

def canvas():
    im = Image.new('RGB', (W, H), BG)
    return im, ImageDraw.Draw(im)

def txt(d, x, y, s, size, color=INK, bold=False):
    d.text((x, y), s, fill=color, font=f(size, bold))

def box(d, bounds, fill=WHITE, radius=28, outline=INK, width=4):
    d.rounded_rectangle(bounds, radius=radius, fill=fill, outline=outline, width=width)

def line(d, x1, y1, x2, y2, color=RULE, width=4):
    d.line((x1,y1,x2,y2), fill=color, width=width)

def brand(d, number, section):
    box(d, (130,105,242,217), PALE, 24, GREEN, 4)
    d.ellipse((176,151,196,171), fill=GREEN)
    for dx,dy in ((0,-35),(25,-25),(35,0),(25,25),(0,35),(-25,25),(-35,0),(-25,-25)):
        line(d,186,161,186+dx,161+dy,GREEN,7)
    txt(d, 280, 106, 'lognac.', 79, INK, True)
    txt(d, 3260, 125, f'{number} / 03', 38, GREY, True)
    txt(d, 130, 226, section.upper(), 37, GREEN, True)

def foot(d, note):
    line(d,130,2043,3710,2043,INK,3)
    txt(d,130,2070,note,29,GREY)
    txt(d,3290,2070,'#neatHack',31,GREEN,True)

def pill(d, x,y,label,w,fill=WHITE,color=INK):
    box(d,(x,y,x+w,y+70),fill,35,color,3)
    b=d.textbbox((0,0),label,font=f(31,True))
    txt(d,x+(w-(b[2]-b[0]))//2,y+13,label,31,color,True)

def shot(im,d,bounds,source,label,crop=None):
    x,y,w,h=bounds
    box(d,(x+18,y+18,x+w+18,y+h+18),INK,29,INK,4)
    box(d,(x,y,x+w,y+h),WHITE,29,INK,4)
    d.rectangle((x+4,y+66,x+w-4,y+84), fill='#EEF0EB')
    for i,c in enumerate(('#EF7D70','#EFC653','#74CFA5')):
        d.ellipse((x+27+i*34,y+25,x+48+i*34,y+46),fill=c,outline=INK,width=2)
    txt(d,x+160,y+15,label,31,GREY)
    src=Image.open(source).convert('RGB')
    if crop: src=src.crop(crop)
    image=ImageOps.fit(src,(w-10,h-90),method=Image.Resampling.LANCZOS,centering=(0.5,0))
    im.paste(image,(x+5,y+85))

# 1. The user-facing problem and a second real run.
im,d=canvas(); brand(d,'01','The problem')
txt(d,130,335,'Discharge changes medicines.',116,INK,True)
txt(d,130,475,'Lognac checks what changed.',116,GREEN,True)
txt(d,135,660,'Home list  →  hospital orders  →  discharge draft  →  patient instructions',50,GREY)
box(d,(130,810,1420,1915),WHITE,37,INK,5)
txt(d,190,855,'What gets missed',62,INK,True)
rows=[
    ('01','A dose conflicts','5 mg order; 10 mg instruction.'),
    ('02','An allergy is overlooked','Amoxicillin against a recorded allergy.'),
    ('03','Supply ends too early','7 days supplied; review in 14 days.'),
    ('04','A home medicine vanishes','Second case: metformin omitted at discharge.'),
    ('05','A reported batch is flagged','Curated WHO notice prompts pack review.')
]
for i,(n,title,detail) in enumerate(rows):
    y=950+i*178
    d.ellipse((192,y,267,y+75),fill=PALE,outline=GREEN,width=4)
    txt(d,207,y+13,n,37,GREEN,True)
    txt(d,290,y-4,title,47,INK,True)
    txt(d,292,y+65,detail,34,GREY)
    if i<4: line(d,190,y+150,1350,y+150,RULE,3)
shot(im,d,(1530,790,2175,770),OUT/'ui-written-report.png','Actual Lognac UI  /  written review',(0,0,1462,850))
shot(im,d,(1840,1438,1865,445),OUT/'ui-graph.png','Actual Lognac UI  /  optional evidence graph',(0,300,2900,880))
box(d,(1530,1900,3705,1990),PALE,23,GREEN,4)
txt(d,1570,1916,'CASE 02  ·  3 findings → 3 decisions  ·  0 unresolved checks',42,INK,True)
foot(d,'Synthetic UK records • Clinician decision simulated • No real patient care claim')
im.save(OUT/'01-lognac-problem.png',optimize=True)

# 2. Actual cfo.ai screenshot + exact Entire graph facts.
im,d=canvas(); brand(d,'02','How the partner tools shaped the project')
txt(d,130,335,'A business case and a safer code change.',112,INK,True)
txt(d,135,500,'cfo.ai modelled the plan. Entire mapped the code affected by the fix.',50,GREY)
box(d,(130,645,1830,1985),WHITE,36,INK,5)
txt(d,192,687,'cfo.ai  /  business plan',63,INK,True)
txt(d,194,775,'Three hypothetical cases; 12-month cash view.',39,GREY)
shot(im,d,(190,855,1570,485),ROOT/'docs/evidence/cfo-ai-lognac-plan.png','Saved cfo.ai plan  /  actual app capture',(570,180,1900,820))
txt(d,200,1380,'12-month cash  /  redrawn from saved assumptions',38,INK,True)
for x,name,color in ((205,'Low',BLUE),(455,'Base',GREEN),(735,'High','#D27D29')):
    line(d,x,1452,x+62,1452,color,8)
    txt(d,x+77,1423,name,29,color,True)
line(d,270,1810,1605,1810,RULE,4)
line(d,270,1495,270,1810,RULE,4)
txt(d,164,1483,'£150k',24,GREY)
txt(d,178,1780,'£50k',24,GREY)
for i in range(5):
    x=270+i*333
    txt(d,x-20,1820,str(i*3),28,GREY)
txt(d,1400,1860,'months',27,GREY)
for name,burn,color in (('Low',7080,BLUE),('Base',7680,GREEN),('High',6480,'#D27D29')):
    pts=[]
    for month in range(13):
        cash=150000-burn*month
        pts.append((270+month*111,1495+round((150000-cash)*315/100000)))
    d.line(pts,fill=color,width=8,joint='curve')
txt(d,205,1905,'Sep 2027: Low £65,040  ·  Base £57,840  ·  High £72,240',29,GREY)

box(d,(1945,645,3710,1985),WHITE,36,INK,5)
txt(d,2010,687,'Entire  /  code impact',63,INK,True)
txt(d,2010,775,'Graph query: runReview in src/agent.js',39,GREY)
box(d,(2425,925,3180,1060),PALE,26,GREEN,5)
txt(d,2480,947,'runReview()',64,INK,True)
for y,label in ((1170,'Browser server handler'),(1315,'Terminal demo'),(1460,'HTTP trace demo'),(1605,'Focused tests')):
    box(d,(2050,y,2805,y+103),WHITE,20,RULE,3)
    txt(d,2090,y+19,label,37,INK,True)
    line(d,2806,y+52,2940,1060,GREEN,4)
txt(d,2920,1205,'4 callees',45,GREEN,True)
txt(d,2920,1270,'2 data flows',45,GREEN,True)
txt(d,2920,1355,'Affected entry points',32,GREY)
txt(d,2920,1402,'were inspected before',32,GREY)
txt(d,2920,1449,'the planner fix.',32,GREY)
pill(d,2050,1770,'11 tests passed for that fix',700,PALE,GREEN)
foot(d,'cfo.ai values are hypothetical • Entire result is repository graph output, not clinical evidence')
im.save(OUT/'02-partner-tools.png',optimize=True)

# 3. Actual owner-provided Neatlogs UI capture with clearly separated annotations.
im,d=canvas(); brand(d,'03','Neatlogs and incident recovery')
txt(d,130,335,'A safety check failed. The trace showed where.',106,INK,True)
txt(d,134,490,'Actual Lognac trace: failed tool span, immediate retry, then review continued.',50,GREY)
shot(im,d,(130,635,2245,1280),ROOT/'docs'/'evidence'/'neatlogs-recovery-trace.png',
     'Neatlogs / Lognac recovery trace',crop=(535,265,1515,845))
box(d,(2480,635,3710,1028),WHITE,30,RED,5)
txt(d,2530,675,'01 / FAILED STEP',35,RED,True)
txt(d,2530,740,'checkAlerts',64,INK,True)
txt(d,2530,835,'Injected timeout appears as a',37,GREY)
txt(d,2530,887,'red ERROR tool span.',37,GREY)
box(d,(2480,1060,3710,1450),WHITE,30,GREEN,5)
txt(d,2530,1100,'02 / APPLICATION RECOVERY',35,GREEN,True)
txt(d,2530,1165,'checkAlerts_retry',58,INK,True)
txt(d,2530,1260,'The controller reran the required',37,GREY)
txt(d,2530,1312,'check before finalising the report.',37,GREY)
box(d,(2480,1480,3710,1915),PALE,30,GREEN,5)
txt(d,2530,1520,'03 / VERIFIED RESULT',35,GREEN,True)
txt(d,2530,1585,'Recovery trace: error',50,RED,True)
txt(d,2530,1665,'18 spans · 3 model · 4 tool',37,INK)
txt(d,2530,1740,'Clean control: success',50,GREEN,True)
txt(d,2530,1820,'17 spans · 3 model · 3 tool',37,INK)
foot(d,'Actual Neatlogs trace crop • Hosted error preserves the failed span • Retry was performed by Lognac')
im.save(OUT/'03-neatlogs-incident.png',optimize=True)
print('\n'.join(str(OUT/name) for name in ('01-lognac-problem.png','02-partner-tools.png','03-neatlogs-incident.png')))
