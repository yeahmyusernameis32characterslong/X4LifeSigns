# Menu layout preview

Open `index.html` directly in a browser. No server, package installation or X4
launch is needed. Everything is contained in that file; no fonts, images or
scripts are downloaded.

The default values follow the revised Extensions-style Database Management menu
(`extensions-style-v2` in exports). The original polished browser styling did
not match the owner's X4 screenshots and has been replaced: title 13, body 10,
notes 9, native-derived 34/22/19/16 minimum row heights, blue controls, title dividers,
separate compact paging, a gutter and reply-budget text clipping. Scanning and
unavailable examples show an empty-results placeholder.

This is an approximation, not an X4 widget renderer. The animated game scene is
omitted; the outlined Zekton font may be unavailable in the browser. Native
font shapes/scaling, wrapping and widget colours still require X4 verification.
The native panel intentionally keeps word wrapping for long data fields and an
explicit body minimum height; these are adaptations for this data view. X4
calculates actual row heights from its text metrics. Its `fixed` row flag means
non-scrolling, not fixed pixel height.
The fixed-width canvas is now the default; Fit preview is an explicit
responsive experiment rather than the claimed in-game width.
The examples are fictional and include long paths, unknown dates and different
universe statuses. No save, database or service is read or changed.

## Try a layout

- Select Universes, Save details or Save locations. Save details initially shows
  the example save rows so the path column can be adjusted immediately.
- Change table font, four-button row width, spacing, padding and list capacity.
- Adjust any column; the other three redistribute to keep the total at 100%.
  Each view has its own column widths.
- Toggle Fit preview to this panel to compare responsive width with a fixed
  1130-pixel canvas. On narrow screens, scroll the preview horizontally.
- Use the sample controls, pagination and protection checkbox. These only change
  the mock-up. The Example state selector demonstrates stale/scanning/errors.
- Choose **Export layout** to download `lifesigns-menu-layout.json`, then supply
  it for review before any corresponding Lua changes/deployment. The expandable
  Layout settings section also shows the values as text.

Settings last for the current tab only. Reset layout restores the defaults;
reloading the page also resets them. Export before closing if you want to keep
your choices. The JSON is a design record, not an executable configuration or
an automatic Lua importer. Larger page counts, padding and changed geometry may
need separate transport/layout work and native X4 verification before use.
