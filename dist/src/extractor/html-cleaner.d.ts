/**
 * @nymrel/crawler-mesh
 * HTML Sanitizer & Noise Stripper
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
export declare function decodeHtmlEntities(text: string): string;
export interface CleanHtmlOptions {
    baseUrl?: string;
    targetMainContent?: boolean;
    customRemoveSelectors?: string[];
}
export declare function cleanHtml(html: string, options?: CleanHtmlOptions): string;
//# sourceMappingURL=html-cleaner.d.ts.map