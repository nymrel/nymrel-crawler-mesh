/**
 * @nymrel/crawler-mesh
 * Semantic Markdown & Structured Data Extractor
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { DiscoveredImage, DiscoveredLink, DocumentMetadata, ExtractionResult, ExtractorOptions } from './types.js';
export * from './types.js';
export * from './html-cleaner.js';
export * from './ast.js';
export declare function extractMetadata(html: string, baseUrl?: string): DocumentMetadata;
export declare function extractLinksAndImages(html: string, baseUrl?: string): {
    links: DiscoveredLink[];
    images: DiscoveredImage[];
};
export declare function extractMarkdown(rawHtml: string, options?: ExtractorOptions): ExtractionResult;
//# sourceMappingURL=index.d.ts.map