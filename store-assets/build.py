#!/usr/bin/env python3
"""
Generates Chrome Web Store listing assets for Preferred Account Login.

Screenshots embed the REAL popup (src/popup.html + popup.css + popup.js, with a
stubbed chrome.* API supplying sample rules) inside an iframe, so every listing
image is an accurate representation of the shipping UI -- which the store's
metadata policy requires.

Pages are rendered by headless Chrome at 2x and downsampled with LANCZOS for
crisp text, then flattened to 24-bit RGB PNG with no alpha channel, per the
store's asset requirements.

Usage:  python store-assets/build.py
Output: store-assets/*.png  (intermediate HTML lands in store-assets/_src/)
"""

import base64
import datetime
import io
import json
import os
import shutil
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "store-assets")
SRC = os.path.join(ASSETS, "_src")

CHROME_CANDIDATES = [
    os.path.join(os.environ.get("PROGRAMFILES", r"C:\Program Files"),
                 "Google", "Chrome", "Application", "chrome.exe"),
    os.path.join(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"),
                 "Google", "Chrome", "Application", "chrome.exe"),
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
]

NAME = "Preferred Account Login"
TAGLINE = "The right account for every service. Automatically."

# Brand tokens, matching icons/icon.svg.
INK = "#0e2a5c"
INK_SOFT = "#41598a"
FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

# Sentinel colour painted behind the popup during measurement. Anything that is
# not this colour is popup content, which is how the natural height is found.
PROBE_BG = (255, 0, 255)

POPUP_W = 600
# The real cap from popup.css (body { max-height: 600px }). Used verbatim by
# the one "capped" shot below, rather than measured, since that shot's whole
# point is a card that does NOT grow to fit its content.
POPUP_H = 600
ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
WEEKDAYS = [1, 2, 3, 4, 5]

# Marked as a holiday in the "holidays" screenshot. rules.js compares dates in
# the viewer's own local time, so "today" (whenever the build actually runs)
# is the one value guaranteed to render as marked rather than a stale date
# that has already dropped off the list.
TODAY_KEY = datetime.date.today().isoformat()


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if candidate and os.path.exists(candidate):
            return candidate
    sys.exit("Could not find Chrome. Set the CHROME environment variable.")


def read(*parts):
    with io.open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


def icon_data_uri():
    svg = read("icons", "icon.svg")
    return "data:image/svg+xml;base64," + base64.b64encode(
        svg.encode("utf-8")).decode("ascii")


def rule(email, days=None, enabled=True, **extra):
    """One domainEmails entry in the shape src/popup.js expects."""
    return dict({"email": email, "enabled": enabled,
                 "days": list(ALL_DAYS if days is None else days)}, **extra)


