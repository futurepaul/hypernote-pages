import type { EventTemplate } from "nostr-tools";

export interface BlobDescriptor {
  sha256: string;
  url: string;
  size: number;
  type?: string;
  uploaded: number;
}

type Signer = (event: EventTemplate) => Promise<EventTemplate & { id: string; sig: string; pubkey: string }>;

/**
 * Create a Nostr auth event for blossom operations (kind 24242)
 */
async function createAuthEvent(
  signer: Signer,
  type: "upload",
  sha256Hash: string
): Promise<string> {
  const expiration = Math.floor(Date.now() / 1000) + 60;

  const tags: string[][] = [
    ["t", type],
    ["expiration", expiration.toString()],
    ["x", sha256Hash],
  ];

  const event = await signer({
    kind: 24242,
    content: "Upload Blob",
    created_at: Math.floor(Date.now() / 1000),
    tags,
  });

  return `Nostr ${btoa(JSON.stringify(event))}`;
}

/**
 * Compute SHA-256 hash of a file
 */
async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Upload a file to a blossom server with BUD-06 preflight check
 */
export async function uploadBlob(
  serverUrl: string,
  file: File,
  signer: Signer
): Promise<BlobDescriptor> {
  const hash = await computeSha256(file);
  const contentType = file.type || "application/octet-stream";
  const total = file.size;

  const authHeader = await createAuthEvent(signer, "upload", hash);
  const url = `${serverUrl.replace(/\/$/, "")}/upload`;

  // BUD-06: Preflight check with HEAD request
  const preflightResponse = await fetch(url, {
    method: "HEAD",
    headers: {
      Authorization: authHeader,
      "X-SHA-256": hash,
      "X-Content-Type": contentType,
      "X-Content-Length": total.toString(),
    },
  });

  // 404 means server doesn't support BUD-06, proceed with upload
  // Other non-2xx means rejection
  if (!preflightResponse.ok && preflightResponse.status !== 404) {
    const reason = preflightResponse.headers.get("X-Reason");
    throw new Error(reason || `Upload rejected: ${preflightResponse.status}`);
  }

  // Upload the file
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authHeader,
      "Content-Type": contentType,
      "Content-Length": total.toString(),
    },
    body: file,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} ${error}`);
  }

  const blob = await response.json();
  return blob;
}
