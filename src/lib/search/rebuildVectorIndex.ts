/**
 * Rebuild the vector index by regenerating f3Glossary.ts from KB markdown files
 * 
 * This function is called when the "Save & Reindex" button is clicked in the KB Admin.
 * It reads all markdown files from /data/content/* and generates the updated glossary.
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
}

interface ParsedKBEntry {
    title: string;
    category: string;
    definition: string;
    howItsDone: string;
    notes: string;
    folder: string;
}

const KB_DIR = path.join(process.cwd(), 'data', 'content');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'f3Glossary.ts');

function slugify(text: unknown): string {
    if (typeof text !== 'string') {
        return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseMarkdownFile(filePath: string, folder: string): ParsedKBEntry | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data, content: body } = matter(content);

        // Extract sections from body
        const definitionMatch = body.match(/### Definition\s+([\s\S]*?)(?=###|$)/);
        const howItsDoneMatch = body.match(/### How it's (?:done|used)\s+([\s\S]*?)(?=###|$)/);
        const notesMatch = body.match(/### Notes\s+([\s\S]*?)(?=###|$)/);

        // For FAQ, use Question/Answer format
        const answerMatch = body.match(/### Answer\s+([\s\S]*?)(?=###|$)/);

        let definition = '';
        if (definitionMatch) {
            definition = definitionMatch[1].trim();
        } else if (answerMatch) {
            definition = answerMatch[1].trim();
        }

        // Ensure title is a string
        let title = data.title;
        if (typeof title !== 'string') {
            title = String(title || '');
        }

        return {
            title,
            category: typeof data.category === 'string' ? data.category : folder,
            definition,
            howItsDone: howItsDoneMatch ? howItsDoneMatch[1].trim() : '',
            notes: notesMatch ? notesMatch[1].trim() : '',
            folder
        };
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}

function convertToGlossaryEntry(entry: ParsedKBEntry): GlossaryEntry {
    const id = slugify(entry.title);
    const shortDescription = entry.definition;

    const longParts: string[] = [];
    if (entry.howItsDone) {
        longParts.push(entry.howItsDone);
    }
    if (entry.notes && entry.notes !== '-') {
        longParts.push(entry.notes);
    }

    const longDescription = longParts.length > 0 ? longParts.join(' ') : undefined;

    return {
        id,
        term: entry.title,
        shortDescription,
        longDescription,
        category: entry.category
    };
}

function determineEntryType(folder: string): 'lexicon' | 'exicon' | 'other' {
    const lexiconFolders = ['lexicon', 'leadership', 'faq', 'Misc', 'q-guides', 'gear'];
    const exiconFolders = ['exicon', 'workouts'];

    if (exiconFolders.includes(folder)) return 'exicon';
    if (lexiconFolders.includes(folder)) return 'lexicon';
    return 'other';
}

export async function rebuildVectorIndex() {
    // Skip in production - Vercel has a read-only file system
    // The glossary is regenerated during build time via npm run regenerate-glossary
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        console.log('⏭️ Skipping glossary rebuild in production (read-only file system)');
        return {
            success: true,
            message: 'Skipped in production - glossary is regenerated at build time',
            skipped: true
        };
    }

    console.log('🔄 Rebuilding glossary from Knowledge Base...');

    try {
        const lexiconEntries: GlossaryEntry[] = [];
        const exiconEntries: GlossaryEntry[] = [];

        // Get all folders in KB directory
        const folders = fs.readdirSync(KB_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        console.log(`📂 Found ${folders.length} KB folders`);

        for (const folder of folders) {
            const folderPath = path.join(KB_DIR, folder);
            const files = fs.readdirSync(folderPath)
                .filter(f => f.endsWith('.md') && f !== 'README.md');

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

        // Generate TypeScript file
        const output = `// Auto-generated from Knowledge Base - do not edit manually
// Run: npm run regenerate-glossary

export interface GlossaryEntry {
    id: string;
    term: string;
    shortDescription: string;
    longDescription?: string;
    category?: string;
}

export const lexiconEntries: GlossaryEntry[] = ${JSON.stringify(lexiconEntries, null, 2)};

export const exiconEntries: GlossaryEntry[] = ${JSON.stringify(exiconEntries, null, 2)};
`;

        fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');

        const totalEntries = lexiconEntries.length + exiconEntries.length;
        console.log(`✅ Regenerated glossary with ${totalEntries} entries (${lexiconEntries.length} lexicon, ${exiconEntries.length} exicon)`);

        return {
            success: true,
            message: `Glossary regenerated with ${totalEntries} entries`,
            lexiconCount: lexiconEntries.length,
            exiconCount: exiconEntries.length
        };
    } catch (error) {
        console.error('❌ Error rebuilding glossary:', error);
        return {
            success: false,
            message: `Error rebuilding glossary: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
