/**
 * NIP-19 parsing utilities for hypernote components
 *
 * These are the "types" for hypernote component props:
 * - npub/hex -> pubkey (for Profile)
 * - nevent/note/hex -> event id (for Note)
 * - naddr -> addressable event (for imported components)
 */

import { nip19 } from "nostr-tools";

export type ParsedPubkey = {
  pubkey: string;
  relays?: string[];
};

export type ParsedEventId = {
  id: string;
  relays?: string[];
  author?: string;
  kind?: number;
};

export type ParsedAddress = {
  kind: number;
  pubkey: string;
  identifier: string;
  relays?: string[];
};

/**
 * Parse a pubkey from npub or hex string
 * Throws if invalid
 */
export function parsePubkey(input: string): ParsedPubkey {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid pubkey: empty input");
  }

  const trimmed = input.trim();

  // Try npub first
  if (trimmed.startsWith("npub")) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === "npub") {
        return { pubkey: decoded.data };
      }
      if (decoded.type === "nprofile") {
        return {
          pubkey: decoded.data.pubkey,
          relays: decoded.data.relays,
        };
      }
      throw new Error(`Expected npub or nprofile, got ${decoded.type}`);
    } catch (e) {
      throw new Error(`Invalid npub: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }

  // Try nprofile
  if (trimmed.startsWith("nprofile")) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === "nprofile") {
        return {
          pubkey: decoded.data.pubkey,
          relays: decoded.data.relays,
        };
      }
      throw new Error(`Expected nprofile, got ${decoded.type}`);
    } catch (e) {
      throw new Error(`Invalid nprofile: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }

  // Assume hex pubkey
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return { pubkey: trimmed.toLowerCase() };
  }

  throw new Error(`Invalid pubkey format: expected npub, nprofile, or 64-char hex`);
}

/**
 * Parse an event ID from nevent, note, or hex string
 * Throws if invalid
 */
export function parseEventId(input: string): ParsedEventId {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid event id: empty input");
  }

  const trimmed = input.trim();

  // Try nevent first (has relay hints)
  if (trimmed.startsWith("nevent")) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === "nevent") {
        return {
          id: decoded.data.id,
          relays: decoded.data.relays,
          author: decoded.data.author,
          kind: decoded.data.kind,
        };
      }
      throw new Error(`Expected nevent, got ${decoded.type}`);
    } catch (e) {
      throw new Error(`Invalid nevent: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }

  // Try note (bare event id)
  if (trimmed.startsWith("note")) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === "note") {
        return { id: decoded.data };
      }
      throw new Error(`Expected note, got ${decoded.type}`);
    } catch (e) {
      throw new Error(`Invalid note: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }

  // Assume hex event id
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return { id: trimmed.toLowerCase() };
  }

  throw new Error(`Invalid event id format: expected nevent, note, or 64-char hex`);
}

/**
 * Parse an address from naddr string
 * Throws if invalid
 */
export function parseAddress(input: string): ParsedAddress {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid address: empty input");
  }

  const trimmed = input.trim();

  if (!trimmed.startsWith("naddr")) {
    throw new Error(`Invalid address format: expected naddr`);
  }

  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === "naddr") {
      return {
        kind: decoded.data.kind,
        pubkey: decoded.data.pubkey,
        identifier: decoded.data.identifier,
        relays: decoded.data.relays,
      };
    }
    throw new Error(`Expected naddr, got ${decoded.type}`);
  } catch (e) {
    throw new Error(`Invalid naddr: ${e instanceof Error ? e.message : "parse error"}`);
  }
}

/**
 * Try to parse any nip19 string and return its type
 */
export function parseAny(input: string):
  | { type: "pubkey"; data: ParsedPubkey }
  | { type: "event"; data: ParsedEventId }
  | { type: "address"; data: ParsedAddress }
  | { type: "unknown"; error: string }
{
  if (!input || typeof input !== "string") {
    return { type: "unknown", error: "empty input" };
  }

  const trimmed = input.trim();

  // Check prefix to determine type
  if (trimmed.startsWith("npub") || trimmed.startsWith("nprofile")) {
    try {
      return { type: "pubkey", data: parsePubkey(trimmed) };
    } catch (e) {
      return { type: "unknown", error: e instanceof Error ? e.message : "parse error" };
    }
  }

  if (trimmed.startsWith("nevent") || trimmed.startsWith("note")) {
    try {
      return { type: "event", data: parseEventId(trimmed) };
    } catch (e) {
      return { type: "unknown", error: e instanceof Error ? e.message : "parse error" };
    }
  }

  if (trimmed.startsWith("naddr")) {
    try {
      return { type: "address", data: parseAddress(trimmed) };
    } catch (e) {
      return { type: "unknown", error: e instanceof Error ? e.message : "parse error" };
    }
  }

  // 64-char hex could be pubkey or event id - we can't tell
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return { type: "unknown", error: "ambiguous hex: could be pubkey or event id" };
  }

  return { type: "unknown", error: "unrecognized format" };
}
