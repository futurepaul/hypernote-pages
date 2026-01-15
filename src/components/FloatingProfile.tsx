import { useRef, useState, useEffect } from "react";
import { LogIn, LogOut, BookOpenText } from "lucide-react";
import { useNostr } from "./NostrContext";
import { useProfile } from "@/hooks/nostr";
import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";
import { Link } from "wouter";

function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { login, hasExtension } = useNostr();
  const [npubInput, setNpubInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const handleExtensionLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login("extension");
      onClose();
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
      await login("npub", npubInput.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid npub");
    }
    setLoading(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      className="backdrop:bg-black/50 bg-transparent p-0 max-w-sm w-full m-auto"
    >
      <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
        <h2 className="text-lg font-bold text-neutral-100 mb-4 text-center">
          Login
        </h2>

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
    </dialog>
  );
}

function LoggedInProfile({ pubkey }: { pubkey: string }) {
  const { logout } = useNostr();
  const profile = useProfile(pubkey);

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 flex items-center gap-3">
      <Link
        href="/"
        className="text-neutral-400 hover:text-neutral-200 transition-colors"
        title="Home"
      >
        <BookOpenText className="w-5 h-5" />
      </Link>
      <img
        className="rounded-full w-8 h-8 object-cover"
        src={getProfilePicture(profile, `https://robohash.org/${pubkey}.png`)}
        alt={getDisplayName(profile)}
      />
      <span className="text-sm text-neutral-200">{getDisplayName(profile)}</span>
      <button
        onClick={logout}
        className="text-neutral-400 hover:text-neutral-200 transition-colors"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

export function FloatingProfile() {
  const { pubkey } = useNostr();
  const [modalOpen, setModalOpen] = useState(false);

  if (!pubkey) {
    return (
      <>
        <div className="fixed bottom-4 left-4 z-50 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 flex items-center gap-3">
          <Link
            href="/"
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Home"
          >
            <BookOpenText className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Login"
          >
            <LogIn className="w-5 h-5" />
          </button>
        </div>
        <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return <LoggedInProfile pubkey={pubkey} />;
}
