#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { buildHealCommand, runHealProposal } from './brightdata.js';
import { evaluateSnapshot } from './diff.js';
function usage() {
    return [
        'RadarHeal — deterministic Bright Data scraper drift detection',
        '',
        'Check structured output:',
        '  radar-heal check --contract contract.json --input snapshot.json',
        '    [--baseline previous.json] [--output report.json]',
        '',
        'Prepare a Bright Data self-heal proposal:',
        '  radar-heal heal --report report.json --collector c_xxx --url https://example.com',
        '    [--execute] [--output heal-proposal.json]',
        '',
        'Without --execute, heal prints the exact approval-gated CLI invocation.',
        'With --execute, Bright Data may propose a remote scraper mutation, but RadarHeal',
        'never auto-approves or commits the change.'
    ].join('\n');
}
function parseOptions(args) {
    const values = new Map();
    const flags = new Set();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token.startsWith('--')) {
            throw new Error(`unexpected argument: ${token}`);
        }
        if (token === '--execute' || token === '--help') {
            flags.add(token);
            continue;
        }
        const next = args[index + 1];
        if (next === undefined || next.startsWith('--')) {
            throw new Error(`missing value for ${token}`);
        }
        values.set(token, next);
        index += 1;
    }
    return { values, flags };
}
function required(options, name) {
    const value = options.values.get(name);
    if (!value)
        throw new Error(`missing required option ${name}`);
    return value;
}
async function readJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}
async function emit(value, outputPath) {
    const rendered = `${JSON.stringify(value, null, 2)}\n`;
    if (outputPath) {
        await writeFile(outputPath, rendered, 'utf8');
    }
    else {
        process.stdout.write(rendered);
    }
}
function asContract(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('contract must be a JSON object');
    }
    return value;
}
function asReport(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('report must be a JSON object');
    }
    const report = value;
    if (report.schema !== 'nymrel.radar-heal.report.v1') {
        throw new Error('unsupported RadarHeal report schema');
    }
    return report;
}
async function runCheck(options) {
    const contract = asContract(await readJson(required(options, '--contract')));
    const snapshot = await readJson(required(options, '--input'));
    const baselinePath = options.values.get('--baseline');
    const baseline = baselinePath ? await readJson(baselinePath) : undefined;
    const report = evaluateSnapshot(contract, snapshot, baseline);
    await emit(report, options.values.get('--output'));
    return report.status === 'pass' ? 0 : 2;
}
async function runHeal(options) {
    const report = asReport(await readJson(required(options, '--report')));
    if (report.status !== 'drift' || !report.healPrompt) {
        throw new Error('heal requires a drift report with a bounded heal prompt');
    }
    const command = buildHealCommand(required(options, '--collector'), report.healPrompt, required(options, '--url'));
    if (!options.flags.has('--execute')) {
        await emit({
            schema: 'nymrel.radar-heal.heal-plan.v1',
            command,
            approvalRequired: true,
            note: 'Run again with --execute to request a Bright Data proposal. Review preview_result before separately approving it.'
        }, options.values.get('--output'));
        return 0;
    }
    const result = await runHealProposal(command);
    await emit({
        schema: 'nymrel.radar-heal.heal-proposal.v1',
        command: {
            executable: command.executable,
            args: command.args,
            autoApprove: false
        },
        result,
        approvalRequired: true
    }, options.values.get('--output'));
    return result.exitCode;
}
async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (!command || command === '--help' || command === 'help') {
        process.stdout.write(`${usage()}\n`);
        return 0;
    }
    const options = parseOptions(args);
    if (options.flags.has('--help')) {
        process.stdout.write(`${usage()}\n`);
        return 0;
    }
    if (command === 'check')
        return runCheck(options);
    if (command === 'heal')
        return runHeal(options);
    throw new Error(`unknown command: ${command}`);
}
main()
    .then((code) => {
    process.exitCode = code;
})
    .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`RadarHeal error: ${message}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map