# Forms Implementation Plan

Step-by-step implementation guide. Each step builds on the previous one.

---

## Step 1: Add the Input Component

**Goal:** A basic `<Input>` that renders and stores its value in form state.

### 1.1 Add Input to builtins.tsx

```tsx
// src/lib/builtins.tsx

export function Input({
  name,
  placeholder,
  // These will be injected by NodeRenderer
  _formValue,
  _onFormChange,
}: {
  name: string;
  placeholder?: string;
  _formValue?: string;
  _onFormChange?: (name: string, value: string) => void;
}) {
  return (
    <input
      type="text"
      name={name}
      value={_formValue ?? ""}
      placeholder={placeholder ?? name}
      onChange={(e) => _onFormChange?.(name, e.target.value)}
      className="border border-neutral-400 rounded px-2 py-1 w-full"
    />
  );
}
```

Add to `builtinComponents`:
```tsx
export const builtinComponents: Record<string, React.ComponentType<any>> = {
  HStack,
  VStack,
  Text,
  Img,
  Note,
  Profile,
  Input,  // <-- add
};
```

### 1.2 Add form state to Preview.tsx

```tsx
// src/components/Preview.tsx

// Add useState for form
const [formState, setFormState] = useState<Record<string, string>>({});

// Add callback for form changes
const handleFormChange = useCallback((name: string, value: string) => {
  setFormState(prev => ({ ...prev, [name]: value }));
}, []);

// Update scope to include form state
const scope: EvaluationScope = {
  // ... existing
  form: formState,
};
```

### 1.3 Thread form callbacks through NodeRenderer

**Option A (simpler):** Pass via React Context

Create a FormContext:
```tsx
// src/components/FormContext.tsx
import { createContext, useContext } from "react";

interface FormContextValue {
  form: Record<string, string>;
  updateForm: (name: string, value: string) => void;
}

export const FormContext = createContext<FormContextValue | null>(null);

export const useForm = () => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useForm must be used within FormProvider");
  return ctx;
};
```

In Preview.tsx, wrap with FormContext.Provider:
```tsx
<FormContext.Provider value={{ form: formState, updateForm: handleFormChange }}>
  <NodeRenderer ... />
</FormContext.Provider>
```

In builtins.tsx, Input uses useForm():
```tsx
export function Input({ name, placeholder }: { name: string; placeholder?: string }) {
  const { form, updateForm } = useForm();
  return (
    <input
      type="text"
      name={name}
      value={form[name] ?? ""}
      placeholder={placeholder ?? name}
      onChange={(e) => updateForm(name, e.target.value)}
      className="border border-neutral-400 rounded px-2 py-1 w-full"
    />
  );
}
```

### 1.4 Test

Create a test page:
```mdx
---
title: Input Test
---

# Input Test

<Input name="message" placeholder="Type something..." />
```

**Expected:** Input renders, typing updates internal state.

---

## Step 2: Form Initialization from Queries

**Goal:** Initialize form state from frontmatter defaults or query results.

### 2.1 Parse form defaults from frontmatter

In Preview.tsx, after parsing frontmatter:
```tsx
// Initialize form state from frontmatter.form
useEffect(() => {
  if (frontmatter?.form) {
    const defaults: Record<string, string> = {};
    for (const [key, value] of Object.entries(frontmatter.form)) {
      if (typeof value === "string") {
        // Check if it's a reference like "queries.profile.name"
        if (value.startsWith("queries.") || value.startsWith("state.")) {
          // Will be resolved in step 2.2
          defaults[key] = "";
        } else {
          defaults[key] = value;
        }
      }
    }
    setFormState(prev => ({ ...defaults, ...prev }));
  }
}, [frontmatter]);
```

### 2.2 Resolve query references for form initialization

After queries have loaded:
```tsx
// Resolve form defaults that reference queries
useEffect(() => {
  if (!frontmatter?.form || !queryResult) return;

  const scope: EvaluationScope = {
    queries: {
      profile: query?.type === "profile" ? queryResult : undefined,
      event: query?.type === "event" ? queryResult : undefined,
      // etc
    },
    state: frontmatter,
    form: {},
  };

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(frontmatter.form)) {
    if (typeof value === "string") {
      const result = evaluate(value, scope);
      resolved[key] = result !== undefined ? String(result) : "";
    }
  }

  setFormState(prev => {
    // Only set if not already user-modified
    const updated = { ...prev };
    for (const [key, val] of Object.entries(resolved)) {
      if (updated[key] === "" || updated[key] === undefined) {
        updated[key] = val;
      }
    }
    return updated;
  });
}, [queryResult, frontmatter]);
```

