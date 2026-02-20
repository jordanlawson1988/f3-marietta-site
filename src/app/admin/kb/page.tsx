"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Folder, FileText, Search, Plus, Save, Eye, Edit3, Code, ChevronRight, ChevronDown } from "lucide-react";

// --- Types ---

interface KBFile {
    path: string;
    folder: string;
    slug: string;
    title: string;
    category: string;
    tags: string[];
}

interface KBFileDetail {
    path: string;
    folder: string;
    frontmatter: {
        title?: string;
        category?: string;
        tags?: string[];
        aliases?: string[];
        [key: string]: unknown;
    };
    sections: Record<string, string>;
    raw: string;
}

// --- Helpers ---

function humanizeFolder(folder: string): string {
    if (folder === "faq") return "FAQ";
    if (folder === "q-guides") return "Q Guides";
    if (folder === "f3-guides") return "F3 Guides";
    // Convert kebab-case to Title Case
    return folder
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// --- Components ---

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={cn("px-2 py-0.5 rounded text-xs font-medium bg-[#23334A] text-gray-300 border border-[#3A5E88]", className)}>
            {children}
        </span>
    );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="mb-4">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                placeholder={placeholder}
            />
        </div>
    );
}

function Textarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
    return (
        <div className="mb-4 flex-1 flex flex-col">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm font-mono resize-y"
            />
        </div>
    );
}

// --- Main Page Component ---

