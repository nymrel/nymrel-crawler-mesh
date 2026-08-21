/**
 * @nymrel/crawler-mesh
 * HTML Sanitizer & Noise Stripper
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
export function decodeHtmlEntities(text) {
    if (!text)
        return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
export function cleanHtml(html, options = {}) {
    let cleaned = html;
    // 1. Remove HTML comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    // 2. Remove script, style, noscript, svg, iframe, canvas, audio, video, template, object, embed
    const tagsToRemove = [
        'script', 'style', 'noscript', 'svg', 'iframe', 'canvas', 'audio',
        'video', 'template', 'object', 'embed', 'head'
    ];
    for (const tag of tagsToRemove) {
        const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        cleaned = cleaned.replace(regex, '');
        // Self-closing / unclosed instances
        cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
    }
    // 3. Remove layout containers (nav, header, footer, aside, menu, dialog)
    const layoutTags = ['nav', 'footer', 'aside', 'menu', 'dialog'];
    for (const tag of layoutTags) {
        const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        cleaned = cleaned.replace(regex, '');
    }
    // 4. Remove tracking pixels (1x1 images, display:none images)
    cleaned = cleaned.replace(/<img\b[^>]*\b(width=["']1["']|height=["']1["']|style=["'][^"']*display:\s*none[^"']*["'])[^>]*\/?>/gi, '');
    // 5. Remove ad / cookie / popup / modal / newsletter / social banner elements by class/id/role heuristics
    const noisePatterns = [
        /(?:class|id)=["'][^"']*\b(ad-container|ad-wrapper|ad-banner|adsbygoogle|banner-ad|cookie-banner|cookie-consent|cookie-notice|popup-overlay|modal-overlay|newsletter-signup|social-share|share-buttons|site-footer|disclaimer-banner)\b[^"']*["']/gi,
        /role=["'](?:banner|navigation|dialog|alertdialog|contentinfo)["']/gi,
        /aria-hidden=["']true["']/gi
    ];
    // Helper: recursively strip matched divs/sections with noisy classes
    const noiseRegex = /<(div|section|aside|div|span|p|ul|ol|form)\b([^>]*\b(?:ad-container|ad-wrapper|ad-banner|adsbygoogle|cookie-banner|cookie-consent|cookie-notice|popup|modal|social-share|newsletter-signup)[^>]*)>([\s\S]*?)<\/\1>/gi;
    cleaned = cleaned.replace(noiseRegex, '');
    // 6. Target main content if enabled (<article>, <main>, or [role="main"])
    if (options.targetMainContent !== false) {
        const mainMatch = cleaned.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
        if (mainMatch && mainMatch[2].trim().length > 100) {
            cleaned = mainMatch[2];
        }
        else {
            const roleMainMatch = cleaned.match(/<([a-z0-9]+)\b[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/\1>/i);
            if (roleMainMatch && roleMainMatch[2].trim().length > 100) {
                cleaned = roleMainMatch[2];
            }
        }
    }
    return cleaned.trim();
}
//# sourceMappingURL=html-cleaner.js.map