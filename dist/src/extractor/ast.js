/**
 * @nymrel/crawler-mesh
 * Semantic HTML AST Builder & Markdown Generator
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import { decodeHtmlEntities } from './html-cleaner.js';
export function parseAttributes(attrString) {
    const attrs = {};
    const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = attrRegex.exec(attrString)) !== null) {
        const name = match[1].toLowerCase();
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        attrs[name] = decodeHtmlEntities(value);
    }
    return attrs;
}
export function tokenizeHtml(html) {
    const tokens = [];
    const tagRegex = /<(!?[\w:-]+)([^>]*)>|<\/([\w:-]+)>|<!--[\s\S]*?-->|([^<]+)/gi;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
        const [raw, openTagName, attrString, closeTagName, textContent] = match;
        if (raw.startsWith('<!--')) {
            tokens.push({ type: 'comment', raw });
        }
        else if (closeTagName) {
            tokens.push({
                type: 'closeTag',
                tagName: closeTagName.toLowerCase()
            });
        }
        else if (openTagName) {
            const tagName = openTagName.toLowerCase();
            const isSelfClosing = raw.endsWith('/>') || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName);
            const attributes = parseAttributes(attrString || '');
            tokens.push({
                type: isSelfClosing ? 'selfClosingTag' : 'openTag',
                tagName,
                attributes,
                raw
            });
        }
        else if (textContent) {
            tokens.push({
                type: 'text',
                text: textContent
            });
        }
    }
    return tokens;
}
export class HtmlToAstParser {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    resolveUrl(href) {
        if (!this.baseUrl || !href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
            return href;
        }
        try {
            return new URL(href, this.baseUrl).toString();
        }
        catch {
            return href;
        }
    }
    parse(html) {
        const tokens = tokenizeHtml(html);
        const root = { type: 'root', children: [] };
        const stack = [{ node: root }];
        let inPre = false;
        let preContent = '';
        let preLang = '';
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const currentParent = stack[stack.length - 1].node;
            if (token.type === 'comment') {
                continue;
            }
            if (inPre) {
                if (token.type === 'closeTag' && (token.tagName === 'pre' || token.tagName === 'code')) {
                    if (token.tagName === 'pre') {
                        inPre = false;
                        currentParent.children?.push({
                            type: 'codeBlock',
                            language: preLang,
                            value: decodeHtmlEntities(preContent.trimEnd())
                        });
                        preContent = '';
                        preLang = '';
                    }
                }
                else {
                    preContent += token.raw || token.text || '';
                }
                continue;
            }
            if (token.type === 'openTag' && token.tagName === 'pre') {
                inPre = true;
                preContent = '';
                preLang = '';
                // Check if next token is <code class="language-xyz">
                if (tokens[i + 1]?.type === 'openTag' && tokens[i + 1]?.tagName === 'code') {
                    const codeClass = tokens[i + 1]?.attributes?.['class'] || '';
                    const langMatch = codeClass.match(/language-([a-zA-Z0-9_-]+)/i);
                    if (langMatch) {
                        preLang = langMatch[1];
                    }
                    i++; // Skip inner code tag
                }
                continue;
            }
            if (token.type === 'openTag') {
                const tagName = token.tagName;
                let node = null;
                if (/^h([1-6])$/.test(tagName)) {
                    const level = parseInt(tagName[1], 10);
                    node = { type: 'heading', level, children: [] };
                }
                else if (tagName === 'p') {
                    node = { type: 'paragraph', children: [] };
                }
                else if (tagName === 'blockquote') {
                    node = { type: 'blockquote', children: [] };
                }
                else if (tagName === 'ul' || tagName === 'ol') {
                    node = {
                        type: 'list',
                        ordered: tagName === 'ol',
                        start: token.attributes?.['start'] ? parseInt(token.attributes['start'], 10) : 1,
                        children: []
                    };
                }
                else if (tagName === 'li') {
                    node = { type: 'listItem', children: [] };
                }
                else if (tagName === 'table') {
                    node = { type: 'table', children: [] };
                }
                else if (tagName === 'thead') {
                    node = { type: 'tableHead', children: [] };
                }
                else if (tagName === 'tbody') {
                    node = { type: 'tableBody', children: [] };
                }
                else if (tagName === 'tr') {
                    node = { type: 'tableRow', children: [] };
                }
                else if (tagName === 'th' || tagName === 'td') {
                    node = {
                        type: 'tableCell',
                        isHeader: tagName === 'th',
                        align: token.attributes?.['align'] || null,
                        children: []
                    };
                }
                else if (tagName === 'code') {
                    node = { type: 'inlineCode', children: [] };
                }
                else if (tagName === 'a') {
                    const href = this.resolveUrl(token.attributes?.['href'] || '');
                    if (!href.startsWith('javascript:')) {
                        node = { type: 'link', href, title: token.attributes?.['title'], children: [] };
                    }
                }
                else if (tagName === 'strong' || tagName === 'b') {
                    node = { type: 'strong', children: [] };
                }
                else if (tagName === 'em' || tagName === 'i') {
                    node = { type: 'emphasis', children: [] };
                }
                else if (tagName === 'del' || tagName === 's' || tagName === 'strike') {
                    node = { type: 'strikethrough', children: [] };
                }
                else {
                    // Pass-through container (div, span, section, etc.)
                    node = { type: 'paragraph', children: [] };
                }
                if (node) {
                    if (!currentParent.children)
                        currentParent.children = [];
                    currentParent.children.push(node);
                    stack.push({ node, tagName });
                }
            }
            else if (token.type === 'closeTag') {
                const tagName = token.tagName;
                // Find matching tag on stack
                for (let j = stack.length - 1; j > 0; j--) {
                    if (stack[j].tagName === tagName) {
                        stack.splice(j);
                        break;
                    }
                }
            }
            else if (token.type === 'selfClosingTag') {
                const tagName = token.tagName;
                if (tagName === 'br') {
                    if (!currentParent.children)
                        currentParent.children = [];
                    currentParent.children.push({ type: 'br' });
                }
                else if (tagName === 'hr') {
                    if (!currentParent.children)
                        currentParent.children = [];
                    currentParent.children.push({ type: 'hr' });
                }
                else if (tagName === 'img') {
                    const src = this.resolveUrl(token.attributes?.['src'] || '');
                    const alt = token.attributes?.['alt'] || '';
                    const title = token.attributes?.['title'];
                    if (src) {
                        if (!currentParent.children)
                            currentParent.children = [];
                        currentParent.children.push({ type: 'image', src, alt, title });
                    }
                }
            }
            else if (token.type === 'text') {
                const text = decodeHtmlEntities(token.text || '');
                if (text) {
                    if (!currentParent.children)
                        currentParent.children = [];
                    currentParent.children.push({ type: 'text', value: text });
                }
            }
        }
        return root;
    }
}
export function astToMarkdown(node, listDepth = 0, isInsideTable = false) {
    if (!node)
        return '';
    switch (node.type) {
        case 'root': {
            return (node.children || [])
                .map(child => astToMarkdown(child, listDepth, isInsideTable))
                .filter(s => s.trim().length > 0)
                .join('\n\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }
        case 'heading': {
            const hashes = '#'.repeat(node.level || 1);
            const text = renderInlineText(node.children || [], isInsideTable);
            return `${hashes} ${text}`;
        }
        case 'paragraph': {
            const text = renderInlineText(node.children || [], isInsideTable);
            return text.trim();
        }
        case 'blockquote': {
            const inner = (node.children || [])
                .map(child => astToMarkdown(child, listDepth, isInsideTable))
                .filter(Boolean)
                .join('\n\n');
            return inner
                .split('\n')
                .map(line => `> ${line}`)
                .join('\n');
        }
        case 'list': {
            const isOrdered = node.ordered ?? false;
            let counter = node.start ?? 1;
            const items = (node.children || []).map(child => {
                const prefix = isOrdered ? `${counter++}. ` : '- ';
                const indent = '  '.repeat(listDepth);
                const itemContent = astToMarkdown(child, listDepth + 1, isInsideTable);
                return `${indent}${prefix}${itemContent}`;
            });
            return items.join('\n');
        }
        case 'listItem': {
            return renderInlineText(node.children || [], isInsideTable);
        }
        case 'table': {
            return renderTableToMarkdown(node);
        }
        case 'codeBlock': {
            const lang = node.language || '';
            const code = node.value || '';
            return `\`\`\`${lang}\n${code}\n\`\`\``;
        }
        case 'hr': {
            return '---';
        }
        case 'br': {
            return '\n';
        }
        default:
            return renderInlineText([node], isInsideTable);
    }
}
function renderInlineText(children, isInsideTable) {
    let result = '';
    for (const child of children) {
        switch (child.type) {
            case 'text':
                let val = child.value || '';
                if (isInsideTable) {
                    val = val.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
                }
                result += val;
                break;
            case 'strong':
                result += `**${renderInlineText(child.children || [], isInsideTable).trim()}**`;
                break;
            case 'emphasis':
                result += `*${renderInlineText(child.children || [], isInsideTable).trim()}*`;
                break;
            case 'strikethrough':
                result += `~~${renderInlineText(child.children || [], isInsideTable).trim()}~~`;
                break;
            case 'inlineCode':
                result += `\`${renderInlineText(child.children || [], isInsideTable).trim()}\``;
                break;
            case 'link':
                const linkText = renderInlineText(child.children || [], isInsideTable).trim() || child.href || '';
                result += `[${linkText}](${child.href || ''})`;
                break;
            case 'image':
                result += `![${child.alt || ''}](${child.src || ''}${child.title ? ` "${child.title}"` : ''})`;
                break;
            case 'br':
                result += isInsideTable ? ' ' : '\n';
                break;
            case 'hr':
                result += '\n---\n';
                break;
            default:
                if (child.children) {
                    result += renderInlineText(child.children, isInsideTable);
                }
                break;
        }
    }
    return result;
}
function renderTableToMarkdown(tableNode) {
    const rows = [];
    function collectRows(node) {
        if (node.type === 'tableRow') {
            rows.push(node);
        }
        else if (node.children) {
            for (const child of node.children) {
                collectRows(child);
            }
        }
    }
    collectRows(tableNode);
    if (rows.length === 0)
        return '';
    const matrix = [];
    let maxCols = 0;
    for (const row of rows) {
        const rowCells = [];
        for (const cell of row.children || []) {
            if (cell.type === 'tableCell') {
                const text = renderInlineText(cell.children || [], true).trim();
                rowCells.push(text || ' ');
            }
        }
        if (rowCells.length > maxCols)
            maxCols = rowCells.length;
        matrix.push(rowCells);
    }
    if (maxCols === 0)
        return '';
    // Pad rows to equal column length
    for (const row of matrix) {
        while (row.length < maxCols) {
            row.push(' ');
        }
    }
    // Calculate column widths
    const colWidths = new Array(maxCols).fill(3);
    for (const row of matrix) {
        for (let c = 0; c < maxCols; c++) {
            colWidths[c] = Math.max(colWidths[c], row[c].length);
        }
    }
    const lines = [];
    // First row
    const headerRow = matrix[0];
    const headerLine = '| ' + headerRow.map((cell, c) => cell.padEnd(colWidths[c])).join(' | ') + ' |';
    const separatorLine = '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |';
    lines.push(headerLine);
    lines.push(separatorLine);
    for (let r = 1; r < matrix.length; r++) {
        const rowLine = '| ' + matrix[r].map((cell, c) => cell.padEnd(colWidths[c])).join(' | ') + ' |';
        lines.push(rowLine);
    }
    return lines.join('\n');
}
export function extractTablesFromAst(tableNode) {
    const tables = [];
    function visit(node) {
        if (node.type === 'table') {
            const rows = [];
            let headers = [];
            for (const section of node.children || []) {
                for (const row of section.children || (section.type === 'tableRow' ? [section] : [])) {
                    if (row.type === 'tableRow') {
                        const cells = (row.children || [])
                            .filter(c => c.type === 'tableCell')
                            .map(c => renderInlineText(c.children || [], true).trim());
                        const isHead = (row.children || []).some(c => c.isHeader) || section.type === 'tableHead';
                        if (isHead && headers.length === 0) {
                            headers = cells;
                        }
                        else {
                            rows.push(cells);
                        }
                    }
                }
            }
            if (headers.length === 0 && rows.length > 0) {
                headers = rows.shift() || [];
            }
            tables.push({ headers, rows });
        }
        else if (node.children) {
            for (const child of node.children) {
                visit(child);
            }
        }
    }
    visit(tableNode);
    return tables;
}
export function extractCodeBlocksFromAst(node) {
    const blocks = [];
    function visit(n) {
        if (n.type === 'codeBlock') {
            blocks.push({
                language: n.language || 'text',
                code: n.value || ''
            });
        }
        else if (n.children) {
            for (const child of n.children) {
                visit(child);
            }
        }
    }
    visit(node);
    return blocks;
}
//# sourceMappingURL=ast.js.map