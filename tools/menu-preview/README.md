# Menu layout preview

Open `index.html` directly in a browser. No server, package installation or X4
launch is needed. Everything is contained in that file; no fonts, images or
scripts are downloaded.

The default values follow the optional Database Management menu at `156dc75`.
This is an approximation, not an X4 widget renderer. Browser font pixels,
wrapping, padding and colours cannot establish how the game will render it.
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
