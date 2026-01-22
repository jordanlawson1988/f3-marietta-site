/**
 * Release notes data for the website.
 * Add new releases at the top of the array.
 */

export interface Release {
    version: string;
    date: string;
    title: string;
    changes: string[];
}

export const RELEASES: Release[] = [
    {
        version: "1.2.0",
        date: "2026-01-12",
        title: "Backblasts Page",
        changes: [
            "New Backblasts page to view workout recaps",
            "Filter backblasts by AO and search by Q, content, or title",
            "Detailed view with full workout content and metadata",
        ],
    },
    {
        version: "1.1.0",
        date: "2024-12-18",
        title: "Contact & Assistant Updates",
        changes: [
            "Simplified Contact page with direct email and social links",
            "Added Facebook and Instagram to footer",
            "AI Assistant now shows random questions each visit",
        ],
    },
    {
        version: "1.0.0",
        date: "2024-12-01",
        title: "Initial Launch",
        changes: [
            "F3 Marietta website goes live",
            "Workouts page with AO locations",
            "AI-powered assistant for F3 questions",
            "Lexicon and Exicon glossaries",
        ],
    },
];
