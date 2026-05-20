/** Empty allowed; otherwise must look like an f3nation.com URL. */
export function isValidF3NationUrl(value: string): boolean {
    if (!value.trim()) return true;
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        return (
            (url.protocol === "https:" || url.protocol === "http:") &&
            (host === "f3nation.com" || host.endsWith(".f3nation.com"))
        );
    } catch {
        return false;
    }
}
