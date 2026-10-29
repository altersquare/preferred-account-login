# Privacy Policy

**Preferred Account Login** (the "extension") — Chrome and desktop Firefox browser extension.

**Last updated:** 29 October 2026

## Summary

The developer does not collect, sell, or receive your data. The extension
contains no analytics, tracking, advertising, or third-party code. It selects
your account by adding your configured email address to the matching Google
service's URL as the `authuser` parameter. Your browser sends that URL to Google
when loading the page. Settings are stored in your browser and may be synced by
the browser if you enable its sync feature.

The rest of this document explains exactly what is stored and why.

## What the extension stores

The extension stores only what you type into its popup:

| Data               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| Service hostname   | Identifies which site a rule applies to           |
| Email address      | The account that site should open with            |
| Enabled / disabled | Whether a rule, or the whole extension, is active |
| Days of the week   | Which days a rule applies on                      |
| Active hours       | Optional start and end time for a rule            |
| Holiday dates      | Dates you mark off, on which opted-in rules pause |

Rules, the on/off setting, holiday dates, and the temporary pause deadline are
held under `domainEmails`, `isEnabled`, `holidays`, and `pausedUntil` in browser
extension storage (`storage.sync`). The theme is saved in the popup's
`localStorage` and does not sync.

Email addresses are personal data, which is why this policy exists. They are
used for one purpose only: to build the account parameter added to a URL when
you open a matching service. Google receives the address in that URL; the
developer never receives it.

## Where that data lives

Your rules are stored by the browser itself, in the extension storage area belonging
to your browser profile.

If you have **Chrome Sync** enabled, Chrome synchronises that storage across the
browsers where you are signed in, in the same way it syncs your bookmarks and
saved passwords. That synchronisation is performed by Google under your own
Google Account and is governed by
[Google's Privacy Policy](https://policies.google.com/privacy), not by this one.
The developer of this extension has no access to it and receives nothing from
it. If you would rather your rules stayed on one device, turn off Chrome Sync,
or disable syncing for extensions, in Chrome's settings.

On desktop Firefox, extension storage can sync through your Mozilla account
when Add-ons sync is enabled, under [Mozilla's Privacy Notice](https://www.mozilla.org/privacy/firefox/).
Chrome and Firefox do not sync these rules with each other. For local temporary
Firefox installations, export your rules as a backup before restarting.

## What the extension does on web pages

The extension runs only on pages under `google.com`, `youtube.com`, and
`ai.google`, including their subdomains. On those pages it:

- reads the address of the page (hostname, path, and query string) to find out
  whether one of your rules applies;
- if a rule applies and the address does not already specify your preferred
  account, adds Google's own `authuser` parameter to the address and lets the
  page reload on the right account;
- writes short-lived flags to the page's `sessionStorage` (`pgl_redirect_flag`
  and `pgl_path_authuser_attempt:…`) purely to avoid redirect loops. These are
  scoped to that browser tab and are discarded when the tab closes.

The extension **does not** read the content of any page, its cookies, its form
fields, or anything you type on it. It does not read your browsing history, and
it does nothing at all on sites outside the three domains listed above.

## What the extension never does

- It never sees, handles, requests, or stores passwords.
- It never signs you in or out. It only selects between accounts you are
  already signed into.
- It makes no background requests to a developer-operated server. There is no
  backend. Account selection navigates to a Google service URL as described above.
- It contains no analytics, telemetry, crash reporting, advertising, or
  fingerprinting.
- It loads no remote code and bundles no third-party libraries.
- It does not sell your data or send it to the developer. Google receives the
  account-selection URL, and browser sync is controlled by your browser settings.

## Export and import

The **Export** button writes your rules to a `.json` file that your browser
saves wherever you choose. The file is produced on your device and is not
uploaded anywhere. Because it contains the email addresses you configured,
treat it as you would any other personal file.

The **Import** button reads a file you select and loads it into the popup. The
file is read in your browser and is not transmitted.

## Permissions

The extension requests one API permission:

- **`storage`** — to save your rules and the on/off setting, as described
  above.

It also requests host access to `google.com`, `youtube.com`, and `ai.google` so
that its content script can run on those sites and check the page address
against your rules. It requests no access to any other site.

## Retention and deletion

Your rules stay until you remove them. You can:

- delete an individual rule with the delete button next to it, then save;
- remove everything by uninstalling the extension, which causes the browser to
  discard its stored data.

If Chrome Sync was enabled, removal propagates through Chrome's own sync in the
usual way.

## Children

The extension is a general-purpose utility, is not directed at children, and
does not knowingly collect information from anyone — including children —
because it collects nothing.

## Changes to this policy

If this policy changes, the updated version will be published at this same
location with a new "Last updated" date. Material changes will also be noted in
the project's `CHANGELOG.md`.

## Contact

Questions about this policy, or about the extension's handling of data, can be
raised at:

- Issues: https://github.com/altersquare/preferred-account-login/issues
- Email: contact@altersquare.io

## Source code

The extension is open source. Every claim in this policy can be checked against
the code at https://github.com/altersquare/preferred-account-login — in
particular `src/content.js` (what runs on pages) and `src/popup.js` (what is
stored).
