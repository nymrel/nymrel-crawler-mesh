# Security Policy

## Zero-Telemetry & Privacy Guarantee

`nymrel-crawler-mesh` is designed with strict **zero-telemetry** principles:
- **No Phone-Home**: This library and CLI never send telemetry, analytics, tracking pings, or usage statistics to external servers.
- **Local Compute**: All HTML-to-Markdown parsing, AST transforms, deduplication hashing, and token estimation happen 100% locally on your machine.
- **Header Control**: Request headers and User-Agent strings are fully configurable.
- **No Third-Party Analytics**: No embedded trackers, tracking pixels, or diagnostic beacons are ever injected into crawled payloads.

## Reporting a Vulnerability

If you discover a security vulnerability within `nymrel-crawler-mesh`, please do not open a public GitHub issue. Instead, report it directly to the security and engineering team:

- **Security Email**: `contact@nymrel.com`
- **Subject**: `[SECURITY] nymrel-crawler-mesh Vulnerability Report`
- **Response SLA**: Initial triage within 24 hours.

Please include:
1. Steps to reproduce the issue or proof-of-concept payload.
2. Affected version(s) of the TypeScript or Python engine.
3. Potential impact assessment.

## Supported Versions

| Version | Supported |
|---|---|
| `1.0.x` | ✅ Active Security Support |