### 2.3 Test

```mdx
---
title: Profile Editor
profile: npub1...
form:
  name: queries.profile.name
  about: queries.profile.about
---

# Edit Profile

Name: <Input name="name" />
About: <Input name="about" />
```

**Expected:** Inputs pre-filled with profile data from Nostr.

---

## Step 3: Add the Button Component

**Goal:** A `<Button>` that triggers an action when clicked.

### 3.1 Add Button to builtins.tsx

```tsx
export function Button({
  action,
  children,
}: {
  action?: string;
  children?: React.ReactNode;
}) {
  const { executeAction } = useForm(); // We'll add this

  const handleClick = () => {
    if (action) {
      executeAction(action);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    >
      {children}
    </button>
  );
}
```

Add to registry:
```tsx
export const builtinComponents = {
  // ...
  Button,
};
```

### 3.2 Extend FormContext with action execution

```tsx
interface FormContextValue {
  form: Record<string, string>;
  updateForm: (name: string, value: string) => void;
  executeAction: (actionName: string) => Promise<void>;
}
```

### 3.3 Test (action execution comes in Step 4)

```mdx
---
title: Button Test
---

# Button Test

<Input name="content" placeholder="Type a note..." />
<Button action="post">Post</Button>
```

**Expected:** Button renders and is clickable (logs action name for now).

---

## Step 4: Action Execution (No Hidden Fields)

**Goal:** Execute actions defined in frontmatter, building events from form + action definition.

### 4.1 Define action format in frontmatter

```yaml
actions:
  post_note:
    kind: 1
    content: form.content
    clear: true

  update_profile:
    kind: 0
    content: |
      {
        "name": "form.name",
        "about": "form.about"
      }
```

### 4.2 Implement executeAction in Preview.tsx

```tsx
const executeAction = useCallback(async (actionName: string) => {
  const actionDef = frontmatter?.actions?.[actionName];
  if (!actionDef) {
    console.warn(`Unknown action: ${actionName}`);
    return;
  }

  // Build scope for resolving values
  const scope: EvaluationScope = {
    form: formState,
    state: frontmatter,
    queries: { /* ... */ },
    user: nostr.pubkey,
  };

  // Resolve kind
  const kind = typeof actionDef.kind === "number"
    ? actionDef.kind
    : parseInt(actionDef.kind, 10);

  // Resolve content
  const content = resolveActionValue(actionDef.content, scope);

  // Resolve tags if present
  const tags = actionDef.tags?.map((tag: any[]) =>
    tag.map(v => resolveActionValue(v, scope))
  ) ?? [];

  // Build event
  const eventTemplate = {
    kind,
    content: typeof content === "string" ? content : JSON.stringify(content),
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };

  // Sign and publish
  const signed = await nostr.signer.signEvent(eventTemplate);
  await nostr.pool.publish(DEFAULT_RELAYS, signed);

  // Clear form if requested
  if (actionDef.clear) {
    setFormState({});
  }
}, [formState, frontmatter, nostr]);
```

### 4.3 Implement resolveActionValue helper

```tsx
function resolveActionValue(value: any, scope: EvaluationScope): any {
  if (typeof value !== "string") return value;

  // Check if it's a reference (form.x, state.x, queries.x, user)
  if (value.startsWith("form.")) {
    return scope.form?.[value.slice(5)] ?? "";
  }
  if (value.startsWith("state.")) {
    return scope.state?.[value.slice(6)] ?? "";
  }
  if (value.startsWith("queries.")) {
    return evaluate(value, scope);
  }
  if (value === "user" || value === "user.pubkey") {
    return scope.user;
  }
  if (value === "now") {
    return Math.floor(Date.now() / 1000);
  }

  return value;
}
```

### 4.4 Test

