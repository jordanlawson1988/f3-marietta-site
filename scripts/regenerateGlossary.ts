/**
 * Regenerate f3Glossary.ts from Knowledge Base markdown files
 * 
 * This script reads all markdown files from /data/content/* and generates
 * the f3Glossary.ts file used by the AMA assistant.
 * 
 * Run: npm run regenerate-glossary
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface GlossaryEntry {
    id: string;
    term: string;
    shortDescription: string;
    longDescription?: string;
    category?: string;
    keywords?: string[];
}

interface ParsedKBEntry {
    title: string;
    category: string;
    tags: string[];
    aliases: string[];
    keywords: string[];
    definition: string;
    howItsDone: string;
    variations: string[];
    notes: string;
    relatedTerms: string[];
    folder: string;
}

const KB_DIR = path.join(process.cwd(), 'data', 'content');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'f3Glossary.ts');

function slugify(text: unknown): string {
    if (typeof text !== 'string') {
        return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function parseMarkdownFile(filePath: string, folder: string): ParsedKBEntry | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data, content: body } = matter(content);

        // Extract sections from body
        const definitionMatch = body.match(/### Definition\s+([\s\S]*?)(?=###|$)/);
        const howItsDoneMatch = body.match(/### How it's (?:done|used)\s+([\s\S]*?)(?=###|$)/);
        const variationsMatch = body.match(/### Variations\s+([\s\S]*?)(?=###|$)/);
        const notesMatch = body.match(/### Notes\s+([\s\S]*?)(?=###|$)/);
        const relatedMatch = body.match(/### Related(?: terms)?\s+([\s\S]*?)(?=###|$)/);

        // For FAQ, use Question/Answer format
        const questionMatch = body.match(/### Question\s+([\s\S]*?)(?=###|$)/);
        const answerMatch = body.match(/### Answer\s+([\s\S]*?)(?=###|$)/);

        let definition = '';
        if (definitionMatch) {
            definition = definitionMatch[1].trim();
        } else if (questionMatch && answerMatch) {
            definition = answerMatch[1].trim();
        }

        // Parse variations as list
        let variations: string[] = [];
        if (variationsMatch) {
            const varContent = variationsMatch[1].trim();
            variations = varContent.split('\n')
                .map(line => line.replace(/^-\s*/, '').trim())
                .filter(line => line && line !== '-');
        }

        // Parse related terms
        let relatedTerms: string[] = [];
        if (relatedMatch) {
            const relContent = relatedMatch[1].trim();
            relatedTerms = relContent.split('\n')
                .map(line => line.replace(/^-\s*/, '').trim())
                .filter(line => line && line !== '-');
        }

        // Ensure title is a string
        let title = data.title;
        if (typeof title !== 'string') {
            title = String(title || '');
        }

        return {
            title,
            category: typeof data.category === 'string' ? data.category : folder,
            tags: Array.isArray(data.tags) ? data.tags : [],
            aliases: Array.isArray(data.aliases) ? data.aliases : [],
            keywords: Array.isArray(data.keywords) ? data.keywords.map((k: unknown) => String(k)) : [],
            definition,
            howItsDone: howItsDoneMatch ? howItsDoneMatch[1].trim() : '',
            variations,
            notes: notesMatch ? notesMatch[1].trim() : '',
            relatedTerms,
            folder
        };
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}

function convertToGlossaryEntry(entry: ParsedKBEntry): GlossaryEntry {
    const id = slugify(entry.title);

    // Build short description
    const shortDescription = entry.definition;

    // Build long description from additional content
    const longParts: string[] = [];
    if (entry.howItsDone) {
        longParts.push(entry.howItsDone);
    }
    if (entry.notes && entry.notes !== '-') {
        longParts.push(entry.notes);
    }

    const longDescription = longParts.length > 0 ? longParts.join(' ') : undefined;
    const keywords = entry.keywords.length > 0 ? entry.keywords : undefined;

    return {
        id,
        term: entry.title,
        shortDescription,
        longDescription,
        category: entry.category,
        keywords
    };
}

function determineEntryType(folder: string): 'lexicon' | 'exicon' | 'other' {
    const lexiconFolders = ['lexicon', 'leadership', 'faq', 'Misc', 'q-guides'];
    const exiconFolders = ['exicon', 'workouts'];

    if (exiconFolders.includes(folder)) return 'exicon';
    if (lexiconFolders.includes(folder)) return 'lexicon';
    return 'other';
}

function main() {
    console.log('🔄 Regenerating f3Glossary.ts from Knowledge Base...\n');

    const lexiconEntries: GlossaryEntry[] = [];
    const exiconEntries: GlossaryEntry[] = [];

    // Get all folders in KB directory
    const folders = fs.readdirSync(KB_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    console.log(`📂 Found ${folders.length} KB folders: ${folders.join(', ')}\n`);

    for (const folder of folders) {
        const folderPath = path.join(KB_DIR, folder);
        const files = fs.readdirSync(folderPath)
            .filter(f => f.endsWith('.md') && f !== 'README.md');

        console.log(`  📄 ${folder}: ${files.length} files`);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const parsed = parseMarkdownFile(filePath, folder);

            if (parsed && parsed.title && parsed.definition) {
                const entry = convertToGlossaryEntry(parsed);
                const type = determineEntryType(folder);

                if (type === 'exicon') {
                    exiconEntries.push(entry);
                } else {
                    lexiconEntries.push(entry);
                }
            }
        }
    }

    // Sort entries alphabetically by term
    lexiconEntries.sort((a, b) => a.term.localeCompare(b.term));
    exiconEntries.sort((a, b) => a.term.localeCompare(b.term));

    console.log(`\n✅ Parsed ${lexiconEntries.length} lexicon entries`);
    console.log(`✅ Parsed ${exiconEntries.length} exicon entries`);

    // Generate TypeScript file
    const output = `// Auto-generated from Knowledge Base - do not edit manually
// Run: npm run regenerate-glossary

export interface GlossaryEntry {
    id: string;
    term: string;
    shortDescription: string;
    longDescription?: string;
    category?: string;
    keywords?: string[];
}

export const lexiconEntries: GlossaryEntry[] = ${JSON.stringify(lexiconEntries, null, 2)};

export const exiconEntries: GlossaryEntry[] = ${JSON.stringify(exiconEntries, null, 2)};
`;

    fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
    console.log(`\n📝 Generated ${OUTPUT_FILE}`);
    console.log(`\n🎉 Done! Total entries: ${lexiconEntries.length + exiconEntries.length}`);
}

main();
