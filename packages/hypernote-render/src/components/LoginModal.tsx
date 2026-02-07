/**
 * Login modal for hypernote-render
 * Shown when a user tries to interact but no signer is available.
 * Only appears in standalone mode (when host doesn't provide a signer).
 */

import { useState } from "react";
import { useNostr } from "./NostrContext";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const { setSigner } = useNostr();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function loginWithExtension() {
    if (!setSigner) return;
    setLoading(true);
    setError(null);

    try {
      const { ExtensionSigner, ExtensionMissingError } = await import("applesauce-signers/signers");

      const signer = new ExtensionSigner();
      // Verify the extension works by getting the public key
      await signer.getPublicKey();
      setSigner(signer);
      onClose();
    } catch (e) {
      // Dynamic import to check error type
      try {
        const { ExtensionMissingError } = await import("applesauce-signers/signers");
        if (e instanceof ExtensionMissingError) {
          setError("No Nostr extension found. Install a NIP-07 extension like nos2x or Alby.");
        } else {
          setError(e instanceof Error ? e.message : "Login failed");
        }
      } catch {
        setError(e instanceof Error ? e.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.5)",
        zIndex: 10000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          maxWidth: "24rem",
          width: "90%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: "bold", color: "#111" }}>
          Login to interact
        </h2>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
          This page has interactive features that require a Nostr identity.
        </p>

        {error && (
          <div style={{
            background: "#fef2f2",
            color: "#dc2626",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            marginBottom: "0.75rem",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={loginWithExtension}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.625rem 1rem",
            background: loading ? "#9ca3af" : "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            marginBottom: "0.5rem",
          }}
        >
          {loading ? "Connecting..." : "Login with Nostr Extension (NIP-07)"}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "0.5rem 1rem",
            background: "transparent",
            color: "#6b7280",
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
