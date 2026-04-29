# Famous Beatdowns Library

Markdown files in this directory are loaded by the AI Beatdown Builder
(`src/lib/beatdown/loadFamousBeatdowns.ts`) and fed into the generation
prompt. Each file is one famous F3 beatdown.

## Frontmatter schema

```yaml
---
title: Display name (e.g., "Murph")
slug: kebab-case slug matching filename (e.g., "murph")
category: famous | ipc
length_min: 30 | 45 | 60
equipment: [bodyweight, coupon, ...]   # array
focus: full | legs | core | upper | cardio
description: One-line summary used in the typeahead
---
```

## Body

Free-form markdown describing the structure, history, common variations,
and any Marietta-specific notes the AI should respect.