def write_popup(slug, domain_emails, holidays=None, probe=False, capped=False,
                 open_menu=False):
    """Write a standalone, runnable copy of the real popup with sample rules."""
    css = read("src", "popup.css")
    # rules.js declares the schema and checks (normalizeDomainSetting,
    # toDateKey, evaluateRule, ...) that popup.js relies on as globals, the
    # same way src/popup.html loads it ahead of popup.js.
    rules_js = read("src", "rules.js")
    js = read("src", "popup.js")
    html = read("src", "popup.html")
    body = html.split("<body>", 1)[1].split("</body>", 1)[0]
    body = body.replace('<script src="rules.js"></script>', "")
    body = body.replace('<script src="popup.js"></script>', "")

    stub = (
        "<script>window.chrome={storage:{sync:{_d:%s,"
        "async get(ks){const o={};for(const k of ks)if(k in this._d)o[k]=this._d[k];"
        "return o;},async set(o){Object.assign(this._d,o);}}},"
        "tabs:{async reload(){}}};</script>"
        % json.dumps({
            "domainEmails": domain_emails,
            "isEnabled": True,
            "holidays": list(holidays or []),
        })
    )

    # popup.js populates the rule list asynchronously -- it awaits
    # chrome.storage before appending a single row -- and attaches every
    # button's click handler from inside that same async function. A
    # DOMContentLoaded listener declared up in <head> can fire, or a
    # synthetic click can land, before either has happened. Polling for the
    # list to be non-empty (a cheap proxy for "handleDOMLoad has run past its
    # synchronous setup, including attaching the overflow menu's handler")
    # sidesteps that race for every post-load action below, instead of
    # racing each one separately.
    actions = []
    if capped:
        # Scrolled partway rather than left at the top, so the thumb floats
        # clear of both ends and reads as "more above and below" rather than
        # "start of a list".
        actions.append("c.scrollTop=Math.round(c.scrollHeight*0.38);")
    if open_menu:
        # Clicks the real button rather than un-hiding the menu directly, so
        # this exercises the same code path -- and the same aria-expanded
        # bookkeeping -- a person opening it would.
        actions.append(
            "var mb=document.getElementById('moreButton');if(mb)mb.click();"
        )
    post_script = (
        (
            "<script>(function poll(){"
            "var list=document.getElementById('domainEmailList');"
            "var c=document.getElementById('content');"
            "if(list&&list.children.length&&c){" + "".join(actions) +
            "}else{setTimeout(poll,30);}"
            "})();</script>"
        )
        if actions else ""
    )

    if capped:
        # The one shot that keeps the popup's real 600px cap and internal
        # scrollbar, instead of growing to fit every rule, so the listing
        # shows the scrollbar rather than only ever the shape of list that
        # never needs one. Just background: popup.js's own CSS already caps
        # and scrolls the real markup; nothing to override.
        overrides = "<style>html{background:transparent}</style>"
    else:
        # The popup normally caps itself at 600px and scrolls. For a still
        # image we want the whole card, so let it grow to its natural height.
        # During a probe render the page behind the popup is painted magenta
        # so the content height can be read straight off the PNG.
        overrides = (
            "<style>html{background:%s}"
            "body{max-height:none!important;overflow:visible!important;"
            "height:max-content!important}</style>"
            % ("#ff00ff" if probe else "transparent")
        )

    out = (
        '<!doctype html><html><head><meta charset="utf-8"><title>%s</title>'
        "<style>%s</style>%s</head><body>%s\n%s\n"
        "<script>%s</script><script>%s</script>%s</body></html>"
        % (NAME, css, overrides, body, stub, rules_js, js, post_script)
    )
    filename = "popup-%s%s.html" % (slug, "-probe" if probe else "")
    io.open(os.path.join(SRC, filename), "w",
            encoding="utf-8", newline="").write(out)
    return filename


def chrome_shot(chrome, src_file, out_png, width, height, show_scrollbars=False):
    # --hide-scrollbars is a browser-wide flag: it suppresses scrollbars in
    # every frame, including the popup's own document nested in an iframe, so
    # the one shot meant to show a real scrollbar has to run without it.
    flags = [chrome, "--headless=new", "--disable-gpu",
             "--force-device-scale-factor=2", "--virtual-time-budget=6000",
             "--allow-file-access-from-files", "--no-sandbox",
             "--window-size=%d,%d" % (width, height)]
    if not show_scrollbars:
        flags.append("--hide-scrollbars")
    flags += ["--screenshot=" + out_png, os.path.join(SRC, src_file)]
    subprocess.run(flags, check=True, capture_output=True)


def measure_popup(chrome, slug, domain_emails, holidays=None):
    """Render the popup over a magenta page and read back its natural height."""
    probe_file = write_popup(slug, domain_emails, holidays=holidays, probe=True)
    raw = os.path.join(SRC, "_probe-%s.png" % slug)
    chrome_shot(chrome, probe_file, raw, POPUP_W, 2400)

    img = Image.open(raw).convert("RGB")
    scale = img.width // POPUP_W or 1
    last_content_row = 0
    for y in range(img.height - 1, -1, -1):
        row = img.crop((0, y, img.width, y + 1)).getcolors(maxcolors=1 << 16)
        if not (len(row) == 1 and row[0][1] == PROBE_BG):
            last_content_row = y
            break
    os.remove(raw)
    return int(round((last_content_row + 1) / scale))


def page(width, height, inner):
    return """<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden}
/* position:relative pins body itself as the containing block for every
   position:absolute;inset:0 wrapper below. Without it, headless Chrome's
   window-size and its actual viewport can disagree by a few dozen pixels, so
   those wrappers center against the (larger) viewport instead of the body's
   exact w x h -- invisible on a 1280px-wide screenshot, but a very visible
   diagonal shift on the 440x280 promo tile. */
body{position:relative;font-family:%(font)s;-webkit-font-smoothing:antialiased;
 color:%(ink)s;
 background:
   radial-gradient(1100px 620px at 12%% -12%%,rgba(91,147,247,.28),transparent 62%%),
   radial-gradient(900px 560px at 104%% 112%%,rgba(26,95,208,.22),transparent 60%%),
   linear-gradient(150deg,#f6f9ff 0%%,#e8effd 52%%,#dde7fb 100%%)}
.frame{background:#fff;border-radius:18px;overflow:hidden;
 box-shadow:0 30px 64px rgba(14,42,92,.20),0 4px 14px rgba(14,42,92,.10);
 border:1px solid rgba(14,42,92,.09)}
.frame iframe{width:%(pw)dpx;border:0;display:block}
h1{font-size:38px;line-height:1.16;font-weight:700;letter-spacing:-.7px}
p.sub{font-size:19px;line-height:1.45;color:%(soft)s;font-weight:400}
</style></head><body>%(inner)s</body></html>""" % {
        "w": width, "h": height, "pw": POPUP_W, "font": FONT,
        "ink": INK, "soft": INK_SOFT, "inner": inner,
    }


