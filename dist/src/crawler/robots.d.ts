/**
 * @nymrel/crawler-mesh
 * RFC 9309 Compliant robots.txt Parser
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
export declare class RobotsParser {
    private userAgentGroups;
    private sitemaps;
    constructor(robotsTxtContent?: string);
    parse(content: string): void;
    private findMatchingGroup;
    isAllowed(urlStr: string, userAgent?: string): boolean;
    getCrawlDelay(userAgent?: string): number | undefined;
    getSitemaps(): string[];
}
//# sourceMappingURL=robots.d.ts.map