export type ContractValueType = 'array' | 'boolean' | 'number' | 'object' | 'string';
export interface FieldContract {
    path: string;
    required?: boolean;
    type: ContractValueType;
}
export interface ScrapeContract {
    schema: 'nymrel.radar-heal.contract.v1';
    name: string;
    minRecords?: number;
    fields: FieldContract[];
}
export type DriftCode = 'baseline_presence_drop' | 'empty_required' | 'missing_required' | 'record_count_below_minimum' | 'type_mismatch';
export interface DriftIssue {
    code: DriftCode;
    path: string;
    recordIndex: number | null;
    expected: string;
    observed: string;
}
export interface DriftSummary {
    baselineCompared: boolean;
    issueCount: number;
    recordCount: number;
    affectedPaths: string[];
}
export interface DriftReport {
    schema: 'nymrel.radar-heal.report.v1';
    status: 'drift' | 'pass';
    contractName: string;
    contractDigest: string;
    snapshotDigest: string;
    baselineDigest: string | null;
    summary: DriftSummary;
    issues: DriftIssue[];
    healPrompt: string | null;
    claims: {
        rawValuesIncluded: false;
        scraperHealed: false;
        verificationIsCertification: false;
    };
}
export interface HealCommand {
    executable: string;
    args: string[];
    mutatesRemoteScraper: true;
    autoApprove: false;
}
export interface HealProposalResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}
//# sourceMappingURL=types.d.ts.map