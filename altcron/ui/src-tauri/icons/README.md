# Tauri Icon Setup

Place your app icons in this directory:

- `icon.png` — 512x512 main icon (used for tray)
- `icon.ico` — Windows icon
- `icon.icns` — macOS icon
- `32x32.png` — Small icon
- `128x128.png` — Medium icon
- `128x128@2x.png` — Retina icon

You can generate icons from a 512x512 PNG using:
- https://icon generation service
- Or Tauri's icon generator: `npx @tauri-apps/cli icon path/to/your/icon.png`

For now, the app will use default Tauri icons.