```mdx
---
title: Post a Note
actions:
  post:
    kind: 1
    content: form.content
    clear: true
---

# Post a Note

<Input name="content" placeholder="What's on your mind?" />
<Button action="post">Post</Button>
```

**Expected:** Clicking "Post" publishes a kind 1 event with the input content.

---

## Step 5: Live UI Updates from Form State

**Goal:** Display form values anywhere using `{form.fieldName}`.

### 5.1 Verify evaluator already works

The evaluator's `resolveValue` function already handles `form.x` paths through the scope.

Test page:
```mdx
---
title: Live Preview
---

# Live Preview

<Input name="message" placeholder="Type something..." />

You typed: {form.message}
```

**Expected:** Text updates live as you type.

### 5.2 If not working, check scope threading

Make sure form state is passed to NodeRenderer's scope:
```tsx
scope={{
  // ...
  form: formState,  // <-- this must be the useState value
}}
```

The scope is passed to `evaluate()` for `{form.message}` expressions.

---

## Step 6: Actual Publishing Integration

**Goal:** Full publishing with proper error handling and UI feedback.

### 6.1 Add publishing state

```tsx
const [isPublishing, setIsPublishing] = useState(false);
const [publishError, setPublishError] = useState<string | null>(null);
```

### 6.2 Update executeAction with error handling

```tsx
const executeAction = useCallback(async (actionName: string) => {
  setIsPublishing(true);
  setPublishError(null);

  try {
    // ... existing code ...

    const published = await nostr.pool.publish(DEFAULT_RELAYS, signed);
    if (published.length === 0) {
      throw new Error("Failed to publish to any relay");
    }

    // Clear form if requested
    if (actionDef.clear) {
      setFormState({});
    }
  } catch (error) {
    setPublishError(error instanceof Error ? error.message : "Unknown error");
  } finally {
    setIsPublishing(false);
  }
}, [/* deps */]);
```

### 6.3 Pass publishing state to Button

```tsx
interface FormContextValue {
  // ...
  isPublishing: boolean;
  publishError: string | null;
}
```

Update Button to show disabled state:
```tsx
export function Button({ action, children, disabled }: { ... }) {
  const { executeAction, isPublishing } = useForm();

  return (
    <button
      onClick={() => action && executeAction(action)}
      disabled={disabled || isPublishing}
      className={cn(
        "px-4 py-2 rounded",
        isPublishing
          ? "bg-neutral-400 cursor-wait"
          : "bg-blue-600 hover:bg-blue-700 text-white"
      )}
    >
      {isPublishing ? "Publishing..." : children}
    </button>
  );
}
```

---

## Step 7: Spread Existing Event Fields

**Goal:** When updating an event (like profile), merge with existing fields rather than overwrite.

### 7.1 Add `base` field to action definition

```yaml
actions:
  update_profile:
    kind: 0
    base: queries.profile  # Start with existing profile JSON
    content: |
      {
        "name": "form.name",
        "about": "form.about"
      }
```

### 7.2 Implement base merging in executeAction

```tsx
// Resolve base if present
let baseContent = {};
if (actionDef.base) {
  const baseResult = evaluate(actionDef.base, scope);
  if (baseResult && typeof baseResult === "object") {
    baseContent = baseResult;
  } else if (typeof baseResult === "string") {
    try {
      baseContent = JSON.parse(baseResult);
    } catch {}
  }
}

// Resolve action content
let actionContent = resolveActionValue(actionDef.content, scope);

// If content is JSON-like, parse and merge with base
let finalContent: string;
if (typeof actionContent === "string" && actionContent.trim().startsWith("{")) {
  try {
    const parsed = JSON.parse(actionContent);
    // Merge: base fields, then action fields (action wins)
    const merged = { ...baseContent, ...parsed };
    // Remove any fields that resolved to empty string
    for (const key of Object.keys(merged)) {
      if (merged[key] === "") delete merged[key];
    }
    finalContent = JSON.stringify(merged);
  } catch {
    finalContent = actionContent;
  }
} else if (typeof actionContent === "object") {
  const merged = { ...baseContent, ...actionContent };
  finalContent = JSON.stringify(merged);
} else {
  finalContent = String(actionContent);
}
```

### 7.3 Test with profile update

