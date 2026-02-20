/**
 * Slack Blocks to HTML Renderer
 * Converts Slack Block Kit JSON to sanitized HTML
 */

import { sanitizeHtmlContent, escapeHtml } from '@/lib/security/sanitize';
import type { SlackUser } from '@/types/f3Event';

// User lookup function type (injected for flexibility)
type UserLookupFn = (userId: string) => Promise<string>;

/**
 * Render Slack blocks to HTML
 */
export async function renderSlackBlocksToHtml(
    blocks: unknown[],
    userLookup?: UserLookupFn
): Promise<{ html: string; text: string }> {
    const htmlParts: string[] = [];
    const textParts: string[] = [];

    for (const block of blocks) {
        const b = block as Record<string, unknown>;
        const blockType = b.type as string;

        switch (blockType) {
            case 'section':
                const { html: sectionHtml, text: sectionText } = await renderSectionBlock(b, userLookup);
                htmlParts.push(sectionHtml);
                textParts.push(sectionText);
                break;

            case 'rich_text':
                const { html: richHtml, text: richText } = await renderRichTextBlock(b, userLookup);
                htmlParts.push(richHtml);
                textParts.push(richText);
                break;

            case 'divider':
                htmlParts.push('<hr>');
                textParts.push('---');
                break;

            case 'header':
                const headerText = extractText(b.text);
                htmlParts.push(`<h2>${escapeHtml(headerText)}</h2>`);
                textParts.push(headerText);
                break;

            case 'context':
                const contextElements = b.elements as unknown[] || [];
                const contextTexts = contextElements.map(el => extractText(el)).filter(Boolean);
                if (contextTexts.length > 0) {
                    htmlParts.push(`<p class="context">${contextTexts.map(escapeHtml).join(' • ')}</p>`);
                    textParts.push(contextTexts.join(' • '));
                }
                break;

            case 'image':
                const imageUrl = b.image_url as string;
                const altText = (b.alt_text as string) || 'Image';
                if (imageUrl) {
                    htmlParts.push(`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" />`);
                    textParts.push(`[Image: ${altText}]`);
                }
                break;

            default:
                // Fallback: try to extract any text content
                const fallbackText = extractText(b.text) || extractText(b);
                if (fallbackText) {
                    htmlParts.push(`<p>${escapeHtml(fallbackText)}</p>`);
                    textParts.push(fallbackText);
                }
        }
    }

    const rawHtml = htmlParts.join('\n');

    return {
        html: sanitizeHtmlContent(rawHtml),
        text: textParts.join('\n').trim(),
    };
}

/**
 * Render a section block
 */
async function renderSectionBlock(
    block: Record<string, unknown>,
    userLookup?: UserLookupFn
): Promise<{ html: string; text: string }> {
    const textObj = block.text as Record<string, unknown> | undefined;

    if (!textObj) {
        return { html: '', text: '' };
    }

    const textType = textObj.type as string;
    const rawText = textObj.text as string || '';

    if (textType === 'mrkdwn') {
        const { html, text } = await convertMrkdwnToHtml(rawText, userLookup);
        return { html: `<p>${html}</p>`, text };
    }

    return {
        html: `<p>${escapeHtml(rawText)}</p>`,
        text: rawText,
    };
}

/**
 * Render a rich_text block
 */
async function renderRichTextBlock(
    block: Record<string, unknown>,
    userLookup?: UserLookupFn
): Promise<{ html: string; text: string }> {
    const elements = block.elements as unknown[] || [];
    const htmlParts: string[] = [];
    const textParts: string[] = [];

    for (const element of elements) {
        const el = element as Record<string, unknown>;
        const elType = el.type as string;

        switch (elType) {
            case 'rich_text_section':
                const { html, text } = await renderRichTextSection(el, userLookup);
                htmlParts.push(`<p>${html}</p>`);
                textParts.push(text);
                break;

            case 'rich_text_list':
                const listStyle = el.style as string;
                const isOrdered = listStyle === 'ordered';
                const listTag = isOrdered ? 'ol' : 'ul';
                const listElements = el.elements as unknown[] || [];

                const listItems: string[] = [];
                const listTexts: string[] = [];

                for (const item of listElements) {
                    const { html: itemHtml, text: itemText } = await renderRichTextSection(
                        item as Record<string, unknown>,
                        userLookup
                    );
                    listItems.push(`<li>${itemHtml}</li>`);
                    listTexts.push(`• ${itemText}`);
                }

                htmlParts.push(`<${listTag}>${listItems.join('')}</${listTag}>`);
                textParts.push(listTexts.join('\n'));
                break;

            case 'rich_text_quote':
                const { html: quoteHtml, text: quoteText } = await renderRichTextSection(el, userLookup);
                htmlParts.push(`<blockquote>${quoteHtml}</blockquote>`);
                textParts.push(`> ${quoteText}`);
                break;

            case 'rich_text_preformatted':
                const { text: preText } = await renderRichTextSection(el, userLookup);
                htmlParts.push(`<pre><code>${escapeHtml(preText)}</code></pre>`);
                textParts.push(preText);
                break;
        }
    }

    return {
        html: htmlParts.join('\n'),
        text: textParts.join('\n'),
    };
}

