export type JournalStatus = "planned" | "published";

export type JournalCategory = "architecture" | "products" | "research" | "operations" | "automation";

export type JournalEntry = {
  slug: string;
  title: string;
  status: JournalStatus;
  category: JournalCategory;
  shortDescription: string;
  publishedAt?: string;
  isPublic: boolean;
  highlighted?: boolean;
};

export const journalCategories: JournalCategory[] = [
  "architecture",
  "products",
  "research",
  "operations",
  "automation",
];

// No public entries yet; this array is ready for future published pieces.
export const journalEntries: JournalEntry[] = [];

export const publishedJournalEntries: JournalEntry[] = journalEntries.filter(
  (entry) => entry.isPublic && entry.status === "published",
);
