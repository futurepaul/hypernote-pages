# Example: Using Nostr Queries

This file shows examples of how to use the new `useNostrQuery` hook with frontmatter.

## Example 1: Load a Profile

```yaml
---
title: "User Profile"
profile: "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"
---

# Profile: {queries.profile.name}

Bio: {queries.profile.about}

```

## Example 2: Load a Single Event

```yaml
---
title: "Single Note"
event: "your_event_id_here"
---

{queries.event.content}

Posted at: {queries.event.created_at}
```

## Example 3: Load a Timeline of Events

```yaml
---
title: "Recent Notes"
filter:
  kinds: [1]
  limit: 10
---

<Each from={queries.events} as="note">
  **{note.pubkey}**: {note.content}
</Each>
```

## Example 4: Load by Address (Parameterized Replaceable Event)

```yaml
---
title: "Article"
address:
  kind: 30023
  pubkey: "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"
  identifier: "my-article-slug"
---

{queries.address.content}
```

## How It Works

1. **Define query in frontmatter** - Use `profile`, `event`, `filter`, or `address`
2. **Access data via `queries` object** - `{queries.profile.name}`, `{queries.events}`, etc.
3. **Data updates reactively** - Thanks to RxJS observables and `useObservableState`

## Next Steps

Try creating a page with real Nostr data:

1. Go to `/editor`
2. Paste one of the examples above
3. Replace with real pubkey/event IDs
4. Watch the data load automatically!
