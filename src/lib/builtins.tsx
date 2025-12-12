/**
 * Built-in Hypernote Components
 * THE reference for anyone implementing a hypernote renderer
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNostrQuery } from "@/hooks/useNostrQuery";
import { parsePubkey, parseEventId } from "@/lib/nip19";
import { useScope } from "@/hooks/usePageContext";
import {
  type ContainerStyleProps,
  type ZStackStyleProps,
  type TextStyleProps,
  type ImgStyleProps,
  resolveContainerStyles,
  resolveZStackAlignment,
  resolveTextStyles,
  resolveImgStyles,
} from "@/lib/styles";

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

/**
 * ZStack - SwiftUI-style layered stack
 * All children are stacked on top of each other in a CSS Grid.
 * The stack sizes to fit the largest child.
 * Children are aligned according to the `align` prop (default: center).
 */
export function ZStack(props: ZStackProps) {
  const { children, align, ...styleProps } = props;
  const containerStyles = resolveContainerStyles(styleProps);
  const alignment = resolveZStackAlignment(align);

  return (
    <div
      style={{
        display: "grid",
        // All children go in the same grid cell (1/1)
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
        ...alignment,
        ...containerStyles,
      }}
    >
      {/* Wrap each child to place in same grid cell */}
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

/**
 * Note - renders a nostr event by ID
 * Usage:
 *   <Note id="abc123..." />           - hex event id
 *   <Note id="note1..." />            - note-encoded id
 *   <Note id="nevent1..." />          - nevent with relay hints
 */
export function Note({ id }: { id: string }) {
  // Parse and validate the id
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
    return <div className="text-red-500 text-sm">Note: {parseResult.error}</div>;
  }
  if (!event) {
    return <div className="text-neutral-500 text-sm">Loading note...</div>;
  }

  return (
    <div className="border border-neutral-300 rounded p-2">
      <div className="text-sm">{event.content}</div>
    </div>
  );
}

/**
 * Profile - renders a nostr profile by pubkey
 * Usage:
 *   <Profile pubkey="abc123..." />    - hex pubkey
 *   <Profile pubkey="npub1..." />     - npub-encoded pubkey
 *   <Profile pubkey="nprofile1..." /> - nprofile with relay hints
 */
export function Profile({ pubkey }: { pubkey: string }) {
  // Parse and validate the pubkey
  const parseResult = useMemo(() => {
    if (!pubkey) return { error: "missing pubkey prop" };
    try {
      const parsed = parsePubkey(pubkey);
      return { valid: true, hex: parsed.pubkey };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "invalid pubkey" };
    }
  }, [pubkey]);

  const profile = useNostrQuery(
    parseResult.valid ? { type: "profile", pubkey } : undefined
  );

  if (parseResult.error) {
    return <div className="text-red-500 text-sm">Profile: {parseResult.error}</div>;
  }
  if (!profile) {
    return <div className="text-neutral-500 text-sm">Loading profile...</div>;
  }

  const displayPubkey = parseResult.hex || pubkey;
  const name = profile.name || profile.display_name || displayPubkey.slice(0, 8) + "...";
  const picture = profile.picture;

  return (
    <div className="flex items-center gap-2">
      {picture && (
        <img
          src={picture}
          alt={name}
          className="w-8 h-8 rounded-full object-cover"
        />
      )}
      <span>{name}</span>
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
      className="border border-neutral-400 rounded px-2 py-1 w-full bg-white"
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
      className="border border-neutral-400 rounded px-2 py-1 w-full bg-white resize-y"
    />
  );
}

export function Button({ action, children }: { action?: string; children?: ReactNode }) {
  const { executeAction, isPublishing } = useScope();
  return (
    <button
      onClick={() => action && executeAction(action)}
      disabled={isPublishing}
      className={
        isPublishing
          ? "bg-neutral-400 text-white px-4 py-2 rounded cursor-wait"
          : "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      }
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
