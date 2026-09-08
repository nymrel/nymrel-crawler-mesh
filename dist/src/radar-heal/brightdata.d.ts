import type { HealCommand, HealProposalResult } from './types.js';
export declare function validateHealCommand(command: HealCommand): HealCommand;
export declare function buildHealCommand(collectorId: string, prompt: string, targetUrl: string): HealCommand;
export declare function runHealProposal(command: HealCommand, timeoutMs?: number): Promise<HealProposalResult>;
//# sourceMappingURL=brightdata.d.ts.map