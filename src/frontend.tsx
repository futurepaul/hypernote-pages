/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from "react-dom/client";
import { App } from "./App";
import { eventStore, pool } from "./components/NostrContext";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { DEFAULT_RELAYS, LOOKUP_RELAYS } from "@futurepaul/hypernote";

// Set up the event loader BEFORE React renders, so that components like
// <Profile> can fetch data on their first render pass (not after useEffect)
createEventLoaderForStore(eventStore, pool, {
  lookupRelays: LOOKUP_RELAYS,
  extraRelays: DEFAULT_RELAYS,
});

// Seed the EventStore with SSR data if present (avoids loading flash on /hn/ routes)
const ssrEl = document.getElementById("__SSR_EVENT__");
if (ssrEl?.textContent) {
  try {
    const event = JSON.parse(ssrEl.textContent);
    eventStore.add(event);
  } catch {}
}

function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
