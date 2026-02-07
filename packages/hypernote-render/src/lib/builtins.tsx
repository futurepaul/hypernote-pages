/**
 * Built-in Hypernote Components
 * THE reference for anyone implementing a hypernote renderer
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNostrQuery } from "../hooks/useNostrQuery";
import { parsePubkey, parseEventId } from "./nip19";
import { useScope } from "../hooks/usePageContext";
import {
  type ContainerStyleProps,
  type ZStackStyleProps,
  type TextStyleProps,
  type ImgStyleProps,
  resolveContainerStyles,
  resolveZStackAlignment,
  resolveTextStyles,
  resolveImgStyles,
} from "./styles";

// =============================================================================
// LAYOUT COMPONENTS (no data fetching)
// =============================================================================

interface StackProps extends ContainerStyleProps {
  children?: ReactNode;
}

interface ZStackProps extends ZStackStyleProps {
  children?: ReactNode;
}

export function HStack(props: StackProps) {
  const { children, ...styleProps } = props;
  const containerStyles = resolveContainerStyles(styleProps);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        ...containerStyles,
      }}
    >
      {children}
    </div>
  );
}

export function VStack(props: StackProps) {
  const { children, ...styleProps } = props;
  const containerStyles = resolveContainerStyles(styleProps);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        ...containerStyles,
      }}
    >
      {children}
    </div>
  );
}

export function ZStack(props: ZStackProps) {
  const { children, align, ...styleProps } = props;
  const containerStyles = resolveContainerStyles(styleProps);
  const alignment = resolveZStackAlignment(align);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
        ...alignment,
        ...containerStyles,
      }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div key={i} style={{ gridArea: "1 / 1" }}>
              {child}
            </div>
          ))
        : <div style={{ gridArea: "1 / 1" }}>{children}</div>
      }
    </div>
  );
}

interface TextProps extends TextStyleProps {
  children?: ReactNode;
}

export function Text(props: TextProps) {
  const { children, ...styleProps } = props;
  const styles = resolveTextStyles(styleProps);

  return <span style={styles}>{children}</span>;
}

interface ImgProps extends ImgStyleProps {
  src?: string;
  alt?: string;
}

export function Img(props: ImgProps) {
  const { src, alt, ...styleProps } = props;
  const styles = resolveImgStyles(styleProps);

  return (
    <img
      src={src}
      alt={alt || ""}
      style={{
        display: "inline-block",
        ...styles,
      }}
    />
  );
}

// =============================================================================
// NOSTR COMPONENTS (fetch their own data)
// =============================================================================

export function Note({ id }: { id: string }) {
  const parseResult = useMemo(() => {
    if (!id) return { error: "missing id prop" };
    try {
      parseEventId(id);
      return { valid: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "invalid id" };
    }
  }, [id]);

  const events = useNostrQuery(
    parseResult.valid ? { type: "event", id } : undefined
  );
  const event = Array.isArray(events) ? events[0] : events;

  if (parseResult.error) {
    return <div style={{ color: "#ef4444", fontSize: "0.875rem" }}>Note: {parseResult.error}</div>;
  }
  if (!event) {
    return <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Loading note...</div>;
  }

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: "0.25rem", padding: "0.5rem" }}>
      <div style={{ fontSize: "0.875rem" }}>{event.content}</div>
    </div>
  );
}

export function Profile({ pubkey }: { pubkey: string }) {
  const parseResult = useMemo(() => {
    if (!pubkey) return { error: "missing pubkey prop" };
    try {
      const parsed = parsePubkey(pubkey);
      return { valid: true, hex: parsed.pubkey, npub: parsed.npub, nprofile: parsed.nprofile };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "invalid pubkey" };
    }
  }, [pubkey]);

  const profile = useNostrQuery(
    parseResult.valid ? { type: "profile", pubkey } : undefined
  );

  if (parseResult.error) {
    return <div style={{ color: "#ef4444", fontSize: "0.875rem" }}>Profile: {parseResult.error}</div>;
  }
  if (!profile) {
    return <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Loading profile...</div>;
  }

  const displayPubkey = parseResult.hex || pubkey;
  const name = profile.name || profile.display_name || displayPubkey.slice(0, 8) + "...";
  const picture = profile.picture;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      {picture && (
        <img
          src={picture}
          alt={name}
          style={{ width: "2rem", height: "2rem", borderRadius: "9999px", objectFit: "cover" }}
        />
      )}
      <a href={`https://njump.me/${parseResult.npub || parseResult.nprofile}`}>{name}</a>
    </div>
  );
}

// =============================================================================
// FORM COMPONENTS
// =============================================================================

export function Input({ name, placeholder }: { name: string; placeholder?: string }) {
  const { form, updateForm } = useScope();
  return (
    <input
      type="text"
      name={name}
      value={form[name] ?? ""}
      placeholder={placeholder ?? name}
      onChange={(e) => updateForm(name, e.target.value)}
      style={{
        border: "1px solid #9ca3af",
        borderRadius: "0.25rem",
        padding: "0.25rem 0.5rem",
        width: "100%",
        background: "transparent",
      }}
    />
  );
}

export function Textarea({ name, placeholder, rows }: { name: string; placeholder?: string; rows?: number }) {
  const { form, updateForm } = useScope();
  return (
    <textarea
      name={name}
      value={form[name] ?? ""}
      placeholder={placeholder ?? name}
      rows={rows ?? 4}
      onChange={(e) => updateForm(name, e.target.value)}
      style={{
        border: "1px solid #9ca3af",
        borderRadius: "0.25rem",
        padding: "0.25rem 0.5rem",
        width: "100%",
        background: "white",
        resize: "vertical",
      }}
    />
  );
}

export function Button({ action, children }: { action?: string; children?: ReactNode }) {
  const { executeAction, isPublishing } = useScope();
  return (
    <button
      onClick={() => action && executeAction(action)}
      disabled={isPublishing}
      style={{
        background: isPublishing ? "#9ca3af" : "#2563eb",
        color: "white",
        padding: "0.5rem 1rem",
        borderRadius: "0.25rem",
        border: "none",
        cursor: isPublishing ? "wait" : "pointer",
      }}
    >
      {isPublishing ? "Publishing..." : children}
    </button>
  );
}

// =============================================================================
// COMPONENT REGISTRY
// =============================================================================

export const builtinComponents: Record<string, React.ComponentType<any>> = {
  HStack,
  VStack,
  ZStack,
  Text,
  Img,
  Note,
  Profile,
  Input,
  Textarea,
  Button,
};
