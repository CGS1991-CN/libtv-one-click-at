# Validation boundaries

## Extension 1.0.4

- Eight parser cases cover repeated mentions, exact text offsets, missing references, malformed numbering, multi-digit numbers, native-reference preservation, and Chinese/English aliases.
- Twelve browser-fixture assertions cover strict AutoLink state, native-reference identity, duplicate clicks, undo, missing references, invalid numbers, media-type rollback, subsequent user edits, mixed aliases and zero generation clicks.
- Version 1.0.3 was verified on a real LibTV canvas in normal and expanded editors with six mixed-language references in order `1, 2, 3, 3, 1, 2`. Persisted text and image identities matched; existing generation task, settings and output were unchanged. The production prompt was restored after the test.
- Version 1.0.4 changes icons and version presentation only; the user confirmed the new icon after reloading. It does not add a new binding implementation.

## Codex companion

- File preparation is tested on temporary directories: checksum/dimension validation, no-write dry run, initial copy, idempotence, recoverable backup, refusal to overwrite unrecognized directories, refusal of extra files and symbolic links, and broad-target protection.
- The Codex manifest, skill and marketplace are validated as packaged artifacts. First-time setup is a manual-onboarding skill, not a background hook or an MCP service.
- The installed Codex CLI recognized the companion as an available 1.0.4 plugin using read-only configuration overrides; this did not alter the publisher's installed plugins or configuration. A full fresh-account install and onboarding conversation have not been tested.
- Chrome system-page loading is user-confirmed, not an automated capability. Cross-platform path selection exists; Windows and Linux live browser loading have not been verified.
- Installing a Codex skill into a current conversation does not guarantee immediate skill discovery; a new conversation may be needed.

No private production screenshots are published as test evidence. Local fixtures are clearly labeled as mocks.
