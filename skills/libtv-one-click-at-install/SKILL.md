---
name: libtv-one-click-at-install
description: Prepare or update the local LibTV One-Click @ Chrome extension from this package, verify files, preserve existing installs, and guide the required native Chrome loading step. Use when installing or updating this extension, not for media generation or account login.
---

# LibTV One-Click @ installation assistant

This package has two components: this Codex setup skill and `extension/`, a Chrome content-script extension. Installing the Codex component does not load the Chrome extension.

## Prepare files

1. Resolve this package root from the loaded skill location: two directories above this skill folder. Inspect `scripts/prepare-chrome-extension.cjs` before first execution. Use an available Node.js runtime; no third-party dependencies are needed.
2. Run `node "<package-root>/scripts/prepare-chrome-extension.cjs" --json`. It validates bundled SHA-256 checksums and icon dimensions, copies only the extension files to a stable OS-appropriate application-data directory, and reports the absolute path. Existing matching files are reused. An older recognized install is preserved as a sibling backup. Unrecognized or symlink destinations are refused, not overwritten. Use `--dest "<explicit-user-path>"` only when the user chose that location.
3. Read the resulting JSON. `prepared` or `already_prepared` only means files are ready; `chromeLoaded: "unverified"` is intentional. If file preparation fails, explain the specific failure without claiming installation succeeded. Never change unrelated settings or replace a user's browser profile.

## Complete Chrome loading honestly

Ask the user to open `chrome://extensions`, enable Developer mode if needed, click **Load unpacked**, and select the reported directory. If already loaded from that exact directory, ask them to click **Reload** instead. Then have them refresh LibTV. Give this as one compact instruction with the exact path.

If the current tools cannot access Chrome system pages, stop at this handoff. Do not use browser flags, managed policies, preference-file edits, native UI, or other indirect routes to evade that limitation. Do not promise a fully unattended Chrome install. Never disable browser security protections.

After the user confirms loading, verify the visible **一键绑定 @** button on a LibTV generation editor when browser access is available. Treat a fixture result as local testing, not live LibTV verification. Report file readiness, user-confirmed Chrome loading, and live verification separately. Do not replace a production prompt for a test without backing it up and preserving any subsequent user edits. Do not click Generate or send Enter.

## First-time repository installation

When this skill is not yet installed, use the official CLI only if the current `codex plugin ... --help` supports these commands:

```sh
codex plugin marketplace add CGS1991-CN/libtv-one-click-at --ref v1.0.4
codex plugin add libtv-one-click-at@libtv-one-click-at-marketplace --json
```

Reuse an existing marketplace registration and plugin identity; do not replace the user's entire Codex configuration. If the current conversation cannot yet discover the newly installed skill, read the verified checkout's skill and run its preparation script directly. A new chat or app refresh may be needed for skill discovery. Follow the current environment's approval flow; repository installation is not permission to suppress it.
