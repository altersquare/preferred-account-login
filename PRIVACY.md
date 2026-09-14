# Privacy Policy

**Preferred Account Login** (the "extension") — Chrome browser extension.

**Last updated:** 1 September 2026

## Summary

The extension does not collect, transmit, sell, or share any of your data. It
contains no analytics, no tracking, no advertising, and no third-party code. It
makes no network requests of any kind. Everything you configure stays in your
own browser.

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

These are held under three keys, `domainEmails`, `isEnabled`, and `holidays`,
in Chrome's extension storage (`chrome.storage.sync`).

Email addresses are personal data, which is why this policy exists. They are
used for one purpose only: to build the account parameter added to a URL when
you open a matching service. They are never sent anywhere.

## Where that data lives

Your rules are stored by Chrome itself, in the extension storage area belonging
to your browser profile.

If you have **Chrome Sync** enabled, Chrome synchronises that storage across the
browsers where you are signed in, in the same way it syncs your bookmarks and
saved passwords. That synchronisation is performed by Google under your own
Google Account and is governed by
[Google's Privacy Policy](https://policies.google.com/privacy), not by this one.
The developer of this extension has no access to it and receives nothing from
it. If you would rather your rules stayed on one device, turn off Chrome Sync,
or disable syncing for extensions, in Chrome's settings.

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
- It makes no requests to any server, including any server operated by the
  developer. There is no backend.
- It contains no analytics, telemetry, crash reporting, advertising, or
  fingerprinting.
- It loads no remote code and bundles no third-party libraries.
- It does not sell or transfer your data to anyone, for any purpose. There is
  no data to sell, because none is collected.

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
- remove everything by uninstalling the extension, which causes Chrome to
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
