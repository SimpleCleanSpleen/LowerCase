# UpperCase

2D pixel-art fighting game. Static site built with **Phaser 3** and **Vite**, deployable to GitHub Pages or Firebase Hosting.

```bash
npm install
npm run dev               # http://localhost:5173
npm run build             # static output in dist/
npm run preview           # serve dist/ locally
npm run gen:placeholders  # regenerate placeholder sprite sheets
```

## Layout

```
public/assets/characters/<id>/
  character.json     # frames, animations, skins (palettes); data only, no code
  sheet.png          # sprite sheet painted in KEY COLORS only
src/
  main.js            # Phaser config (384x216 logical res, pixelArt, FIT scaling)
  game/constants.js  # resolution, floor, px-per-foot, ROSTER
  game/Fighter.js    # sprite wrapper: facing, anims, skin switching
  palette/roles.js   # palette roles -> key colors (shared with tools/)
  palette/paletteSwap.js  # key-color sheet -> one recolored canvas per skin
  assets/            # loading + key naming
  scenes/            # Boot (JSON) -> Preload (sheets, build skins) -> Stage
tools/gen-placeholders.mjs   # dependency-free placeholder art generator
```

## Art and palette-swap contract

- **Scale:** 1 ft = 12 px. Herc (5'0") is 60 px tall and Bella (7'0") is 84 px.
- **Frames:** 64×96 cells laid out left to right. Feet rest on row `footY` (94).
- **Colors:** paint sheets using **only** the key colors in `src/palette/roles.js`
  (`outline, visor, skin, skinShade, hair, armor, armorShade, trim, sigil, cape`)
  plus full transparency. Use no anti-aliasing or semi-transparent edges.
- **Skins:** each entry in `character.json → skins[]` maps every role to a color.
  At load time every skin is baked into its own texture, so runtime cost is zero.
  Pixels that aren't key colors pass through unchanged, and the console warns about them.
- **Adding a skin:** add an entry to `skins[]`. No code changes are needed.
- **Adding a character:** create a folder in `public/assets/characters/` and add its id to `ROSTER`.

## Deploy

- **GitHub Pages:** push to `main`. `.github/workflows/deploy.yml` builds and publishes
  (Settings → Pages → Source: *GitHub Actions*). `base: './'` makes sub-paths work.
- **Firebase:** run `firebase init hosting` with public dir `dist`, then `npm run build && firebase deploy`.
