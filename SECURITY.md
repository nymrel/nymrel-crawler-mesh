# Security policy

## Supported code

The current `main` branch and the most recent public release, when one exists, receive best-effort security maintenance. There is no guaranteed response or remediation SLA. As of 2026-08-29, this project has no npm or PyPI registry release.

## Reporting a vulnerability

Do not publish exploitable details in a public issue. Email `contact@nymrel.com` with the subject `[SECURITY] nymrel-crawler-mesh vulnerability report`, or use GitHub's private vulnerability-reporting surface when it is available for this repository.

Include the affected commit or version, runtime, reproduction steps, expected impact, and any suggested mitigation. Do not include credentials or unrelated private data.

## Security boundary

The crawler rejects non-HTTP(S) URLs, URL credentials, non-global address targets, unsafe redirect destinations, oversized bodies, and excessive redirects by default. Private-network access requires explicit configuration. For the built-in Node and Python transports, every request and redirect connects only to its validated address set while the original hostname remains authoritative for HTTP `Host` and TLS verification.

Those controls reduce common server-side request forgery paths, but they do not create a complete sandbox:

- A custom resolver, fetch function, or URL opener is trusted policy infrastructure; custom fetch/openers replace the built-in address-pinned transport.
- Host egress rules, proxies, and runtime-level DNS/network hooks remain outside the library's authority.
- A permissive outbound proxy can change the effective destination.
- Extracted remote content remains untrusted data.
- Parser work can still consume CPU and memory within the configured body limit.

For hostile or multi-tenant inputs, combine the library policy with network egress controls, process/container isolation, filesystem quotas, least-privilege execution, and explicit denial of cloud metadata and internal control-plane routes.

## Telemetry and local data

The library contains no analytics or usage telemetry. It necessarily sends HTTP requests to caller-selected targets. When caching is enabled, fetched HTML and metadata are written to the configured local cache directory. Protect or disable that cache when source content is sensitive.

## Release integrity

Release workflows are tag-gated, pin third-party actions by commit, build archives before publication, calculate checksums, and request build provenance. Registry publication additionally depends on operator-configured GitHub environments and npm/PyPI trusted publishers. A prepared workflow is not evidence that a package has been published.
