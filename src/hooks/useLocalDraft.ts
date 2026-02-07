export interface DraftData {
  value: string;
  docType: "page" | "component";
  timestamp: number;
  originalSource?: string;
  displayName?: string;
}

// Storage key prefixes
const DRAFT_PREFIX = "hn-draft:";
const NEW_DRAFT_PREFIX = "hn-draft:new:";
const DRAFT_INDEX_KEY = "hn-draft-index";

function getDraftKey(id: string, isNew: boolean): string {
  return isNew ? `${NEW_DRAFT_PREFIX}${id}` : `${DRAFT_PREFIX}${id}`;
}

export function saveDraft(
  id: string,
  value: string,
  docType: "page" | "component",
  isNew: boolean,
  originalSource?: string,
  displayName?: string
): void {
  const data: DraftData = {
    value,
    docType,
    timestamp: Date.now(),
    originalSource,
    displayName,
  };

  const key = getDraftKey(id, isNew);
  localStorage.setItem(key, JSON.stringify(data));

  // Track new drafts in an index
  if (isNew) {
    const index = getNewDraftIndex();
    if (!index.includes(id)) {
      index.push(id);
      localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
    }
  }
}

export function loadDraft(id: string, isNew: boolean): DraftData | null {
  const key = getDraftKey(id, isNew);
  const stored = localStorage.getItem(key);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as DraftData;
  } catch {
    return null;
  }
}

export function deleteDraft(id: string, isNew: boolean): void {
  const key = getDraftKey(id, isNew);
  localStorage.removeItem(key);

  // Remove from index if it's a new draft
  if (isNew) {
    const index = getNewDraftIndex();
    const filtered = index.filter((i) => i !== id);
    localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(filtered));
  }
}

function getNewDraftIndex(): string[] {
  const stored = localStorage.getItem(DRAFT_INDEX_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as string[];
  } catch {
    return [];
  }
}

export interface LocalDraft {
  id: string;
  data: DraftData;
}

export function listNewDrafts(): LocalDraft[] {
  const index = getNewDraftIndex();
  const drafts: LocalDraft[] = [];

  for (const id of index) {
    const data = loadDraft(id, true);
    if (data) {
      drafts.push({ id, data });
    }
  }

  return drafts;
}

export function hasDraft(id: string, isNew: boolean): boolean {
  const key = getDraftKey(id, isNew);
  return localStorage.getItem(key) !== null;
}
