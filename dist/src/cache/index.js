/**
 * @nymrel/crawler-mesh
 * Content-Hash SHA-256 Caching Layer
 * Copyright (c) 2026 Nymrel / JalenBuilds LLC
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export function computeSha256(content) {
    return createHash('sha256').update(content).digest('hex');
}
export function normalizeUrlKey(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        // Remove hash fragment and sort search params
        parsed.hash = '';
        // Strip common tracking query params
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid'
        ];
        for (const param of trackingParams) {
            parsed.searchParams.delete(param);
        }
        parsed.searchParams.sort();
        return parsed.toString();
    }
    catch {
        return rawUrl.trim();
    }
}
export class ContentCache {
    enabled;
    cacheDir;
    ttlSeconds;
    inMemory;
    memoryStore = new Map();
    maxMemoryEntries;
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.cacheDir = path.resolve(options.cacheDir || '.crawler-cache');
        this.ttlSeconds = options.ttlSeconds ?? 86400; // 24 hours default
        this.inMemory = options.inMemory ?? false;
        this.maxMemoryEntries = options.maxMemoryEntries ?? 5000;
    }
    computeHash(content) {
        return computeSha256(content);
    }
    getDiskPath(urlKey) {
        const hash = computeSha256(urlKey);
        const subDir = path.join(this.cacheDir, hash.substring(0, 2));
        const metaPath = path.join(subDir, `${hash}.meta.json`);
        const bodyPath = path.join(subDir, `${hash}.body.html`);
        return { metaPath, bodyPath };
    }
    async get(rawUrl) {
        if (!this.enabled)
            return null;
        const urlKey = normalizeUrlKey(rawUrl);
        // 1. Check in-memory store
        const memEntry = this.memoryStore.get(urlKey);
        if (memEntry) {
            if (Date.now() < memEntry.expiresAt) {
                return memEntry;
            }
            this.memoryStore.delete(urlKey);
        }
        if (this.inMemory)
            return null;
        // 2. Check filesystem store
        try {
            const { metaPath, bodyPath } = this.getDiskPath(urlKey);
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaContent);
            if (Date.now() >= meta.expiresAt) {
                // Expired, cleanup
                await this.delete(rawUrl);
                return null;
            }
            let html = '';
            try {
                html = await fs.readFile(bodyPath, 'utf-8');
            }
            catch {
                html = meta.html || '';
            }
            const fullEntry = {
                ...meta,
                html
            };
            // Populate memory store for fast repeated hits
            this.setInMemory(urlKey, fullEntry);
            return fullEntry;
        }
        catch {
            return null;
        }
    }
    async set(rawUrl, entry) {
        const urlKey = normalizeUrlKey(rawUrl);
        const now = Date.now();
        const expiresAt = now + this.ttlSeconds * 1000;
        const hash = this.computeHash(entry.html || entry.text || urlKey);
        const fullEntry = {
            ...entry,
            url: urlKey,
            hash,
            savedAt: now,
            expiresAt
        };
        // Store in memory
        this.setInMemory(urlKey, fullEntry);
        if (!this.inMemory && this.enabled) {
            try {
                const { metaPath, bodyPath } = this.getDiskPath(urlKey);
                await fs.mkdir(path.dirname(metaPath), { recursive: true });
                // Split large HTML body to disk to keep JSON meta lightweight
                const { html, ...metaOnly } = fullEntry;
                await fs.writeFile(metaPath, JSON.stringify(metaOnly, null, 2), 'utf-8');
                await fs.writeFile(bodyPath, html, 'utf-8');
            }
            catch {
                // Non-fatal filesystem error, memory cache still holds it
            }
        }
        return fullEntry;
    }
    setInMemory(key, entry) {
        if (this.memoryStore.size >= this.maxMemoryEntries) {
            const firstKey = this.memoryStore.keys().next().value;
            if (firstKey)
                this.memoryStore.delete(firstKey);
        }
        this.memoryStore.set(key, entry);
    }
    async has(rawUrl) {
        const entry = await this.get(rawUrl);
        return entry !== null;
    }
    async delete(rawUrl) {
        const urlKey = normalizeUrlKey(rawUrl);
        this.memoryStore.delete(urlKey);
        if (!this.inMemory) {
            try {
                const { metaPath, bodyPath } = this.getDiskPath(urlKey);
                await Promise.allSettled([
                    fs.unlink(metaPath),
                    fs.unlink(bodyPath)
                ]);
                return true;
            }
            catch {
                return false;
            }
        }
        return true;
    }
    async clear() {
        this.memoryStore.clear();
        if (!this.inMemory) {
            try {
                await fs.rm(this.cacheDir, { recursive: true, force: true });
            }
            catch {
                // ignore
            }
        }
    }
    getConditionalHeaders(rawUrl) {
        const urlKey = normalizeUrlKey(rawUrl);
        const entry = this.memoryStore.get(urlKey);
        const headers = {};
        if (entry) {
            if (entry.etag) {
                headers['If-None-Match'] = entry.etag;
            }
            if (entry.lastModified) {
                headers['If-Modified-Since'] = entry.lastModified;
            }
        }
        return headers;
    }
}
//# sourceMappingURL=index.js.map