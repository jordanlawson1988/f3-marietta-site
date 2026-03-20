import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { rebuildVectorIndex } from "@/lib/search/rebuildVectorIndex";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
    const authError = await validateAdminToken(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
        return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // Security check: prevent directory traversal
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
    const allowedDirs = ["data/content"];
    const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir));

    if (!isAllowed) {
        return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    const absolutePath = path.join(process.cwd(), normalizedPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        const fileContent = fs.readFileSync(absolutePath, "utf-8");
        const { data, content } = matter(fileContent);

        // Parse sections based on folder type
        const folder = normalizedPath.split(path.sep)[2]; // data/content/<folder>/...
        const sections: Record<string, string> = {};

        if (folder === "faq") {
            sections.question = extractSection(content, "Question");
            sections.answer = extractSection(content, "Answer");
            sections.related = extractSection(content, "Related");
        } else if (folder === "lexicon" || folder === "exicon") {
            sections.definition = extractSection(content, "Definition");
            sections.howUsed = extractSection(content, "How it's used") || extractSection(content, "How it's done"); // Handle both
            sections.howDone = sections.howUsed; // Alias for exicon
            sections.variations = extractSection(content, "Variations");
            sections.notes = extractSection(content, "Notes");
            sections.related = extractSection(content, "Related terms");
        } else {
            // Generic fallback
            sections.body = content;
        }

        return NextResponse.json({
            path: normalizedPath,
            folder,
            frontmatter: data,
            sections,
            raw: fileContent
        });
    } catch (error) {
        console.error("Error reading file:", error);
        return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
    }
}

function extractSection(content: string, header: string): string {
    const regex = new RegExp(`### ${header}\\s+([\\s\\S]*?)(?=###|$)`, "i");
    const match = content.match(regex);
    return match ? match[1].trim() : "";
}

export async function PUT(request: Request) {
    const authError = await validateAdminToken(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const { path: filePath } = body;

        if (!filePath) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        // Security check
        const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
        const allowedDirs = ["data/content"];
        const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir));

        if (!isAllowed) {
            return NextResponse.json({ error: "Invalid path" }, { status: 403 });
        }

        const absolutePath = path.join(process.cwd(), normalizedPath);
        let finalContent = "";

        if (body.raw) {
            finalContent = body.raw;
        } else if (body.frontmatter && body.sections) {
            // Reconstruct markdown
            const { frontmatter, sections, folder } = body;

            let markdownBody = "";

            if (folder === "faq") {
                markdownBody = `
### Question
${sections.question || ""}

### Answer
${sections.answer || ""}

### Related
${sections.related || ""}
`;
            } else if (folder === "lexicon") {
                markdownBody = `
### Definition
${sections.definition || ""}

### How it's used
${sections.howUsed || ""}

### Variations
${sections.variations || ""}

### Notes
${sections.notes || ""}

### Related terms
${sections.related || ""}
`;
            } else if (folder === "exicon") {
                markdownBody = `
### Definition
${sections.definition || ""}

### How it's done
${sections.howDone || ""}

### Variations
${sections.variations || ""}

### Notes
${sections.notes || ""}

### Related terms
${sections.related || ""}
`;
            } else {
                // Generic fallback
                markdownBody = body.sections.body || "";
            }

            finalContent = matter.stringify(markdownBody.trim(), frontmatter);
        } else {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Ensure directory exists (if new file)
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(absolutePath, finalContent, "utf-8");

        // Trigger reindex
        await rebuildVectorIndex();

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error writing file:", error);
        return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }
}