# Screenshot layout: text column on the left, popup card right-aligned, both
# vertically centred in the 1280x800 frame. A portrait card centred under a
# centred headline leaves most of a landscape frame empty, so the card is given
# the full height instead and scaled to fit.
CARD_RIGHT = 1240
CARD_MAX_H = 672


def screenshot_page(headline, sub, popup_file, popup_h):
    scale = min(1.0, float(CARD_MAX_H) / popup_h)
    card_w = int(POPUP_W * scale)
    card_h = int(popup_h * scale)
    return page(1280, 800, """
<div style="position:absolute;left:80px;top:0;width:500px;height:800px;
            display:flex;flex-direction:column;justify-content:center">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:26px">
    <img src="%(icon)s" width="40" height="40" alt="">
    <span style="font-size:19px;font-weight:600;letter-spacing:-.2px">%(name)s</span>
  </div>
  <h1>%(head)s</h1>
  <p class="sub" style="margin-top:18px">%(sub)s</p>
</div>
<div class="frame" style="position:absolute;left:%(cx)dpx;top:%(cy)dpx;
                          width:%(cw)dpx;height:%(ch)dpx">
  <iframe src="%(pf)s" scrolling="no"
          style="height:%(ph)dpx;transform:scale(%(sc)s);transform-origin:top left"></iframe>
</div>""" % {
        "icon": icon_data_uri(), "name": NAME, "head": headline, "sub": sub,
        "pf": popup_file, "ph": popup_h, "sc": scale,
        "cw": card_w, "ch": card_h,
        "cx": CARD_RIGHT - card_w, "cy": (800 - card_h) // 2,
    })


def render(chrome, html, out_png, width, height, show_scrollbars=False):
    src_file = out_png.replace(".png", ".html")
    io.open(os.path.join(SRC, src_file), "w",
            encoding="utf-8", newline="").write(html)
    raw = os.path.join(SRC, "_raw-" + out_png)
    chrome_shot(chrome, src_file, raw, width, height, show_scrollbars)

    img = Image.open(raw)
    if img.size != (width, height):
        img = img.resize((width, height), Image.LANCZOS)
    # The store rejects PNGs with an alpha channel, so composite onto white.
    flat = Image.new("RGB", (width, height), (255, 255, 255))
    flat.paste(img, (0, 0), img.convert("RGBA"))
    dest = os.path.join(ASSETS, out_png)
    flat.save(dest, "PNG", optimize=True)
    os.remove(raw)
    print("  %-32s %4dx%-4d  %6.1f KB"
          % (out_png, width, height, os.path.getsize(dest) / 1024.0))


# Each entry is (slug, headline, sub, domain_emails, holidays, capped,
# open_menu). holidays defaults to none for shots that do not need it.
# capped keeps the popup at its real 600px height with its own scrollbar
# instead of growing the card to fit every rule; open_menu clicks the
# footer's "..." button open before the shot is taken, so the buttons behind
# it are what the screenshot actually shows -- see write_popup.
SHOTS = [
    ("01-overview",
     "One preferred account per service",
     "Tell each site which of your signed-in accounts to open with, then stop switching.",
     {"mail.google.com": rule("you@gmail.com"),
      "drive.google.com": rule("you@company.com"),
      "youtube.com": rule("you@gmail.com")},
     None, False, False),

    ("02-many-rules",
     "Scales from one rule to a screenful",
     "Every rule collapses to a single line, so a long list stays scannable "
     "-- with a real scrollbar once it runs past the fold.",
     {"mail.google.com": rule("you@gmail.com"),
      "drive.google.com": rule("you@company.com", WEEKDAYS, timeEnabled=True,
                               startTime="09:00", endTime="18:00"),
      "docs.google.com": rule("you@company.com", WEEKDAYS),
      "youtube.com": rule("you@gmail.com"),
      "gemini.google.com": rule("you@company.com"),
      "meet.google.com": rule("you@company.com", WEEKDAYS),
      "photos.google.com": rule("you@gmail.com", [0, 6], enabled=False),
      "keep.google.com": rule("you@gmail.com"),
      "calendar.google.com": rule("you@company.com", WEEKDAYS),
      "cloud.google.com": rule("you-ops@company.com", WEEKDAYS)},
     None, True, False),

    ("03-schedule",
     "Rules that follow your week",
     "Limit a rule to selected days and an active-hours window: work account, "
     "9 to 6, weekdays only.",
     {"drive.google.com": rule("you@company.com", WEEKDAYS, timeEnabled=True,
                               startTime="09:00", endTime="18:00"),
      "mail.google.com": rule("you@gmail.com")},
     None, False, False),

    ("04-holidays",
     "Stand down on your day off",
     "Mark a date once, and every rule set to Pause on holidays stops applying "
     "for the day. The rest keep running.",
     {"mail.google.com": rule("you@gmail.com", skipOnHolidays=True),
      "drive.google.com": rule("you@company.com", skipOnHolidays=True),
      "youtube.com": rule("you@gmail.com")},
     [TODAY_KEY], False, False),

    ("05-export-import",
     "Back up your rules, or move them",
     "Export every rule to a JSON file and import it on another profile. "
     "Add any supported service by hostname, too.",
     {"mail.google.com": rule("you@gmail.com"),
      "gemini.google.com": rule("you@company.com"),
      "meet.google.com": rule("you@company.com"),
      "photos.google.com": rule("you@gmail.com")},
     None, False, True),
]


