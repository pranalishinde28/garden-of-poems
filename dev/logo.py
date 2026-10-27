import math, sys
out = sys.argv[1]
def petal(L):
    return (f"M0,0 C{-0.48*L:.1f},{-0.34*L:.1f} {-0.44*L:.1f},{-0.92*L:.1f} {-0.13*L:.1f},{-L:.1f} "
            f"L0,{-0.86*L:.1f} L{0.13*L:.1f},{-L:.1f} C{0.44*L:.1f},{-0.92*L:.1f} {0.48*L:.1f},{-0.34*L:.1f} 0,0Z")
def blossom(x, y, L, rot, grad='pk'):
    s = f'<g transform="translate({x},{y}) rotate({rot})">'
    for k in range(5):
        s += f'<path d="{petal(L)}" transform="rotate({k*72})" fill="url(#{grad})" stroke="#c4577c" stroke-width="{max(1,L*0.04):.1f}" stroke-opacity=".45"/>'
    for k in range(5):
        a = math.radians(k*72 + 36 - 90)
        s += f'<line x1="0" y1="0" x2="{math.cos(a)*L*0.38:.1f}" y2="{math.sin(a)*L*0.38:.1f}" stroke="#b84a6e" stroke-width="{L*0.035:.1f}" stroke-linecap="round" opacity=".6"/>'
        s += f'<circle cx="{math.cos(a)*L*0.4:.1f}" cy="{math.sin(a)*L*0.4:.1f}" r="{L*0.05:.1f}" fill="#e2a83a"/>'
    s += f'<circle r="{L*0.16:.1f}" fill="#f2c45a" stroke="#c98f2a" stroke-width="{L*0.03:.1f}"/></g>'
    return s
def bud(x, y, r, rot):
    return f'<g transform="translate({x},{y}) rotate({rot})"><ellipse cx="0" cy="{-r:.1f}" rx="{r*0.62:.1f}" ry="{r:.1f}" fill="url(#pk)" stroke="#c4577c" stroke-opacity=".5" stroke-width="1.5"/><path d="M{-r*0.5:.1f},{-r*0.15:.1f} Q0,{r*0.35:.1f} {r*0.5:.1f},{-r*0.15:.1f}" fill="#6f8f45"/></g>'

def mark(seal=True, k=1.12):
    s = ''
    if seal:
        s += '<circle cx="256" cy="256" r="244" fill="url(#paper)" stroke="url(#gold)" stroke-width="12"/>'
        s += '<circle cx="256" cy="256" r="222" fill="none" stroke="#c9a24a" stroke-width="2.5" stroke-opacity=".7"/>'
        # a soft rose glow behind the crown
        s += '<circle cx="256" cy="205" r="150" fill="url(#glow)"/>'
    s += f'<g transform="translate(256,262) scale({k}) translate(-256,-262)">'
    # the earth the nib is planted in
    s += '<path d="M150,402 Q256,368 362,402 Q256,424 150,402Z" fill="#6f8f45"/>'
    s += '<path d="M176,400 Q256,378 336,400" fill="none" stroke="#86a85a" stroke-width="4" stroke-linecap="round"/>'
    for gx, gh, ga in [(196,16,-12),(214,22,-4),(300,20,6),(318,14,14)]:
        s += f'<path d="M{gx},392 q{ga*0.4},{-gh*0.6} {ga},{-gh}" fill="none" stroke="#5f7f3a" stroke-width="3.5" stroke-linecap="round"/>'
    # branches rising from the nib's shoulders
    br = [("M256,246 C254,232 255,222 256,212", 16),
          ("M256,214 C246,196 226,180 200,168 C180,158 160,156 142,160", 13),
          ("M256,214 C266,194 288,180 314,170 C334,162 356,160 374,166", 12),
          ("M256,216 C254,186 258,154 264,118", 10),
          ("M214,174 C206,158 196,148 180,140", 6.5),
          ("M302,174 C312,156 324,146 342,138", 6),
          ("M258,160 C244,146 236,130 232,112", 5.5)]
    for d, w in br:
        s += f'<path d="{d}" fill="none" stroke="#5a3a28" stroke-width="{w}" stroke-linecap="round"/>'
        s += f'<path d="{d}" fill="none" stroke="#8a6248" stroke-width="{w*0.35:.1f}" stroke-linecap="round" opacity=".55" transform="translate(-1,-1.5)"/>'
    # the nib, point down in the earth: a concave back, gentle shoulders, a long taper, the slit and breather hole
    s += ('<path d="M220,236 Q256,250 292,236 C298,252 300,266 296,280 C288,318 272,352 256,396 C240,352 224,318 216,280 C212,266 214,252 220,236Z" '
          'fill="url(#nib)" stroke="#7a5618" stroke-width="3.5" stroke-linejoin="round"/>')
    s += '<path d="M226,262 Q256,272 286,262" fill="none" stroke="#9a7024" stroke-width="2.5" opacity=".7"/>'
    s += '<path d="M256,318 L256,392" stroke="#5e4214" stroke-width="3.5" stroke-linecap="round"/>'
    s += '<path d="M256,318 C246,306 246,294 256,298 C266,294 266,306 256,318Z" fill="#fdf6e6" stroke="#5e4214" stroke-width="3"/>'
    s += '<path d="M232,272 C234,300 242,324 250,346" fill="none" stroke="#fff6da" stroke-width="5" stroke-linecap="round" opacity=".6"/>'
    # the crown of blossom
    s += bud(138, 162, 11, -64) + bud(378, 168, 10, 66) + bud(230, 108, 9, -20) + bud(186, 134, 8, -40)
    for x, y, L, r in [(264,116,38,8),(196,166,42,-14),(318,166,42,12),(150,150,30,20),(364,150,30,-8),(232,184,26,30),(288,142,26,-24),(344,126,22,40),(178,132,22,-30),(258,168,22,10)]:
        s += blossom(x, y, L, r)
    # one petal drifting down, and a second
    s += f'<g transform="translate(372,248) rotate(32)"><path d="{petal(16)}" fill="url(#pk)" opacity=".9"/></g>'
    s += f'<g transform="translate(138,272) rotate(-40)"><path d="{petal(12)}" fill="url(#pk)" opacity=".75"/></g>'
    return s + '</g>'

