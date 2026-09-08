import type { DriftReport, ScrapeContract } from './types.js';
export declare function digestJson(value: unknown): string;
export declare function evaluateSnapshot(contract: ScrapeContract, snapshotValue: unknown, baselineValue?: unknown): DriftReport;
//# sourceMappingURL=diff.d.ts.map