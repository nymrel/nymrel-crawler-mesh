import { createHash } from 'node:crypto';

import type {
  ContractValueType,
  DriftIssue,
  DriftReport,
  FieldContract,
  ScrapeContract
} from './types.js';

const MAX_ISSUES = 100;
const MAX_HEAL_PROMPT = 1000;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

export function digestJson(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  return `sha256:${createHash('sha256').update(serialized).digest('hex')}`;
}

function valueType(value: unknown): ContractValueType | 'missing' | 'null' {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'object';
}

function readPath(record: unknown, path: string): unknown {
  let current: unknown = record;
  for (const segment of path.split('.')) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function validateContract(contract: ScrapeContract): void {
  if (contract.schema !== 'nymrel.radar-heal.contract.v1') {
    throw new Error('unsupported RadarHeal contract schema');
  }
  if (!contract.name.trim()) {
    throw new Error('contract name must not be empty');
  }
  if (!Array.isArray(contract.fields) || contract.fields.length === 0) {
    throw new Error('contract fields must be a non-empty array');
  }
  const seen = new Set<string>();
  for (const field of contract.fields) {
    if (!field.path.trim() || field.path.startsWith('.') || field.path.endsWith('.')) {
      throw new Error(`invalid contract field path: ${field.path}`);
    }
    if (seen.has(field.path)) {
      throw new Error(`duplicate contract field path: ${field.path}`);
    }
    seen.add(field.path);
  }
  if (contract.minRecords !== undefined && (!Number.isInteger(contract.minRecords) || contract.minRecords < 0)) {
    throw new Error('minRecords must be a non-negative integer');
  }
}

function ensureRecords(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array`);
  }
  return value.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${label}[${index}] must be a JSON object`);
    }
    return item as Record<string, unknown>;
  });
}

function presentRatio(records: Record<string, unknown>[], field: FieldContract): number {
  if (records.length === 0) return 0;
  const present = records.filter((record) => {
    const value = readPath(record, field.path);
    return value !== undefined && value !== null && value !== '';
  }).length;
  return present / records.length;
}

function addIssue(issues: DriftIssue[], issue: DriftIssue): void {
  if (issues.length < MAX_ISSUES) issues.push(issue);
}

function makeHealPrompt(contract: ScrapeContract, issues: DriftIssue[]): string | null {
  if (issues.length === 0) return null;
  const grouped = new Map<string, Set<string>>();
  for (const issue of issues) {
    const reasons = grouped.get(issue.path) ?? new Set<string>();
    reasons.add(`${issue.code}: expected ${issue.expected}, observed ${issue.observed}`);
    grouped.set(issue.path, reasons);
  }
  const details = [...grouped.entries()]
    .slice(0, 12)
    .map(([path, reasons]) => `${path} (${[...reasons].join('; ')})`)
    .join(', ');
  const prompt = [
    `Repair scraper output for contract "${contract.name}".`,
    `The current run drifted at: ${details}.`,
    'Preserve the existing collector id and output schema.',
    'Return all required fields with the declared types.',
    'Do not add private, login-protected, paywalled, personal, or restricted data.'
  ].join(' ');
  return prompt.slice(0, MAX_HEAL_PROMPT);
}

export function evaluateSnapshot(
  contract: ScrapeContract,
  snapshotValue: unknown,
  baselineValue?: unknown
): DriftReport {
  validateContract(contract);
  const records = ensureRecords(snapshotValue, 'snapshot');
  const baseline = baselineValue === undefined ? null : ensureRecords(baselineValue, 'baseline');
  const issues: DriftIssue[] = [];

  const minimum = contract.minRecords ?? 1;
  if (records.length < minimum) {
    addIssue(issues, {
      code: 'record_count_below_minimum',
      path: '$',
      recordIndex: null,
      expected: `at least ${minimum} records`,
      observed: `${records.length} records`
    });
  }

  records.forEach((record, recordIndex) => {
    for (const field of contract.fields) {
      const value = readPath(record, field.path);
      const observed = valueType(value);
      if (field.required && observed === 'missing') {
        addIssue(issues, {
          code: 'missing_required',
          path: field.path,
          recordIndex,
          expected: field.type,
          observed
        });
        continue;
      }
      if (field.required && (observed === 'null' || value === '')) {
        addIssue(issues, {
          code: 'empty_required',
          path: field.path,
          recordIndex,
          expected: field.type,
          observed: observed === 'string' ? 'empty string' : observed
        });
        continue;
      }
      if (observed !== 'missing' && observed !== 'null' && observed !== field.type) {
        addIssue(issues, {
          code: 'type_mismatch',
          path: field.path,
          recordIndex,
          expected: field.type,
          observed
        });
      }
    }
  });

  if (baseline !== null && baseline.length > 0 && records.length > 0) {
    for (const field of contract.fields) {
      const before = presentRatio(baseline, field);
      const after = presentRatio(records, field);
      if (before >= 0.8 && after < before * 0.5) {
        addIssue(issues, {
          code: 'baseline_presence_drop',
          path: field.path,
          recordIndex: null,
          expected: `presence ratio near ${before.toFixed(2)}`,
          observed: `presence ratio ${after.toFixed(2)}`
        });
      }
    }
  }

  const affectedPaths = [...new Set(issues.map((issue) => issue.path))].sort();
  return {
    schema: 'nymrel.radar-heal.report.v1',
    status: issues.length === 0 ? 'pass' : 'drift',
    contractName: contract.name,
    contractDigest: digestJson(contract),
    snapshotDigest: digestJson(records),
    baselineDigest: baseline === null ? null : digestJson(baseline),
    summary: {
      baselineCompared: baseline !== null,
      issueCount: issues.length,
      recordCount: records.length,
      affectedPaths
    },
    issues,
    healPrompt: makeHealPrompt(contract, issues),
    claims: {
      rawValuesIncluded: false,
      scraperHealed: false,
      verificationIsCertification: false
    }
  };
}
