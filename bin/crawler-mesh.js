#!/usr/bin/env node

/**
 * @nymrel/crawler-mesh
 * CLI Entrypoint
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */

import { runCli } from '../dist/src/cli.js';

runCli(process.argv.slice(2))
  .then(code => {
    process.exit(code);
  })
  .catch(err => {
    console.error('Fatal Crawler Mesh Error:', err);
    process.exit(1);
  });
