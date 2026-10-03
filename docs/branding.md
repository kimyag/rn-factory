# App icon and splash assets

Configure `branding.assets` in each app's `app.settings.ts`: icon, Android
adaptive foreground and monochrome images, adaptive background, light and dark
splash images, and splash width. All image paths are relative to the app folder.
The template splash Mark is 76 dp wide; light mode uses paper with an ink Mark,
and dark mode uses ink with a paper Mark.

Generate the house-style PNGs for one app from the repository root:

```sh
pnpm assets:brand template-app
```

Omit the app name to generate assets for all apps. The generator uses the shared
neutral colors and Mark proportions, with padding for Android's adaptive-icon
safe region. No image editor, native project, or extra dependency is required.

Generation replaces the configured PNGs with template artwork. Each app can
replace those files with its own icon and splash images, or point its settings
at other PNGs under `assets/`. Custom assets are used directly by Expo config;
starting or building the app does not run the generator.

Regenerate after changing the shared Mark or neutral tokens. Rebuild the native
app after changing its icon or splash config. Verify light/dark launch screens
and launcher masks in a preview or production build; Expo Go and development
builds do not display every native splash property.