def main():
    chrome = os.environ.get("CHROME") or find_chrome()
    os.makedirs(SRC, exist_ok=True)
    print("Chrome: %s" % chrome)
    print("Writing listing assets to %s" % ASSETS)

    for slug, headline, sub, rules, holidays, capped, open_menu in SHOTS:
        if capped:
            # POPUP_H matches the real CSS cap, so nothing to measure -- the
            # whole point of this shot is that the card does NOT grow to fit
            # its content.
            popup_h = POPUP_H
        else:
            # Measured with the menu closed. It opens upward from the footer
            # into space the rules list above it already occupies, so it
            # never grows the page past this measurement.
            popup_h = measure_popup(chrome, slug, rules, holidays)
        popup_file = write_popup(slug, rules, holidays=holidays, capped=capped,
                                  open_menu=open_menu)
        render(chrome, screenshot_page(headline, sub, popup_file, popup_h),
               "screenshot-%s.png" % slug, 1280, 800, show_scrollbars=capped)

    render(chrome, page(440, 280, """
<div style="position:absolute;inset:0;padding:28px;display:flex;flex-direction:column;
            justify-content:center;align-items:center;text-align:center">
  <img src="%(icon)s" width="78" height="78" alt="" style="margin-bottom:16px">
  <div style="font-size:27px;font-weight:700;letter-spacing:-.5px;line-height:1.18">
    Preferred<br>Account&nbsp;Login</div>
  <div style="font-size:13px;color:%(soft)s;margin-top:12px;line-height:1.45;max-width:330px">
    %(tag)s</div>
</div>""" % {"icon": icon_data_uri(), "soft": INK_SOFT, "tag": TAGLINE}),
        "promo-small-440x280.png", 440, 280)

    marquee_rules = {"mail.google.com": rule("you@gmail.com"),
                     "drive.google.com": rule("you@company.com"),
                     "youtube.com": rule("you@gmail.com")}
    marquee_h = measure_popup(chrome, "marquee", marquee_rules)
    marquee_file = write_popup("marquee", marquee_rules)
    render(chrome, page(1400, 560, """
<div style="position:absolute;inset:0;display:flex;align-items:center">
  <div style="width:660px;padding-left:88px">
    <img src="%(icon)s" width="100" height="100" alt="" style="margin-bottom:26px">
    <div style="font-size:58px;font-weight:700;letter-spacing:-1.5px;line-height:1.08">
      Preferred<br>Account Login</div>
    <div style="font-size:23px;color:%(soft)s;margin-top:22px;line-height:1.45;max-width:520px">
      %(tag)s</div>
  </div>
  <div class="frame" style="position:absolute;left:770px;top:60px;width:%(fw)dpx;height:440px">
    <iframe src="%(pf)s" scrolling="no"
            style="height:%(ph)dpx;transform:scale(%(sc)s);transform-origin:top left"></iframe>
  </div>
</div>""" % {"icon": icon_data_uri(), "soft": INK_SOFT, "tag": TAGLINE,
             "pf": marquee_file, "ph": marquee_h, "sc": 0.98,
             "fw": int(POPUP_W * 0.98)}),
        "promo-marquee-1400x560.png", 1400, 560)

    print("Done.")


if __name__ == "__main__":
    main()
