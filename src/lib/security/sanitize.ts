import sanitizeHtml from 'sanitize-html';

/** Shared sanitize-html config for Slack-sourced HTML */
const SANITIZE_HTML_CONFIG: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre',
        'ul', 'ol', 'li',
        'a', 'img',
        'blockquote',
        'span',
    ],
    allowedAttributes: {
        'a': ['href', 'target', 'rel'],
        'img': ['src', 'alt'],
        'span': ['class'],
        'p': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
};

/** Sanitize HTML content for safe rendering via dangerouslySetInnerHTML */
export function sanitizeHtmlContent(html: string): string {
    return sanitizeHtml(html, SANITIZE_HTML_CONFIG);
}

/** Escape HTML special characters for safe interpolation into HTML strings */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escape characters that have special meaning in PostgREST ilike/or filters.
 * Prevents user input from breaking `.or()` filter syntax.
 */
export function escapePostgrestFilter(input: string): string {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/,/g, '\\,');
}
