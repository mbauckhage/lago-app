# Working on Lago

## Spec-driven development

Use [SPEC.md](SPEC.md) as the product specification. Keep current behavior and planned requirements explicit so readers can tell what the app supports today.

1. Before changing product behavior, read the relevant spec and code. Define or revise the intended behavior in the spec for the current cycle.
2. Implement and verify that behavior. If implementation reveals a product decision, update the spec to capture the agreed behavior.
3. Before handing off, check that the code and the spec’s description of current behavior agree. Keep unfinished requirements marked as planned. Include behavior changes and their spec updates in the same change.

## UI design requests

Default to five distinct visual options for UI design, redesign, mockup, and design direction requests, unless the user specifies a different count or asks to implement a chosen design. Vary the layout, hierarchy, navigation, or interaction meaningfully.

Show comparable content in independently inspectable desktop and mobile layouts. Prefer a single preview with labeled option and Desktop / Mobile switches. Clearly labeled frames or links also work. Open the preview and verify every requested option and size before handing it off. Link to it and explain how to switch options and sizes.
