import { renderToString } from "react-dom/server";
import {
  NostrContext,
  type NostrContextValue,
  NodeRenderer,
  ScopeProvider,
  type EvaluationScope,
  extractCanvasProps,
  parseColor,
  detectBgType,
  SPACING_MAP,
  type SpacingValue,
} from "@futurepaul/hypernote";
import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";

// Minimal nostr context for SSR — no signer, no login, no browser APIs
function makeSSRNostrValue(eventStore: EventStore, pool: RelayPool): NostrContextValue {
  return {
    eventStore,
    pool,
    signer: null,
    factory: null,
    pubkey: null,
    isReadonly: true,
    requestLogin: () => {},
  };
}

// Minimal scope for SSR — no form, no actions
function makeSSRScope(): EvaluationScope {
  return {
    props: {},
    queries: {},
    state: {},
    form: {},
    updateForm: () => {},
    executeAction: async () => {},
    isPublishing: false,
  };
}

function SSRCanvas({ frontmatter, children }: { frontmatter: Record<string, any> | null; children: React.ReactNode }) {
  const canvas = extractCanvasProps(frontmatter);
  const styles: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    padding: SPACING_MAP[canvas.padding as SpacingValue] || canvas.padding,
    overflow: canvas.overflow,
  };

  if (canvas.color) {
    const color = parseColor(canvas.color);
    if (color) styles.color = color;
  }

  if (canvas.bg) {
    const bgType = detectBgType(canvas.bg);
    if (bgType === "color") {
      const bgColor = parseColor(canvas.bg);
      if (bgColor) styles.backgroundColor = bgColor;
    } else if (bgType === "image") {
      styles.backgroundImage = `url(${canvas.bg})`;
      styles.backgroundSize = canvas.bgMode === "tile" ? "auto" : canvas.bgMode;
      styles.backgroundPosition = "center";
      styles.backgroundRepeat = canvas.bgMode === "tile" ? "repeat" : "no-repeat";
    }
  }

  return <div style={styles}>{children}</div>;
}

export function renderPageToString(
  ast: any,
  frontmatter: Record<string, any> | null,
  eventStore: EventStore,
  pool: RelayPool,
): string {
  const nostrValue = makeSSRNostrValue(eventStore, pool);
  const scope = makeSSRScope();

  const html = renderToString(
    <NostrContext value={nostrValue}>
      <ScopeProvider value={scope}>
        <SSRCanvas frontmatter={frontmatter}>
          <NodeRenderer node={ast} keyName="ssr" scope={scope} />
        </SSRCanvas>
      </ScopeProvider>
    </NostrContext>
  );

  return html;
}
