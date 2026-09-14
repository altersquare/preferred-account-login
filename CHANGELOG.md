# Changelog

Notable changes to Preferred Account Login. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and versions follow the
`version` field in `manifest.json`.

## [7.5.0] — 2026-09-14

### Added

- **Holidays**: a shared list of dates, marked from the popup header — either
  "Today is a holiday" for the current day or the date field for one coming up.
  Rules opt in individually with **Pause on holidays**, so a marked date
  silences the rules that observe it and leaves the rest running. Holiday dates
  and the rule's own checkbox are ordinary pending edits: they show on screen,
  enable `Save Changes`, and are written — with the active tab reloaded — only
  when it is clicked. Closing the popup discards them. Dates that have passed
  are dropped the next time the popup opens.
- Holiday dates and each rule's **Pause on holidays** setting now travel with
  exported rule files (format version 2). Imported dates are staged like the
  rules — shown in the header, written only by `Save Changes` — so loading a
  file and closing the popup leaves storage untouched. Files written by earlier
  versions still import; they carry no dates and leave the marked ones alone.

### Fixed

- The `Save Changes` button was greyed out but still clickable when the popup
  opened, so a stray click on an untouched popup saved and reloaded the tab.

### Changed

- The rule schema and the checks that decide whether a rule applies right now
  moved into `src/rules.js`, loaded by both the content script and the popup.
  The checks are an ordered list rather than a chain of early returns, so a new
  condition — holidays being the first — is one entry in that list instead of
  an edit in every file that had its own copy of the logic.

## [7.4.0] — 2026-09-01

### Added

- **Export and import rules**: `Export` writes the current rules to a
  `preferred-account-login-rules-<date>.json` file, and `Import` reads one back
  in, so rules can be backed up or moved to another browser profile. An import
  fills in the form and leaves it to `Save Changes` to persist, and unusable
  rows are skipped rather than failing the whole file.

### Removed

- The `scripting` and `tabs` permissions. Both existed only so that saving
  could reload the active tab; `chrome.tabs.reload()` does the same thing and
  requires no permission, leaving `storage` as the extension's only API
  permission.

### Changed

- Added `PRIVACY.md`, a privacy policy covering what the extension stores and
  what it never does, for the Chrome Web Store listing's privacy policy field.
- The store short description in `manifest.json` no longer leads with the
  Google trademark, for the same branding reasons.
- The popup heading now uses the extension's own icon instead of the Google
  logo, and the interface no longer requests the "Google Sans" typeface, to
  comply with Google's branding guidelines for Chrome Web Store listings.

## [7.3.0] — 2026-08-22

### Added

- **Any Google domain**: the domain field now accepts any hostname under
  `google.com`, `youtube.com`, or `ai.google` — typed directly or pasted as a
  full URL — instead of only the services in the autocomplete list. New Google
  services work without an extension update. The dropdown remains as
  autocomplete suggestions. ([#13])

### Changed

- New extension icon: a blue rounded square with an avatar and a green
  checkmark badge, replacing the ring design. The SVG source lives at
  `icons/icon.svg`. ([#13])
- Duplicate detection compares resolved domains, so a service name (`gmail`)
  and its hostname (`mail.google.com`) are recognized as the same rule. ([#13])
- Rules stored under a domain with no autocomplete entry now display as their
  hostname in the popup instead of an empty input. ([#13])
- Hostname matching in the content script is case-insensitive. ([#13])

## [7.2.0] — 2026-08-22

### Added

- Save confirmation: the **Save Changes** button shows "Saved ✓" for two
  seconds after a successful save, on Google and non-Google pages alike, and
  stays disabled until the next edit. ([#11])
- Day-pill validation: deselecting every day shows "Select at least one day"
  and blocks saving, instead of silently resetting the rule to all seven
  days. ([#10])

### Fixed

- Domain rule precedence: hostnames are matched by exact or subdomain match
  (no more substring matching), and the most specific configured domain wins —
  a `mail.google.com` rule is no longer shadowed by a `google.com` rule that
  was saved earlier. ([#10])
- The remove button now deletes the rule from storage immediately (it
  previously deleted under the wrong key and never persisted). ([#10])
- Saving from a non-Google page no longer shows a false "Error Saving" — the
  save and the convenience tab-reload are handled separately. ([#10])

## [7.0.0] — 2026-08

### Added

- Day-based rules: choose which days of the week each domain rule applies. ([#9])
- Optional active hours: limit a rule to a start–end time window on the
  selected days. ([#9])

## Earlier versions (5.x–6.x)

- Redirect-loop prevention and improved handling of path-based Google auth
  (`/u/N` URLs). ([#7], [#8])
- Day-specific rule activation groundwork, UI overhaul with service
  autocomplete, and stability fixes for storage and tab handling.
  ([#1]–[#6])

[#13]: https://github.com/altersquare/preferred-account-login/pull/13
[#11]: https://github.com/altersquare/preferred-account-login/pull/11
[#10]: https://github.com/altersquare/preferred-account-login/pull/10
[#9]: https://github.com/altersquare/preferred-account-login/pull/9
[#8]: https://github.com/altersquare/preferred-account-login/pull/8
[#7]: https://github.com/altersquare/preferred-account-login/pull/7
[#6]: https://github.com/altersquare/preferred-account-login/pull/6
[#1]: https://github.com/altersquare/preferred-account-login/pull/1