defs = '''<defs>
<radialGradient id="paper" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".75" stop-color="#f6ead2"/><stop offset="1" stop-color="#ead8b4"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd9e4" stop-opacity=".85"/><stop offset="1" stop-color="#ffd9e4" stop-opacity="0"/></radialGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d27a"/><stop offset=".5" stop-color="#d8aa48"/><stop offset="1" stop-color="#a87a28"/></linearGradient>
<linearGradient id="nib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8862f"/><stop offset=".35" stop-color="#f6d98a"/><stop offset=".65" stop-color="#e2b456"/><stop offset="1" stop-color="#a87a28"/></linearGradient>
<radialGradient id="pk" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#fff2f6"/><stop offset=".55" stop-color="#f9c4d4"/><stop offset="1" stop-color="#ee95b2"/></radialGradient>
</defs>'''

svg = lambda body, vb='0 0 512 512', extra='': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" {extra}>{defs}{body}</svg>'
open(f'{out}/logo.svg','w').write(svg(mark(True)))
# the favicon: the same mark, a little closer, so it reads in a browser tab
def simple():
    t = '<circle cx="256" cy="256" r="246" fill="url(#paper)" stroke="url(#gold)" stroke-width="20"/><circle cx="256" cy="200" r="170" fill="url(#glow)"/>'
    t += '<path d="M256,230 C252,200 230,176 196,160 M256,230 C260,198 284,176 318,162" fill="none" stroke="#5a3a28" stroke-width="22" stroke-linecap="round"/>'
    t += ('<path d="M206,232 Q256,252 306,232 C316,256 318,276 312,296 C300,344 280,388 256,452 C232,388 212,344 200,296 C194,276 196,256 206,232Z" '
          'fill="url(#nib)" stroke="#7a5618" stroke-width="7" stroke-linejoin="round"/>')
    t += '<path d="M256,330 L256,446" stroke="#5e4214" stroke-width="7" stroke-linecap="round"/><circle cx="256" cy="318" r="13" fill="#fdf6e6" stroke="#5e4214" stroke-width="6"/>'
    t += blossom(176, 158, 74, -12) + blossom(336, 158, 74, 14) + blossom(256, 96, 70, 4)
    return t
open(f'{out}/favicon.svg','w').write(svg(simple()))
# the wordmark: the seal beside the garden's name
word = (f'<g transform="translate(0,0)">{mark(True)}</g>'
        '<text x="560" y="228" font-family="Cormorant Garamond, Georgia, serif" font-size="88" font-weight="600" letter-spacing="10" fill="#2f3a32">THE GARDEN</text>'
        '<text x="560" y="336" font-family="Cormorant Garamond, Georgia, serif" font-size="88" font-weight="600" letter-spacing="10" fill="#2f3a32">OF POEMS</text>'
        '<line x1="562" y1="372" x2="900" y2="372" stroke="#c9a24a" stroke-width="3"/>'
        '<text x="562" y="420" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="38" font-weight="500" fill="#7a6a4e">every poem leaves something growing</text>')
open(f'{out}/logo-wordmark.svg','w').write(svg(word, '0 0 1320 512'))
