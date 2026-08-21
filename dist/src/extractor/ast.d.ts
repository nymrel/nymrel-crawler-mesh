/**
 * @nymrel/crawler-mesh
 * Semantic HTML AST Builder & Markdown Generator
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import type { AstNode, ExtractedCodeBlock, ExtractedTable } from './types.js';
interface HtmlToken {
    type: 'openTag' | 'closeTag' | 'selfClosingTag' | 'text' | 'comment';
    tagName?: string;
    attributes?: Record<string, string>;
    raw?: string;
    text?: string;
}
export declare function parseAttributes(attrString: string): Record<string, string>;
export declare function tokenizeHtml(html: string): HtmlToken[];
export declare class HtmlToAstParser {
    private baseUrl?;
    constructor(baseUrl?: string);
    private resolveUrl;
    parse(html: string): AstNode;
}
export declare function astToMarkdown(node: AstNode, listDepth?: number, isInsideTable?: boolean): string;
export declare function extractTablesFromAst(tableNode: AstNode): ExtractedTable[];
export declare function extractCodeBlocksFromAst(node: AstNode): ExtractedCodeBlock[];
export {};
//# sourceMappingURL=ast.d.ts.map