export default function KBAdminPage() {
    // Auth State
    const [password, setPassword] = useState("");
    const [token, setToken] = useState<string | null>(null);

    // Data State
    const [files, setFiles] = useState<KBFile[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<KBFile | null>(null);
    const [fileDetail, setFileDetail] = useState<KBFileDetail | null>(null);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"form" | "markdown" | "preview">("form");
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    // New Entry Modal
    const [showNewModal, setShowNewModal] = useState(false);
    const [newFolder, setNewFolder] = useState("faq");
    const [newTitle, setNewTitle] = useState("");

    // Form State (Local edits)
    const [formData, setFormData] = useState<Partial<KBFileDetail>>({});

    // --- Effects ---

    useEffect(() => {
        const savedToken = localStorage.getItem("f3-kb-admin-token");
        if (savedToken) {
            setToken(savedToken);
            fetchFiles(savedToken);
        }
    }, []);

    // --- API Calls ---

    const fetchFiles = async (authToken: string) => {
        try {
            const res = await fetch("/api/admin/kb/files", {
                headers: { "x-admin-token": authToken },
            });
            if (res.ok) {
                const data = await res.json();
                // Handle both old array format (fallback) and new object format
                if (Array.isArray(data)) {
                    setFiles(data);
                    setFolders([...new Set(data.map((f: KBFile) => f.folder))].sort());
                } else {
                    setFiles(data.files);
                    setFolders(data.folders);
                }

            } else if (res.status === 401) {
                logout();
            }
        } catch (e) {
            console.error("Failed to fetch files");
        }
    };

    const handleLogin = async () => {
        if (!password) return;
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/kb/files", {
                headers: { "x-admin-token": password },
            });
            if (res.ok) {
                const data = await res.json();
                setToken(password);
                localStorage.setItem("f3-kb-admin-token", password);

                if (Array.isArray(data)) {
                    setFiles(data);
                    setFolders([...new Set(data.map((f: KBFile) => f.folder))].sort());
                } else {
                    setFiles(data.files);
                    setFolders(data.folders);
                }

            } else {
                setError("Invalid password");
            }
        } catch (e) {
            setError("Connection failed");
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem("f3-kb-admin-token");
        setFiles([]);
        setFolders([]);
        setSelectedFile(null);
        setFileDetail(null);
    };

    const loadFile = async (file: KBFile) => {
        if (!token) return;
        setSelectedFile(file);
        setFileDetail(null);
        setIsLoading(true);
        setError("");
        setMessage("");
        setActiveTab("form"); // Reset to form view

        try {
            const res = await fetch(`/api/admin/kb/file?path=${encodeURIComponent(file.path)}`, {
                headers: { "x-admin-token": token },
            });
            if (res.ok) {
                const data = await res.json();
                setFileDetail(data);
                // Initialize form data
                setFormData({
                    frontmatter: { ...data.frontmatter },
                    sections: { ...data.sections },
                    raw: data.raw
                });
            } else {
                setError("Failed to load file");
            }
        } catch (e) {
            setError("Error loading file");
        } finally {
            setIsLoading(false);
        }
    };

    const saveFile = async () => {
        if (!token || !selectedFile) return;
        setIsSaving(true);
        setMessage("");
        setError("");

        try {
            const payload = {
                path: selectedFile.path,
                folder: selectedFile.folder,
                // If in markdown tab, send raw. If in form tab, send structured.
                // Actually, let's always send structured if we have it, unless user edited raw explicitly?
                // For simplicity: if activeTab is markdown, send raw. Else send structured.
                ...(activeTab === "markdown"
                    ? { raw: formData.raw }
                    : {
                        frontmatter: formData.frontmatter,
                        sections: formData.sections
                    }
                )
            };

            const res = await fetch("/api/admin/kb/file", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setMessage("Saved and reindexed.");
                // Reload to get fresh state (and re-generated markdown if we saved structured)
                loadFile(selectedFile);
            } else {
                setError("Failed to save");
            }
        } catch (e) {
            setError("Error saving");
        } finally {
            setIsSaving(false);
        }
    };

    const createEntry = async () => {
        if (!token || !newTitle) return;
        setIsSaving(true);

        const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const path = `data/content/${newFolder}/${slug}.md`;

        // Default templates
        let content = "";
        if (newFolder === "faq") {
            content = `---
title: ${newTitle}
category: New to F3
tags: []
aliases: []
---

### Question
${newTitle}

### Answer
TBD

### Related
- 
`;
        } else if (newFolder === "lexicon") {
            content = `---
title: ${newTitle}
category: Term
tags: []
aliases: []
---

### Definition
TBD

### How it's used
TBD

### Variations
- 

### Notes
TBD

### Related terms
- 
`;
        } else if (newFolder === "exicon") {
            content = `---
title: ${newTitle}
category: Exercise
tags: []
aliases: []
---

### Definition
TBD

### How it's done
1. 

### Variations
- 

### Notes
TBD

### Related terms
- 
`;
        } else {
            // Generic fallback for all other folders
            content = `---
title: ${newTitle}
category: ""
tags: []
aliases: []
---

TBD
`;
        }

        try {
            const res = await fetch("/api/admin/kb/file", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": token,
                },
                body: JSON.stringify({ path, raw: content }),
            });

            if (res.ok) {
                setShowNewModal(false);
                setNewTitle("");
                await fetchFiles(token); // Refresh list
                // Find and select the new file
                // We don't have the exact object reference, but we can find by path
                // For now just refresh list is enough, user can find it.
                setMessage("Entry created.");
            } else {
                setError("Failed to create entry");
            }
        } catch (e) {
            setError("Error creating entry");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Computed ---

    const groupedFiles = useMemo(() => {
        const groups: Record<string, KBFile[]> = {};

        // Initialize all folders with empty arrays
        folders.forEach(f => {
            groups[f] = [];
        });

        const filtered = files.filter(f => {
            const title = typeof f.title === 'string' ? f.title : String(f.title || '');
            return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.slug.includes(searchQuery.toLowerCase());
        });

        filtered.forEach(f => {
            if (!groups[f.folder]) groups[f.folder] = [];
            groups[f.folder].push(f);
        });

        // Sort keys (folders)
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key].sort((a, b) => {
                const titleA = typeof a.title === 'string' ? a.title : String(a.title || '');
                const titleB = typeof b.title === 'string' ? b.title : String(b.title || '');
                return titleA.localeCompare(titleB);
            });
            return acc;
        }, {} as Record<string, KBFile[]>);
    }, [files, folders, searchQuery]);

    // Get all unique folders from the file list for the dropdown
    const allFolders = useMemo(() => {
        const folders = new Set(files.map(f => f.folder));
        // Ensure default ones are there even if empty (though files API only returns existing)
        // But for creation, we want to allow creating in existing folders.
        // If a folder is empty, it won't be in `files`.
        // Ideally we should fetch folder list separately or rely on what we see.
        // For now, let's rely on what we see + hardcoded defaults just in case.
        const defaults = ["faq", "lexicon", "exicon", "culture", "events", "gear", "leadership", "q-guides", "regions", "stories", "workouts"];
        defaults.forEach(d => folders.add(d));
        return Array.from(folders).sort();
    }, [files]);

    const toggleFolder = (folder: string) => {
        setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
    };

    // --- Render Helpers ---

    const renderForm = () => {
        if (!fileDetail) return null;
        const { folder } = fileDetail;
        const fm = formData.frontmatter || {};
        const sec = formData.sections || {};

        const updateFM = (key: string, val: unknown) => {
            setFormData({ ...formData, frontmatter: { ...fm, [key]: val } });
        };
        const updateSec = (key: string, val: string) => {
            setFormData({ ...formData, sections: { ...sec, [key]: val } });
        };

        return (
            <div className="space-y-6 max-w-3xl mx-auto pb-20">
                {/* Frontmatter Section */}
                <div className="bg-[#112240] p-4 rounded-lg border border-[#23334A]">
                    <h4 className="text-sm font-bold text-gray-300 mb-4 border-b border-[#23334A] pb-2">Metadata</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Title" value={fm.title || ""} onChange={(v) => updateFM("title", v)} />
                        <Input label="Category" value={fm.category || ""} onChange={(v) => updateFM("category", v)} />
                        <Input
                            label="Tags (comma separated)"
                            value={(fm.tags || []).join(", ")}
                            onChange={(v) => updateFM("tags", v.split(",").map(s => s.trim()))}
                        />
                        <Input
                            label="Aliases (comma separated)"
                            value={(fm.aliases || []).join(", ")}
                            onChange={(v) => updateFM("aliases", v.split(",").map(s => s.trim()))}
                        />
                    </div>
                </div>

                {/* Content Section */}
                <div className="bg-[#112240] p-4 rounded-lg border border-[#23334A]">
                    <h4 className="text-sm font-bold text-gray-300 mb-4 border-b border-[#23334A] pb-2">Content</h4>

                    {folder === "faq" ? (
                        <>
                            <Textarea label="Question" value={sec.question || ""} onChange={(v) => updateSec("question", v)} />
                            <Textarea label="Answer" value={sec.answer || ""} onChange={(v) => updateSec("answer", v)} rows={8} />
                            <Textarea label="Related (Markdown list)" value={sec.related || ""} onChange={(v) => updateSec("related", v)} />
                        </>
                    ) : (folder === "lexicon" || folder === "exicon") ? (
                        <>
                            <Textarea label="Definition" value={sec.definition || ""} onChange={(v) => updateSec("definition", v)} />
                            <Textarea
                                label={folder === "exicon" ? "How it's done" : "How it's used"}
                                value={(folder === "exicon" ? sec.howDone : sec.howUsed) || ""}
                                onChange={(v) => updateSec(folder === "exicon" ? "howDone" : "howUsed", v)}
                                rows={6}
                            />
                            <Textarea label="Variations" value={sec.variations || ""} onChange={(v) => updateSec("variations", v)} />
                            <Textarea label="Notes" value={sec.notes || ""} onChange={(v) => updateSec("notes", v)} />
                            <Textarea label="Related Terms" value={sec.related || ""} onChange={(v) => updateSec("related", v)} />
                        </>
                    ) : (
                        // Generic Form
                        <Textarea label="Body" value={sec.body || formData.raw || ""} onChange={(v) => updateSec("body", v)} rows={20} />
                    )}
                </div>
            </div>
        );
    };

    // --- Main Render ---

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
                <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl">
                    <h1 className="text-2xl font-bold mb-6 text-center">KB Admin</h1>
                    <div className="space-y-4">
                        <Input label="Password" value={password} onChange={setPassword} />
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <Button onClick={handleLogin} disabled={isLoading} className="w-full">
                            {isLoading ? "Unlocking..." : "Unlock"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A1A2F] text-white flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar */}
            <div className="w-full md:w-72 bg-[#112240] border-r border-[#23334A] flex flex-col h-screen">
                <div className="p-4 border-b border-[#23334A] space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-lg">Knowledge Base</h2>
                        <button onClick={logout} className="text-xs text-gray-400 hover:text-white">Logout</button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] text-sm focus:outline-none focus:border-[#4A76A8] text-white"
                        />
                    </div>
                    <Button size="sm" className="w-full flex items-center justify-center gap-2" onClick={() => setShowNewModal(true)}>
                        <Plus className="h-4 w-4" /> New Entry
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {Object.entries(groupedFiles).map(([folder, groupFiles]) => (
                        <div key={folder} className="mb-2">
                            <button
                                onClick={() => toggleFolder(folder)}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider hover:bg-[#23334A] rounded"
                            >
                                <span className="flex items-center gap-2">
                                    <Folder className="h-3 w-3" /> {humanizeFolder(folder)}
                                </span>
                                {expandedFolders[folder] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>

                            {expandedFolders[folder] && (
                                <div className="ml-2 mt-1 space-y-0.5 border-l border-[#23334A] pl-2">
                                    {groupFiles.length === 0 ? (
                                        <div className="px-2 py-1.5 text-xs text-gray-600 italic">No entries yet</div>
                                    ) : (
                                        groupFiles.map(file => (
                                            <button
                                                key={file.path}
                                                onClick={() => loadFile(file)}
                                                className={cn(
                                                    "w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate flex items-center gap-2",
                                                    selectedFile?.path === file.path
                                                        ? "bg-[#4A76A8] text-white font-medium"
                                                        : "text-gray-300 hover:bg-[#23334A]"
                                                )}
                                            >
                                                <FileText className="h-3 w-3 opacity-50" />
                                                {file.title}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {!selectedFile ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
                        <Folder className="h-16 w-16 opacity-20" />
                        <p>Select a file to edit</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-[#23334A] bg-[#0A1A2F] flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <Badge className="uppercase">{humanizeFolder(selectedFile.folder)}</Badge>
                                <span className="text-gray-400">/</span>
                                <h3 className="font-bold text-lg">{selectedFile.title}</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {message && <span className="text-green-400 text-sm animate-in fade-in">{message}</span>}
                                {error && <span className="text-red-400 text-sm animate-in fade-in">{error}</span>}
                                <Button onClick={saveFile} disabled={isSaving} className="flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    {isSaving ? "Saving..." : "Save & Reindex"}
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[#23334A] bg-[#112240] shrink-0">
                            <button
                                onClick={() => setActiveTab("form")}
                                className={cn("px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors", activeTab === "form" ? "border-[#4A76A8] text-white bg-[#0A1A2F]" : "border-transparent text-gray-400 hover:text-white")}
                            >
                                <Edit3 className="h-4 w-4" /> Form
                            </button>
                            <button
                                onClick={() => setActiveTab("markdown")}
                                className={cn("px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors", activeTab === "markdown" ? "border-[#4A76A8] text-white bg-[#0A1A2F]" : "border-transparent text-gray-400 hover:text-white")}
                            >
                                <Code className="h-4 w-4" /> Markdown
                            </button>
                            <button
                                onClick={() => setActiveTab("preview")}
                                className={cn("px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors", activeTab === "preview" ? "border-[#4A76A8] text-white bg-[#0A1A2F]" : "border-transparent text-gray-400 hover:text-white")}
                            >
                                <Eye className="h-4 w-4" /> Preview
                            </button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-[#0A1A2F]">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
                            ) : (
                                <>
                                    {activeTab === "form" && renderForm()}

                                    {activeTab === "markdown" && (
                                        <div className="h-full flex flex-col">
                                            <textarea
                                                value={formData.raw || ""}
                                                onChange={(e) => setFormData({ ...formData, raw: e.target.value })}
                                                className="flex-1 w-full bg-[#112240] text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none rounded border border-[#23334A]"
                                                spellCheck={false}
                                            />
                                        </div>
                                    )}

                                    {activeTab === "preview" && (
                                        <div className="max-w-3xl mx-auto prose prose-invert">
                                            {/* Simple preview of raw markdown */}
                                            <div className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed">
                                                {formData.raw}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* New Entry Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#112240] p-6 rounded-lg border border-[#23334A] w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Create New Entry</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Folder</label>
                                <select
                                    value={newFolder}
                                    onChange={(e) => setNewFolder(e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                                >
                                    {allFolders.map(f => (
                                        <option key={f} value={f}>{humanizeFolder(f)}</option>
                                    ))}
                                </select>
                            </div>
                            <Input label="Title" value={newTitle} onChange={setNewTitle} placeholder="e.g. What is F3?" />
                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setShowNewModal(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={createEntry} disabled={!newTitle || isSaving}>Create</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
