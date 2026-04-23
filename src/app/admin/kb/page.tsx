"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAdminAuth } from "../AdminAuthContext";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { SectionHead } from "@/components/ui/brand/SectionHead";
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
    return folder
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// --- Sub-components ---

function FieldInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="mb-4">
            <label className="block mb-1">
                <MonoTag>{label}</MonoTag>
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A1A2F] border border-[#23334A] focus:border-steel focus:outline-none text-bone text-sm"
                placeholder={placeholder}
            />
        </div>
    );
}

function FieldTextarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
    return (
        <div className="mb-4 flex-1 flex flex-col">
            <label className="block mb-1">
                <MonoTag>{label}</MonoTag>
            </label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                className="w-full px-3 py-2 bg-[#0A1A2F] border border-[#23334A] focus:border-steel focus:outline-none text-bone text-sm font-mono resize-y"
            />
        </div>
    );
}

// --- Main Page Component ---

export default function KBAdminPage() {
    const { logout } = useAdminAuth();
    const { data: session } = authClient.useSession();

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

    // --- API Calls ---

    const fetchFiles = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/kb/files", {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
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
        } catch {
            console.error("Failed to fetch files");
        }
    }, [logout]);

    useEffect(() => {
        if (session) fetchFiles();
    }, [session, fetchFiles]);

    const loadFile = async (file: KBFile) => {
        setSelectedFile(file);
        setFileDetail(null);
        setIsLoading(true);
        setError("");
        setMessage("");
        setActiveTab("form");

        try {
            const res = await fetch(`/api/admin/kb/file?path=${encodeURIComponent(file.path)}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setFileDetail(data);
                setFormData({
                    frontmatter: { ...data.frontmatter },
                    sections: { ...data.sections },
                    raw: data.raw
                });
            } else {
                setError("Failed to load file");
            }
        } catch {
            setError("Error loading file");
        } finally {
            setIsLoading(false);
        }
    };

    const saveFile = async () => {
        if (!selectedFile) return;
        setIsSaving(true);
        setMessage("");
        setError("");

        try {
            const payload = {
                path: selectedFile.path,
                folder: selectedFile.folder,
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
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setMessage("Saved and reindexed.");
                loadFile(selectedFile);
            } else {
                setError("Failed to save");
            }
        } catch {
            setError("Error saving");
        } finally {
            setIsSaving(false);
        }
    };

    const createEntry = async () => {
        if (!newTitle) return;
        setIsSaving(true);

        const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const path = `data/content/${newFolder}/${slug}.md`;

        let content = "";
        if (newFolder === "faq") {
            content = `---\ntitle: ${newTitle}\ncategory: New to F3\ntags: []\naliases: []\n---\n\n### Question\n${newTitle}\n\n### Answer\nTBD\n\n### Related\n- \n`;
        } else if (newFolder === "lexicon") {
            content = `---\ntitle: ${newTitle}\ncategory: Term\ntags: []\naliases: []\n---\n\n### Definition\nTBD\n\n### How it's used\nTBD\n\n### Variations\n- \n\n### Notes\nTBD\n\n### Related terms\n- \n`;
        } else if (newFolder === "exicon") {
            content = `---\ntitle: ${newTitle}\ncategory: Exercise\ntags: []\naliases: []\n---\n\n### Definition\nTBD\n\n### How it's done\n1. \n\n### Variations\n- \n\n### Notes\nTBD\n\n### Related terms\n- \n`;
        } else {
            content = `---\ntitle: ${newTitle}\ncategory: ""\ntags: []\naliases: []\n---\n\nTBD\n`;
        }

        try {
            const res = await fetch("/api/admin/kb/file", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ path, raw: content }),
            });

            if (res.ok) {
                setShowNewModal(false);
                setNewTitle("");
                await fetchFiles();
                setMessage("Entry created.");
            } else {
                setError("Failed to create entry");
            }
        } catch {
            setError("Error creating entry");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Computed ---

    const groupedFiles = useMemo(() => {
        const groups: Record<string, KBFile[]> = {};
        folders.forEach(f => { groups[f] = []; });

        const filtered = files.filter(f => {
            const title = typeof f.title === 'string' ? f.title : String(f.title || '');
            return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.slug.includes(searchQuery.toLowerCase());
        });

        filtered.forEach(f => {
            if (!groups[f.folder]) groups[f.folder] = [];
            groups[f.folder].push(f);
        });

        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key].sort((a, b) => {
                const titleA = typeof a.title === 'string' ? a.title : String(a.title || '');
                const titleB = typeof b.title === 'string' ? b.title : String(b.title || '');
                return titleA.localeCompare(titleB);
            });
            return acc;
        }, {} as Record<string, KBFile[]>);
    }, [files, folders, searchQuery]);

    const allFolders = useMemo(() => {
        const folderSet = new Set(files.map(f => f.folder));
        const defaults = ["faq", "lexicon", "exicon", "culture", "events", "gear", "leadership", "q-guides", "regions", "stories", "workouts"];
        defaults.forEach(d => folderSet.add(d));
        return Array.from(folderSet).sort();
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
                <ClipFrame variant="ink" padding="p-5">
                    <h4 className="font-mono text-xs uppercase tracking-[.15em] text-muted mb-4 border-b border-bone/10 pb-2">Metadata</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldInput label="Title" value={fm.title || ""} onChange={(v) => updateFM("title", v)} />
                        <FieldInput label="Category" value={fm.category || ""} onChange={(v) => updateFM("category", v)} />
                        <FieldInput label="Tags (comma separated)" value={(fm.tags || []).join(", ")} onChange={(v) => updateFM("tags", v.split(",").map(s => s.trim()))} />
                        <FieldInput label="Aliases (comma separated)" value={(fm.aliases || []).join(", ")} onChange={(v) => updateFM("aliases", v.split(",").map(s => s.trim()))} />
                    </div>
                </ClipFrame>

                <ClipFrame variant="ink" padding="p-5">
                    <h4 className="font-mono text-xs uppercase tracking-[.15em] text-muted mb-4 border-b border-bone/10 pb-2">Content</h4>
                    {folder === "faq" ? (
                        <>
                            <FieldTextarea label="Question" value={sec.question || ""} onChange={(v) => updateSec("question", v)} />
                            <FieldTextarea label="Answer" value={sec.answer || ""} onChange={(v) => updateSec("answer", v)} rows={8} />
                            <FieldTextarea label="Related (Markdown list)" value={sec.related || ""} onChange={(v) => updateSec("related", v)} />
                        </>
                    ) : (folder === "lexicon" || folder === "exicon") ? (
                        <>
                            <FieldTextarea label="Definition" value={sec.definition || ""} onChange={(v) => updateSec("definition", v)} />
                            <FieldTextarea
                                label={folder === "exicon" ? "How it's done" : "How it's used"}
                                value={(folder === "exicon" ? sec.howDone : sec.howUsed) || ""}
                                onChange={(v) => updateSec(folder === "exicon" ? "howDone" : "howUsed", v)}
                                rows={6}
                            />
                            <FieldTextarea label="Variations" value={sec.variations || ""} onChange={(v) => updateSec("variations", v)} />
                            <FieldTextarea label="Notes" value={sec.notes || ""} onChange={(v) => updateSec("notes", v)} />
                            <FieldTextarea label="Related Terms" value={sec.related || ""} onChange={(v) => updateSec("related", v)} />
                        </>
                    ) : (
                        <FieldTextarea label="Body" value={sec.body || formData.raw || ""} onChange={(v) => updateSec("body", v)} rows={20} />
                    )}
                </ClipFrame>
            </div>
        );
    };

    // --- Main Render ---

    return (
        <div className="flex h-screen overflow-hidden">
            {/* File Browser Sidebar */}
            <div className="w-72 bg-[#112240] border-r border-[#23334A] flex flex-col shrink-0">
                <div className="p-4 border-b border-[#23334A] space-y-3">
                    <SectionHead eyebrow="§ Admin · KB" h2="Knowledge Base" align="left" className="mb-2" />
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-[#0A1A2F] border border-[#23334A] text-sm focus:outline-none focus:border-steel text-bone"
                            aria-label="Search KB entries"
                        />
                    </div>
                    <ChamferButton
                        variant="ink"
                        size="sm"
                        arrow={false}
                        className="w-full justify-center"
                        onClick={() => setShowNewModal(true)}
                    >
                        <Plus className="h-4 w-4" /> New Entry
                    </ChamferButton>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {Object.entries(groupedFiles).map(([folder, groupFiles]) => (
                        <div key={folder} className="mb-2">
                            <button
                                onClick={() => toggleFolder(folder)}
                                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-[#23334A] transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Folder className="h-3 w-3 text-muted" />
                                    <MonoTag>{humanizeFolder(folder)}</MonoTag>
                                </span>
                                {expandedFolders[folder] ? <ChevronDown className="h-3 w-3 text-muted" /> : <ChevronRight className="h-3 w-3 text-muted" />}
                            </button>

                            {expandedFolders[folder] && (
                                <div className="ml-2 mt-1 space-y-0.5 border-l border-[#23334A] pl-2">
                                    {groupFiles.length === 0 ? (
                                        <div className="px-2 py-1.5 text-xs text-muted italic">No entries yet</div>
                                    ) : (
                                        groupFiles.map(file => (
                                            <button
                                                key={file.path}
                                                onClick={() => loadFile(file)}
                                                className={cn(
                                                    "w-full text-left px-2 py-1.5 text-sm transition-colors truncate flex items-center gap-2 border-l-2",
                                                    selectedFile?.path === file.path
                                                        ? "bg-steel/20 text-bone border-l-steel font-medium"
                                                        : "text-muted border-l-transparent hover:bg-[#23334A] hover:border-l-steel/40"
                                                )}
                                            >
                                                <FileText className="h-3 w-3 opacity-50 shrink-0" />
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
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {!selectedFile ? (
                    <div className="flex-1 flex items-center justify-center flex-col gap-4">
                        <Folder className="h-16 w-16 opacity-10 text-muted" />
                        <p className="font-display font-bold uppercase text-2xl tracking-wide text-muted">
                            Select a File
                        </p>
                        <p className="text-sm text-muted">Pick an entry from the sidebar to begin editing</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-[#23334A] bg-[#0A1A2F] flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <MonoTag variant="steel">{humanizeFolder(selectedFile.folder)}</MonoTag>
                                <span className="text-muted">/</span>
                                <span className="font-display font-bold uppercase tracking-wide text-bone text-base">{selectedFile.title}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {message && <span className="text-green-400 text-sm font-mono">{message}</span>}
                                {error && <span className="text-red-400 text-sm font-mono">{error}</span>}
                                <ChamferButton
                                    variant="ink"
                                    size="sm"
                                    arrow={false}
                                    onClick={saveFile}
                                    disabled={isSaving}
                                >
                                    <Save className="h-4 w-4" />
                                    {isSaving ? "Saving..." : "Save & Reindex"}
                                </ChamferButton>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[#23334A] bg-[#112240] shrink-0">
                            <button
                                onClick={() => setActiveTab("form")}
                                className={cn(
                                    "px-6 py-3 text-sm font-mono uppercase tracking-[.1em] flex items-center gap-2 border-b-2 transition-colors",
                                    activeTab === "form"
                                        ? "border-steel text-bone bg-[#0A1A2F]"
                                        : "border-transparent text-muted hover:text-bone"
                                )}
                            >
                                <Edit3 className="h-4 w-4" /> Form
                            </button>
                            <button
                                onClick={() => setActiveTab("markdown")}
                                className={cn(
                                    "px-6 py-3 text-sm font-mono uppercase tracking-[.1em] flex items-center gap-2 border-b-2 transition-colors",
                                    activeTab === "markdown"
                                        ? "border-steel text-bone bg-[#0A1A2F]"
                                        : "border-transparent text-muted hover:text-bone"
                                )}
                            >
                                <Code className="h-4 w-4" /> Markdown
                            </button>
                            <button
                                onClick={() => setActiveTab("preview")}
                                className={cn(
                                    "px-6 py-3 text-sm font-mono uppercase tracking-[.1em] flex items-center gap-2 border-b-2 transition-colors",
                                    activeTab === "preview"
                                        ? "border-steel text-bone bg-[#0A1A2F]"
                                        : "border-transparent text-muted hover:text-bone"
                                )}
                            >
                                <Eye className="h-4 w-4" /> Preview
                            </button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-[#0A1A2F]">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-muted">Loading...</div>
                            ) : (
                                <>
                                    {activeTab === "form" && renderForm()}
                                    {activeTab === "markdown" && (
                                        <div className="h-full flex flex-col">
                                            <textarea
                                                value={formData.raw || ""}
                                                onChange={(e) => setFormData({ ...formData, raw: e.target.value })}
                                                className="flex-1 w-full bg-[#112240] text-muted p-4 font-mono text-sm resize-none focus:outline-none border border-[#23334A] focus:border-steel"
                                                spellCheck={false}
                                            />
                                        </div>
                                    )}
                                    {activeTab === "preview" && (
                                        <ClipFrame variant="bone" padding="p-7">
                                            <div className="max-w-3xl mx-auto prose prose-invert">
                                                <div className="whitespace-pre-wrap font-sans text-muted leading-relaxed">
                                                    {formData.raw}
                                                </div>
                                            </div>
                                        </ClipFrame>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* New Entry Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-ink text-bone border border-steel/30 clip-chamfer p-8 w-full max-w-md shadow-2xl">
                        <h3 className="font-display font-bold uppercase tracking-wide text-xl mb-6">Create New Entry</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block mb-1">
                                    <MonoTag>Folder</MonoTag>
                                </label>
                                <select
                                    value={newFolder}
                                    onChange={(e) => setNewFolder(e.target.value)}
                                    className="w-full px-3 py-2 bg-transparent border border-bone/25 focus:border-steel focus:outline-none text-bone text-sm"
                                >
                                    {allFolders.map(f => (
                                        <option key={f} value={f}>{humanizeFolder(f)}</option>
                                    ))}
                                </select>
                            </div>
                            <FieldInput label="Title" value={newTitle} onChange={setNewTitle} placeholder="e.g. What is F3?" />
                            <div className="flex gap-3 pt-2">
                                <ChamferButton
                                    variant="ghost"
                                    size="sm"
                                    arrow={false}
                                    className="flex-1 justify-center"
                                    onClick={() => setShowNewModal(false)}
                                >
                                    Cancel
                                </ChamferButton>
                                <ChamferButton
                                    variant="ink"
                                    size="sm"
                                    arrow={false}
                                    className="flex-1 justify-center"
                                    onClick={createEntry}
                                    disabled={!newTitle || isSaving}
                                >
                                    Create
                                </ChamferButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