/**
 * Render a rich_text_section element
 */
async function renderRichTextSection(
    section: Record<string, unknown>,
    userLookup?: UserLookupFn
): Promise<{ html: string; text: string }> {
    const elements = section.elements as unknown[] || [];
    const htmlParts: string[] = [];
    const textParts: string[] = [];

    for (const element of elements) {
        const el = element as Record<string, unknown>;
        const elType = el.type as string;

        switch (elType) {
            case 'text':
                let text = el.text as string || '';
                let html = escapeHtml(text);

                const style = el.style as Record<string, boolean> | undefined;
                if (style) {
                    if (style.bold) html = `<strong>${html}</strong>`;
                    if (style.italic) html = `<em>${html}</em>`;
                    if (style.strike) html = `<del>${html}</del>`;
                    if (style.code) html = `<code>${html}</code>`;
                }

                htmlParts.push(html);
                textParts.push(text);
                break;

            case 'user':
                const userId = el.user_id as string;
                let userName = userId;
                if (userLookup) {
                    userName = await userLookup(userId);
                }
                htmlParts.push(`<span class="mention">@${escapeHtml(userName)}</span>`);
                textParts.push(`@${userName}`);
                break;

            case 'channel':
                const channelId = el.channel_id as string;
                const channelName = (el.name as string) || channelId;
                htmlParts.push(`<span class="channel">#${escapeHtml(channelName)}</span>`);
                textParts.push(`#${channelName}`);
                break;

            case 'link':
                const url = el.url as string;
                const linkText = (el.text as string) || url;
                htmlParts.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(linkText)}</a>`);
                textParts.push(linkText);
                break;

            case 'emoji':
                const emojiName = el.name as string;
                // Use Unicode emoji if available, otherwise use shortcode
                const unicode = el.unicode as string;
                if (unicode) {
                    const codePoints = unicode.split('-').map(cp => parseInt(cp, 16));
                    const emoji = String.fromCodePoint(...codePoints);
                    htmlParts.push(emoji);
                    textParts.push(emoji);
                } else {
                    htmlParts.push(`:${emojiName}:`);
                    textParts.push(`:${emojiName}:`);
                }
                break;

            default:
                // Unknown element - try to extract text
                const fallback = el.text as string;
                if (fallback) {
                    htmlParts.push(escapeHtml(fallback));
                    textParts.push(fallback);
                }
        }
    }

    return {
        html: htmlParts.join(''),
        text: textParts.join(''),
    };
}

/**
 * Convert Slack mrkdwn to HTML
 */
async function convertMrkdwnToHtml(
    mrkdwn: string,
    userLookup?: UserLookupFn
): Promise<{ html: string; text: string }> {
    let html = escapeHtml(mrkdwn);
    let text = mrkdwn;

    // Bold: *text* → <strong>text</strong>
    html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '$1');

    // Italic: _text_ → <em>text</em>
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '$1');

    // Strikethrough: ~text~ → <del>text</del>
    html = html.replace(/~([^~]+)~/g, '<del>$1</del>');
    text = text.replace(/~([^~]+)~/g, '$1');

    // Code: `text` → <code>text</code>
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/`([^`]+)`/g, '$1');

    // Links: <url|text> → <a href="url">text</a>
    html = html.replace(/&lt;(https?:\/\/[^|>]+)\|([^>]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$2</a>');
    html = html.replace(/&lt;(https?:\/\/[^>]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2');
    text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1');

    // User mentions: <@UXXXX> → @DisplayName
    const userMentionRegex = /&lt;@([A-Z0-9]+)&gt;/g;
    const userMentions = [...html.matchAll(userMentionRegex)];

    for (const match of userMentions) {
        const userId = match[1];
        let displayName = userId;

        if (userLookup) {
            displayName = await userLookup(userId);
        }

        html = html.replace(match[0], `<span class="mention">@${escapeHtml(displayName)}</span>`);
    }

    // Also update text version
    text = text.replace(/<@([A-Z0-9]+)>/g, (_, userId) => `@${userId}`);

    // Channel mentions: <#CXXXX|name> → #name
    html = html.replace(/&lt;#[A-Z0-9]+\|([^>]+)&gt;/g, '<span class="channel">#$1</span>');
    html = html.replace(/&lt;#([A-Z0-9]+)&gt;/g, '<span class="channel">#$1</span>');
    text = text.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
    text = text.replace(/<#([A-Z0-9]+)>/g, '#$1');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return { html, text };
}

/**
 * Extract plain text from various Slack text object formats
 */
function extractText(obj: unknown): string {
    if (!obj) return '';

    if (typeof obj === 'string') return obj;

    const o = obj as Record<string, unknown>;

    if (o.text) {
        return typeof o.text === 'string' ? o.text : extractText(o.text);
    }

    return '';
}

