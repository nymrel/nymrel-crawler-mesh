# RadarHeal — Scrape-Verse competition slice

RadarHeal is a bounded health and repair layer for **Bright Data Scraper Studio** collectors. It validates structured public-web output against an explicit contract, compares the run with an optional healthy baseline, emits a redacted evidence report, and prepares a precise Bright Data self-healing request when drift is detected.

This slice was created during the August 17–23, 2026 Scrape-Verse build window. Bright Data Scraper Studio must remain central to any competition submission: create a custom collector in Scraper Studio, run it through the Bright Data CLI/API, feed the resulting JSON to RadarHeal, and use the generated prompt with `bdata scraper heal` when the output breaks.

## Why it exists

A scraper can return HTTP 200 while silently losing fields or changing types. RadarHeal treats the **structured output contract** as the invariant rather than trusting selectors or status codes.

It detects:

- missing required fields;
- empty required fields;
- type changes;
- record-count collapse;
- large field-presence drops relative to a healthy baseline.

Reports contain paths, types, counts, digests, and reason codes—never raw scraped values. A report proves only that this validator observed the supplied output and found or did not find contract drift. It is not security, privacy, legal, or data-quality certification.

## Local demonstration

```bash
npm install
npm run build

# Healthy output
node dist/src/radar-heal/cli.js check \
  --contract examples/radar-heal/contract.json \
  --input examples/radar-heal/baseline.json

# Drifted output with baseline comparison
node dist/src/radar-heal/cli.js check \
  --contract examples/radar-heal/contract.json \
  --input examples/radar-heal/drifted.json \
  --baseline examples/radar-heal/baseline.json \
  --output radar-report.json
```

A drift result intentionally exits with code `2`, which makes it usable as a CI or agent gate.

## Bright Data loop

Install and authenticate the official Bright Data CLI outside Git history:

```bash
npm install -g @brightdata/cli@0.3.2
brightdata login
```

Create a custom Scraper Studio collector from a coding-agent workflow, save it to production, and run it:

```bash
bdata scraper create "Collect public release title, URL, publication time, summary, and tags from TARGET" \
  --url https://public.example/releases

bdata scraper run c_your_collector https://public.example/releases \
  --json -o current.json
```

Validate the result:

```bash
radar-heal check \
  --contract examples/radar-heal/contract.json \
  --input current.json \
  --baseline previous-healthy.json \
  --output radar-report.json
```

Prepare the exact self-heal command without making a remote change:

```bash
radar-heal heal \
  --report radar-report.json \
  --collector c_your_collector \
  --url https://public.example/releases
```

Request a Bright Data repair proposal:

```bash
radar-heal heal \
  --report radar-report.json \
  --collector c_your_collector \
  --url https://public.example/releases \
  --execute \
  --output heal-proposal.json
```

The adapter pins `@brightdata/cli@0.3.2`, invokes it without a shell, and **never passes `--auto-approve`**. Bright Data should stop at `awaiting_approval`; review `preview_result`, then approve or reject with the official CLI. Approval is intentionally outside RadarHeal.

## Competition demo plan

1. Show a healthy custom Scraper Studio collector returning the declared schema.
2. Feed a fixture or controlled public page redesign that drops/moves fields.
3. Show RadarHeal produce a redacted drift receipt and specific repair prompt.
4. Run the Bright Data heal proposal and stop at the approval gate.
5. Review the preview, approve through the official CLI, and re-run the collector.
6. Show the same contract passing without changing downstream code.

## Data boundary

Use public data only. Do not collect private, login-protected, paywalled, personal, restricted, or government-site data for this demo. Never commit Bright Data API keys, OAuth material, collector secrets, `.env` files, raw personal data, or account screenshots.

## Remaining external setup

The repository code and fixtures can be tested without an account. A complete competition entry still requires:

- WeMakeDevs registration and official submission form;
- a Bright Data account and project-scoped credential;
- a custom Scraper Studio collector and collector ID;
- a real public-data run and self-healing demonstration;
- public demo video and final submission before the official deadline.
