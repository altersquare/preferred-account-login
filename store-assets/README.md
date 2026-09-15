# Store listing assets

Chrome Web Store images for **Preferred Account Login**, generated from the
real popup UI so the listing accurately represents the shipping product.

## Regenerating

```bash
python store-assets/build.py
```

Requires Chrome (auto-detected on Windows, or set `CHROME`) and Pillow. The
script renders each page with headless Chrome at 2x, downsamples with LANCZOS,
and flattens to 24-bit RGB PNG — the store rejects PNGs with an alpha channel.

Screenshots embed `src/popup.html` + `popup.css` + `popup.js` in an iframe with
a stubbed `chrome.*` API supplying sample rules, so they update automatically
whenever the popup changes. Intermediate HTML is written to `_src/`
(gitignored); only the PNGs and `build.py` are tracked.

## Output

| File                              | Size     | Slot               |
| --------------------------------- | -------- | ------------------ |
| `screenshot-01-overview.png`      | 1280×800 | Screenshot 1       |
| `screenshot-02-many-rules.png`    | 1280×800 | Screenshot 2       |
| `screenshot-03-schedule.png`      | 1280×800 | Screenshot 3       |
| `screenshot-04-holidays.png`      | 1280×800 | Screenshot 4       |
| `screenshot-05-export-import.png` | 1280×800 | Screenshot 5       |
| `promo-small-440x280.png`         | 440×280  | Small promo tile   |
| `promo-marquee-1400x560.png`      | 1400×560 | Marquee promo tile |

## Branding constraints

The v7.3.0 listing was rejected three times under "Spam and Placement in the
Store", with the Google branding guidelines cited. These assets deliberately
avoid the triggers:

- No Google logo or four-colour "G" anywhere, in the popup or in the images.
  The popup heading uses the extension's own icon (`icons/icon.svg`).
- No Google trademark in the extension name or in any baked-in promo text.
  The tagline is "The right account for every service. Automatically."
- No "Google Sans"; the popup uses a neutral system font stack.

Google service hostnames (`mail.google.com`, `drive.google.com`, ...) do appear
inside the screenshotted UI. That is accurate, factual product behaviour rather
than branding, and is what the extension actually configures.