```mdx
---
title: Edit Profile
profile: npub1...
form:
  name: queries.profile.name
  about: queries.profile.about
actions:
  save:
    kind: 0
    base: queries.profile
    content:
      name: form.name
      about: form.about
---

# Edit Profile

<Input name="name" placeholder="Display name" />
<Input name="about" placeholder="About you" />
<Button action="save">Save Profile</Button>
```

**Expected:** Updating profile keeps existing fields (picture, lud16, etc.) while only changing name/about.

---

## Step 8: Reply-To and Event References

**Goal:** Reference other events in tags (replies, quotes, etc.).

### 8.1 Support state references in tags

Actions already support `state.x` references. Use state to store event IDs:

```mdx
---
title: Reply
event: note1abc...
state:
  replyToId: queries.event.id
  replyToPubkey: queries.event.pubkey
actions:
  reply:
    kind: 1
    content: form.content
    tags:
      - ["e", state.replyToId, "", "reply"]
      - ["p", state.replyToPubkey]
    clear: true
---

# Reply to Note

<Note id={queries.event.id} />

<Input name="content" placeholder="Your reply..." />
<Button action="reply">Reply</Button>
```

### 8.2 Alternative: Direct query references in tags

Allow `queries.event.id` directly in tags:

```yaml
actions:
  reply:
    kind: 1
    content: form.content
    tags:
      - ["e", queries.event.id, "", "reply"]
      - ["p", queries.event.pubkey]
```

Update `resolveActionValue` to handle full query paths:
```tsx
if (value.startsWith("queries.")) {
  const result = evaluate(value, scope);
  return result !== undefined ? String(result) : "";
}
```

### 8.3 Test reply flow

**Expected:** Posting a reply creates a kind 1 event with proper e and p tags referencing the original note.

---

## File Summary

| File | Changes |
|------|---------|
| `src/lib/builtins.tsx` | Add Input, Button, Textarea components |
| `src/components/FormContext.tsx` | **New file** - Form state and actions context |
| `src/components/Preview.tsx` | Add form state, initialization, executeAction |
| `src/lib/evaluator.ts` | No changes needed (already handles form.x) |
| `src/components/NodeRenderer.tsx` | No changes needed (uses builtins registry) |

---

## Implementation Order Checklist

- [ ] **Step 1:** Input component + form state + FormContext
- [ ] **Step 2:** Form initialization from frontmatter/queries
- [ ] **Step 3:** Button component with action prop
- [ ] **Step 4:** Action execution (kind, content, tags)
- [ ] **Step 5:** Verify `{form.x}` live updates work
- [ ] **Step 6:** Publishing with error handling and UI feedback
- [ ] **Step 7:** Base merging for profile updates
- [ ] **Step 8:** Event references in tags (replies)

---

## Example: Complete Note Posting App

```mdx
---
title: Post Notes
form:
  content: ""
actions:
  post:
    kind: 1
    content: form.content
    clear: true
---

# What's on your mind?

<VStack>
  <Input name="content" placeholder="Type a note..." />
  <HStack>
    <Text>{form.content | length} characters</Text>
    <Button action="post">Post</Button>
  </HStack>
</VStack>
```

## Example: Profile Editor with Base Merge

```mdx
---
title: Edit Profile
profile: user.pubkey
form:
  name: queries.profile.name
  about: queries.profile.about
  picture: queries.profile.picture
actions:
  save:
    kind: 0
    base: queries.profile
    content:
      name: form.name
      about: form.about
      picture: form.picture
---

# Edit Your Profile

<VStack>
  <Input name="name" placeholder="Display name" />
  <Input name="about" placeholder="About you" />
  <Input name="picture" placeholder="Profile picture URL" />
  <Button action="save">Save Changes</Button>
</VStack>

Preview: {form.name} - {form.about}
```

## Example: Reply to Note

```mdx
---
title: Reply
event: note1abc123...
actions:
  reply:
    kind: 1
    content: form.reply
    tags:
      - ["e", queries.event.id, "", "reply"]
      - ["p", queries.event.pubkey]
    clear: true
---

# Replying to:

<Note id={queries.event.id} />

<VStack>
  <Input name="reply" placeholder="Your reply..." />
  <Button action="reply">Reply</Button>
</VStack>
```
