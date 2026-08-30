# Contributing to nymrel-crawler-mesh

Contributions should preserve bounded network behavior, deterministic tests, and honest cross-runtime documentation.

## Development setup

Use Node.js 22.19 or newer and Python 3.11 or newer. The repository defaults are recorded in `.node-version` and `.python-version`.

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
npm pack --dry-run --ignore-scripts
```

On PowerShell, run the Python suite against the checked-out source:

```powershell
$env:PYTHONPATH = (Resolve-Path '.\python').Path
python -m unittest discover -s tests -p 'test_*.py' -v
```

Optional local correctness tooling should match CI:

```bash
uvx ruff@0.16.5 check python tests
uvx pip-audit@2.10.1 .
```

## Change requirements

1. Keep crawler-controlled requests behind the shared outbound policy. Do not introduce direct remote reads in a CLI, sitemap, robots, or helper path.
2. Add deterministic tests that do not depend on the public internet.
3. Maintain equivalent safety semantics in TypeScript and Python when both engines expose the affected capability. Document intentional differences.
4. Do not weaken URL, redirect, body-size, page-count, timeout, robots, or domain boundaries for convenience.
5. Treat fetched content, error payloads, URLs, and headers as untrusted. Do not echo embedded credentials or secrets.
6. Preserve the resolved-address connection pin: the transport may retain the original hostname for `Host` and TLS verification, but it must not perform an unvalidated second hostname resolution.
7. Keep dependencies minimal, locked where applicable, and justified by a concrete contract.
8. Update README and security documentation when public behavior changes.

## Pull requests

Keep commits scoped and explain the behavior, risk, and proof. A useful pull request includes the exact commands run and calls out anything that requires registry, environment, or account configuration. Do not claim a deployment or package publication from local build output alone.

Be respectful and collaborative in project discussions. Security reports belong in the private route described in `SECURITY.md`.
