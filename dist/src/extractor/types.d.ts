/**
 * @nymrel/crawler-mesh
 * Extractor Types
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { DiscoveredImage, DiscoveredLink, DocumentMetadata, ExtractedCodeBlock, ExtractedTable, ExtractionResult, ExtractorOptions } from '../types.js';
export type { DiscoveredImage, DiscoveredLink, DocumentMetadata, ExtractedCodeBlock, ExtractedTable, ExtractionResult, ExtractorOptions };
export type AstNodeType = 'root' | 'heading' | 'paragraph' | 'blockquote' | 'list' | 'listItem' | 'table' | 'tableHead' | 'tableBody' | 'tableRow' | 'tableCell' | 'codeBlock' | 'inlineCode' | 'link' | 'image' | 'strong' | 'emphasis' | 'strikethrough' | 'hr' | 'br' | 'text';
export interface AstNode {
    type: AstNodeType;
    level?: number;
    ordered?: boolean;
    start?: number;
    href?: string;
    src?: string;
    alt?: string;
    title?: string;
    language?: string;
    align?: 'left' | 'center' | 'right' | null;
    isHeader?: boolean;
    value?: string;
    children?: AstNode[];
}
//# sourceMappingURL=types.d.ts.map