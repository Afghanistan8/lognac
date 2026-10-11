"""Render a 4K editorial Lognac card from real synthetic-demo UI captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs' / 'social'
OUT = ASSETS / 'lognac-neathack.png'
W, H = 3840, 2160
PAPER, WHITE, INK = '#FBFAF6', '#FFFFFF', '#111B19'
GREEN, MINT, GREY, RULE = '#087C68', '#BCEFE1', '#52615B', '#D8DDD6'
FONTS = Path(r'C:\Windows\Fonts')

def face(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('seguibl.ttf' if bold else 'segoeui.ttf')), size)

def write(x, y, value, size, color=INK, bold=False):
    draw.text((x, y), value, font=face(size, bold), fill=color)

def rect(bounds, fill=WHITE, radius=26, outline=INK, width=5):
    draw.rounded_rectangle(bounds, radius=radius, fill=fill, outline=outline, width=width)

def pill(x, y, value, width, inverted=False):
    rect((x,y,x+width,y+82),fill=INK if inverted else WHITE,radius=41,width=4)
    bb=draw.textbbox((0,0),value,font=face(35,True))
    write(x+(width-(bb[2]-bb[0]))//2,y+16,value,35,WHITE if inverted else INK,True)

def browser(x, y, w, h, image_name, label, crop):
    draw.rounded_rectangle((x+18,y+18,x+w+18,y+h+18),radius=30,fill=INK)
    rect((x,y,x+w,y+h),radius=30,width=5)
    draw.rounded_rectangle((x+5,y+5,x+w-5,y+78),radius=25,fill=PAPER)
    draw.rectangle((x+5,y+55,x+w-5,y+79),fill=PAPER)
    draw.line((x+3,y+79,x+w-3,y+79),fill=INK,width=4)
    for i,c in enumerate(('#F48A77','#F8C95A','#72D3A8')):
        draw.ellipse((x+32+i*32,y+30,x+51+i*32,y+49),fill=c,outline=INK,width=3)
    rect((x+150,y+14,x+min(w-40,950),y+63),fill=WHITE,radius=25,outline=RULE,width=3)
    write(x+180,y+19,label,27,GREY)
    source=Image.open(ASSETS/image_name).convert('RGB').crop(crop)
    source=ImageOps.fit(source,(w-10,h-85),method=Image.Resampling.LANCZOS,centering=(0.5,0))
    image.paste(source,(x+5,y+82))
    draw.line((x+4,y+h-3,x+w-4,y+h-3),fill=INK,width=5)

ASSETS.mkdir(parents=True,exist_ok=True)
image=Image.new('RGB',(W,H),PAPER)
draw=ImageDraw.Draw(image)

# Clear hierarchy at both full resolution and social-feed size.
rect((145,105,252,212),fill=MINT,radius=26,width=5)
for dx,dy in ((0,-34),(24,-24),(34,0),(24,24),(0,34),(-24,24),(-34,0),(-24,-24)):
    draw.line((199,159,199+dx,159+dy),fill=GREEN,width=8)
draw.ellipse((191,151,207,167),fill=GREEN)
write(282,108,'lognac.',78,INK,True)
write(145,300,'Every medicine',125,INK,True)
write(145,452,'change needs',125,INK,True)
write(145,604,'a source trail.',125,GREEN,True)
write(152,785,'Lognac checks a fictional discharge packet for dose,',44,GREY)
write(152,849,'allergy, batch and supply gaps. A simulated clinician',44,GREY)
write(152,913,'records decisions before the written report is finalized.',44,GREY)
pill(150,1034,'Written report first',424,True)
pill(595,1034,'Graph on demand',420)
pill(1035,1034,'Synthetic UK demo',420)

# Four-stage process card, with type large enough for an X image preview.
rect((145,1190,1475,1718),radius=38,width=5)
write(200,1225,'How Lognac works',58,INK,True)
steps=[
    (1,205,1340,'Read the sources','Home, hospital and discharge.'),
    (2,855,1340,'Flag the gaps','Dose, allergy, batch and supply.'),
    (3,205,1532,'Record decisions','A simulated clinician reviews each.'),
    (4,855,1532,'Verify & follow up','Report, timestamp and reminder.'),
]
for n,x,y,title,detail in steps:
    draw.ellipse((x,y,x+72,y+72),fill=MINT,outline=INK,width=4)
    write(x+24,y+10,str(n),40,INK,True)
    write(x+90,y-3,title,42,INK,True)
    write(x+90,y+65,detail,29,GREY)

# Three scenario values copied from the saved, explicitly hypothetical cfo.ai plan.
rect((145,1782,1475,2092),fill=WHITE,radius=34,width=5)
write(198,1812,'cfo.ai plan  /  hypothetical',30,GREEN,True)
write(198,1860,'12-month ending cash',47,INK,True)
for i,(name,value,color) in enumerate((('Low',65040,'#91C7BC'),('Base',57840,GREEN),('High',72240,INK))):
    y=1935+i*48
    write(201,y-12,name,32,INK,True)
    draw.rounded_rectangle((390,y,1005,y+25),radius=12,fill='#E7EBE6')
    draw.rounded_rectangle((390,y,390+round(615*value/80000),y+25),radius=12,fill=color)
    write(1055,y-14,f'£{value:,.0f}',32,INK,True)

# Real, high-DPI screenshots. The written report is the main visual.
browser(1635,92,2070,1180,'ui-written-report.png','Lognac demo  /  written clinical review',(0,0,1462,790))
browser(1565,1175,2140,820,'ui-graph.png','Lognac demo  /  evidence graph: dose discrepancy',(380,260,2280,910))
rect((1760,1370,3000,1470),fill=WHITE,radius=22,outline=GREEN,width=4)
write(1795,1386,'Amlodipine: 5 mg order  →  10 mg draft',43,INK,True)

rect((1630,2025,2920,2112),fill=INK,radius=24,width=4)
write(1672,2042,'4 findings  →  4 documented decisions',44,WHITE,True)
write(2990,2051,'FICTIONAL CASE  ·  NO CLINICAL DEPLOYMENT',26,GREY,True)

image.save(OUT,optimize=True)
print(OUT)
