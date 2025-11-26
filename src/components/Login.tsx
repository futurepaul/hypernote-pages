import { useState } from "react";
import { useNostr } from "./NostrContext";

export function Login() {
  const { login, hasExtension } = useNostr();
  const [npubInput, setNpubInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExtensionLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login('extension');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extension login failed");
    }
    setLoading(false);
  };

  const handleNpubLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npubInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await login('npub', npubInput.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid npub");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="bg-neutral-800 rounded-lg p-6 w-full max-w-sm border border-neutral-700">
        <h1 className="text-xl font-bold text-neutral-100 mb-6 text-center">Hypernote Pages</h1>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {hasExtension && (
          <button
            onClick={handleExtensionLogin}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded mb-4 transition-colors"
          >
            {loading ? "Connecting..." : "Login with Extension"}
          </button>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-neutral-800 text-neutral-400">or</span>
          </div>
        </div>

        <form onSubmit={handleNpubLogin}>
          <input
            type="text"
            value={npubInput}
            onChange={(e) => setNpubInput(e.target.value)}
            placeholder="Enter npub or hex pubkey"
            className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-neutral-100 placeholder-neutral-400 mb-3 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={loading || !npubInput.trim()}
            className="w-full bg-neutral-600 hover:bg-neutral-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            View as Read-only
          </button>
        </form>

        <p className="text-neutral-500 text-xs mt-4 text-center">
          Read-only mode lets you browse and copy pages, but not publish.
        </p>
      </div>
    </div>
  );
}
