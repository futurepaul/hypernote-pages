import type { BlobDescriptor } from "@/hooks/blossom";

interface Props {
  blob: BlobDescriptor;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaInfo({ blob }: Props) {
  const isImage = blob.type?.startsWith("image/");

  return (
    <div className="space-y-4">
      <div className="text-xs uppercase text-neutral-400 mb-3">Media Info</div>

      {isImage && (
        <img
          src={blob.url}
          alt=""
          className="w-full rounded-md bg-neutral-700"
        />
      )}

      <div>
        <div className="text-xs text-neutral-400 mb-1">URL</div>
        <div
          className="text-xs font-mono text-neutral-200 break-all bg-neutral-700 p-2 rounded cursor-pointer hover:bg-neutral-600"
          onClick={() => navigator.clipboard.writeText(blob.url)}
          title="Click to copy"
        >
          {blob.url}
        </div>
      </div>

      <div>
        <div className="text-xs text-neutral-400 mb-1">SHA256</div>
        <div
          className="text-xs font-mono text-neutral-200 break-all bg-neutral-700 p-2 rounded cursor-pointer hover:bg-neutral-600"
          onClick={() => navigator.clipboard.writeText(blob.sha256)}
          title="Click to copy"
        >
          {blob.sha256}
        </div>
      </div>

      <div className="flex gap-4">
        <div>
          <div className="text-xs text-neutral-400 mb-1">Size</div>
          <div className="text-sm text-neutral-200">{formatSize(blob.size)}</div>
        </div>
        {blob.type && (
          <div>
            <div className="text-xs text-neutral-400 mb-1">Type</div>
            <div className="text-sm text-neutral-200">{blob.type}</div>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs text-neutral-400 mb-1">Uploaded</div>
        <div className="text-sm text-neutral-200">
          {new Date(blob.uploaded * 1000).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
