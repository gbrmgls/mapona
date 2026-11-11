# Mapona · Rainy Room

A tiny isometric pixel-art room (20×20 tiles) floating over a rainy neon Japanese street,
with a TV on the wall playing a boom-bap lofi stream from YouTube.

Plain HTML, CSS and JavaScript — no build step, no dependencies.

## Play

- **Click the floor** to walk.
- **Click the TV** to use it. You have to be standing close to it; if you're too far the character walks over first.
- In the TV window you can play/pause, change the volume, **change the channel** (paste any YouTube
  video link, video id or playlist link), **watch** it big, **move** the TV (hover any spot on either wall, click
  to hang it, `Esc` cancels) and switch it off.
- The TV position, channel and volume are remembered in your browser.

Browsers block autoplay with sound, so the video starts muted and the sound turns on at your first click.

## Run locally

YouTube embeds refuse to play from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy on GitHub Pages

Push to GitHub, then **Settings → Pages → Deploy from a branch → `main` / root**.
The `.nojekyll` file makes Pages serve the files as they are.

## Files

| file | what it does |
| --- | --- |
| `js/room.js` | room geometry, floor tiles and walls (pre-rendered once) |
| `js/avatar.js` | the player: pathing, walk cycle, pixel sprite |
| `js/city.js` | the background: skyline, shops, neon signs, train, cars, rain, lightning |
| `js/tv.js` | the TV: drawing, wall placement, YouTube player, control window |
| `js/main.js` | layout, input and the game loop |
