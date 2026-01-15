import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";
import { ExtensionSigner, PasswordSigner } from "applesauce-signers";
import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { nip19 } from "nostr-tools";
import { LOOKUP_RELAYS, DEFAULT_RELAYS } from "@/lib/relays";

const NCRYPTSEC_STORAGE_KEY = "hn-ncryptsec";

type Signer = ExtensionSigner | PasswordSigner;
type LoginMethod = 'extension' | 'npub' | 'nsec' | 'password' | null;

interface NostrContextValue {
  eventStore: EventStore;
  pool: RelayPool;
  signer: Signer | null;
  addressLoader: AddressPointerLoader;
  eventLoader: EventPointerLoader;
  pubkey: string | null;
  isReadonly: boolean;
  hasExtension: boolean;
  hasStoredKey: boolean;
  needsUnlock: boolean;
  loginMethod: LoginMethod;
  login: (method: 'extension' | 'npub' | 'nsec' | 'password', input?: string, password?: string) => Promise<void>;
  logout: () => void;
  lock: () => void;
  clearStoredKey: () => void;
  unlockSigner: (password: string) => Promise<void>;
}

export const NostrContext = createContext<NostrContextValue | null>(null);

const eventStore = new EventStore();
const pool = new RelayPool();
const extensionSigner = new ExtensionSigner();
const passwordSigner = new PasswordSigner();
const addressLoader = createAddressLoader(pool, {
  eventStore,
  lookupRelays: LOOKUP_RELAYS,
});
const eventLoader = createEventLoader(pool, {
  eventStore,
  extraRelays: DEFAULT_RELAYS,
});
eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;

// Initialize password signer with stored ncryptsec if available
if (typeof window !== "undefined") {
  const stored = localStorage.getItem(NCRYPTSEC_STORAGE_KEY);
  if (stored) {
    passwordSigner.ncryptsec = stored;
  }
}

export const NostrProvider = ({ children }: { children: React.ReactNode }) => {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [isReadonly, setIsReadonly] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(NCRYPTSEC_STORAGE_KEY) !== null;
    }
    return false;
  });
  const [activeSigner, setActiveSigner] = useState<Signer | null>(null);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  // Check for extension on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "nostr" in window) {
      setHasExtension(true);
      return;
    }
    const intervals = [100, 200, 400, 800, 1600];
    let timeoutIds: ReturnType<typeof setTimeout>[] = [];
    let totalDelay = 0;
    for (const interval of intervals) {
      totalDelay += interval;
      const timeoutId = setTimeout(() => {
        if (typeof window !== "undefined" && "nostr" in window) {
          setHasExtension(true);
          timeoutIds.forEach((id) => clearTimeout(id));
          timeoutIds = [];
        }
      }, totalDelay);
      timeoutIds.push(timeoutId);
    }
    return () => timeoutIds.forEach((id) => clearTimeout(id));
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("hn-auth");
    if (stored) {
      try {
        const { pubkey, isReadonly, method } = JSON.parse(stored);
        setPubkey(pubkey);
        setIsReadonly(isReadonly);
        setLoginMethod(method || null);

        // For extension login, try to restore signer
        if (method === 'extension' && hasExtension) {
          setActiveSigner(extensionSigner);
        }
        // For password login, mark as needing unlock
        else if (method === 'password' && hasStoredKey) {
          setNeedsUnlock(true);
        }
      } catch {}
    }
  }, [hasExtension, hasStoredKey]);

  const login = useCallback(async (method: 'extension' | 'npub' | 'nsec' | 'password', input?: string, password?: string) => {
    if (method === 'extension') {
      const pk = await extensionSigner.getPublicKey();
      setPubkey(pk);
      setIsReadonly(false);
      setActiveSigner(extensionSigner);
      setLoginMethod('extension');
      setNeedsUnlock(false);
      localStorage.setItem("hn-auth", JSON.stringify({ pubkey: pk, isReadonly: false, method: 'extension' }));
    } else if (method === 'npub' && input) {
      let pk = input;
      if (input.startsWith("npub")) {
        const decoded = nip19.decode(input);
        if (decoded.type === "npub") {
          pk = decoded.data;
        }
      }
      setPubkey(pk);
      setIsReadonly(true);
      setActiveSigner(null);
      setLoginMethod('npub');
      setNeedsUnlock(false);
      localStorage.setItem("hn-auth", JSON.stringify({ pubkey: pk, isReadonly: true, method: 'npub' }));
    } else if (method === 'nsec' && input && password) {
      // Setup new nsec with password encryption
      let privateKey: Uint8Array;
      if (input.startsWith("nsec")) {
        const decoded = nip19.decode(input);
        if (decoded.type !== "nsec") throw new Error("Invalid nsec");
        privateKey = decoded.data;
      } else {
        // Assume hex format
        privateKey = new Uint8Array(input.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      }

      passwordSigner.key = privateKey;
      await passwordSigner.setPassword(password);

      if (!passwordSigner.ncryptsec) throw new Error("Failed to encrypt key");

      // Store encrypted key
      localStorage.setItem(NCRYPTSEC_STORAGE_KEY, passwordSigner.ncryptsec);
      setHasStoredKey(true);

      const pk = await passwordSigner.getPublicKey();
      setPubkey(pk);
      setIsReadonly(false);
      setActiveSigner(passwordSigner);
      setLoginMethod('password');
      setNeedsUnlock(false);
      localStorage.setItem("hn-auth", JSON.stringify({ pubkey: pk, isReadonly: false, method: 'password' }));
    } else if (method === 'password' && input) {
      // Unlock existing stored key with password
      await passwordSigner.unlock(input);
      const pk = await passwordSigner.getPublicKey();
      setPubkey(pk);
      setIsReadonly(false);
      setActiveSigner(passwordSigner);
      setLoginMethod('password');
      setNeedsUnlock(false);
      localStorage.setItem("hn-auth", JSON.stringify({ pubkey: pk, isReadonly: false, method: 'password' }));
    }
  }, []);

  const unlockSigner = useCallback(async (password: string) => {
    await passwordSigner.unlock(password);
    setActiveSigner(passwordSigner);
    setNeedsUnlock(false);
  }, []);

  const logout = useCallback(() => {
    setPubkey(null);
    setIsReadonly(false);
    setActiveSigner(null);
    setLoginMethod(null);
    setNeedsUnlock(false);
    passwordSigner.lock();
    localStorage.removeItem("hn-auth");
  }, []);

  const lock = useCallback(() => {
    passwordSigner.lock();
    setPubkey(null);
    setActiveSigner(null);
    setNeedsUnlock(true);
    localStorage.removeItem("hn-auth");
  }, []);

  const clearStoredKey = useCallback(() => {
    passwordSigner.key = null;
    passwordSigner.ncryptsec = undefined;
    localStorage.removeItem(NCRYPTSEC_STORAGE_KEY);
    setHasStoredKey(false);
  }, []);

  const value = useMemo(() => ({
    eventStore,
    pool,
    signer: activeSigner,
    addressLoader,
    eventLoader,
    pubkey,
    isReadonly,
    hasExtension,
    hasStoredKey,
    needsUnlock,
    loginMethod,
    login,
    logout,
    lock,
    clearStoredKey,
    unlockSigner,
  }), [pubkey, isReadonly, hasExtension, hasStoredKey, needsUnlock, loginMethod, login, logout, lock, clearStoredKey, unlockSigner, activeSigner]);

  return <NostrContext value={value}>{children}</NostrContext>;
};

export const useNostr = () => {
  const nostr = useContext(NostrContext);
  if (!nostr) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return nostr;
};