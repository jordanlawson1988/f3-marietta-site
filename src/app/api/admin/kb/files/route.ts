
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { validateAdminToken } from "@/lib/admin/auth";

export async function GET(request: Request) {
    const authError = await validateAdminToken(request);
    if (authError) return authError;

    const baseDirs = ["data/content"]; // Focusing on the new structure
    const files: { path: string; folder: string; slug: string; title: string; category: string; tags: string[] }[] = [];
    const folders: string[] = [];

    for (const dir of baseDirs) {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
            try {
                // We want to list files in subdirectories (faq, lexicon, etc.)
                const subdirs = fs.readdirSync(dirPath, { withFileTypes: true });

                for (const subdir of subdirs) {
                    if (subdir.isDirectory()) {
                        const folderName = subdir.name;
                        folders.push(folderName);

                        const folderPath = path.join(dirPath, folderName);
                        const entries = fs.readdirSync(folderPath, { withFileTypes: true });

                        for (const entry of entries) {
                            if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
                                const fullPath = path.join(folderPath, entry.name);
                                const relativePath = path.relative(process.cwd(), fullPath);
                                const slug = entry.name.replace(".md", "");

                                let metadata: { title: string; category: string; tags: string[]; [key: string]: unknown } = {
                                    title: slug,
                                    category: folderName,
                                    tags: []
                                };

                                try {
                                    const fileContent = fs.readFileSync(fullPath, "utf-8");
                                    const { data } = matter(fileContent);
                                    metadata = { ...metadata, ...data };
                                } catch (e) {
                                    console.error(`Error parsing frontmatter for ${relativePath}`, e);
                                }

                                files.push({
                                    path: relativePath,
                                    folder: folderName,
                                    slug: slug,
                                    title: metadata.title,
                                    category: metadata.category,
                                    tags: metadata.tags || []
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Error reading directory ${dir}:`, e);
            }
        }
    }

    return NextResponse.json({ files, folders: folders.sort() });
}
