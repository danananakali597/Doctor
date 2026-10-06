from pathlib import Path
import math
from PIL import Image,ImageDraw,ImageFont,ImageFilter
out=Path(__file__).resolve().parent.parent/'public/assets/tickets'
out.mkdir(parents=True,exist_ok=True)
W,H=1280,240
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30)
bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',30)
for stage,active,accent in [('opened',0,(243,156,18)),('reviewing',1,(52,152,255)),('resolved',2,(46,204,113))]:
 im=Image.new('RGB',(W,H),(10,15,29));d=ImageDraw.Draw(im)
 for i in range(32):
  points=[(x,145+int(math.sin(x/155+i*.13)*24)+i*2) for x in range(0,W,4)]
  d.line(points,fill=(13+i//2,22+i//2,52+i),width=1)
 xs=[210,640,1070];cy=95
 d.line((xs[0],cy,xs[-1],cy),fill=(107,116,138),width=4)
 if active:d.line((xs[0],cy,xs[active],cy),fill=accent,width=4)
 glow=Image.new('RGBA',im.size);gd=ImageDraw.Draw(glow);x=xs[active];gd.ellipse((x-40,cy-40,x+40,cy+40),fill=accent+(170,));glow=glow.filter(ImageFilter.GaussianBlur(25));im=Image.alpha_composite(im.convert('RGBA'),glow);d=ImageDraw.Draw(im)
 for i,(x,label) in enumerate(zip(xs,['Opened','Reviewing','Resolved'])):
  c=accent if i==active else (170,180,199);d.ellipse((x-17,cy-17,x+17,cy+17),fill=(13,20,37),outline=c,width=4)
  if i==active:d.ellipse((x-9,cy-9,x+9,cy+9),fill=accent)
  f=bold if i==active else font;d.text((x,155),label,font=f,fill=c,anchor='mt')
 im.convert('RGB').save(out/f'progress-{stage}.png',optimize=True)
