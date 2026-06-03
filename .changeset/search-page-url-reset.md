---
'@backstage/plugin-search': patch
---

Fixed search pages so clearing `query`, `filters`, or `pageCursor` from the URL also resets the corresponding page state. This keeps the visible search state aligned with browser navigation and manually edited URLs.
