# PIXELWAX 💿

> tiny vinyl corner of the internet

A retro pixel-art turntable that runs entirely in your browser. Drop in your own
audio files, shelve them into albums with procedurally generated pixel covers,
and spin them on an animated deck with a working tonearm, VU meter, 3-band EQ
and pitch control.

No build step. No dependencies. No server. Just open `index.html`.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e.svg)

<!-- Add a screenshot or GIF here once you have one:
![PIXELWAX screenshot](docs/screenshot.png)
-->

## Features

- **Animated turntable** — spinning vinyl, tonearm that drops on play, drifting dust motes, CRT scanline overlay
- **Album shelf** — create, edit and delete albums; each gets a unique pixel cover drawn on a `<canvas>`
- **Six cover patterns** — stripes, checker, dots, sun, grid, wave, plus a color swatch picker and six ready-made templates
- **Drag & drop** — drop audio files onto the shelf to make a new album, onto the tracklist to add songs, or straight onto the turntable
- **Real audio processing** — Web Audio API graph with lowshelf/peaking/highshelf filters, gain, and a live frequency analyser driving the VU meter
- **Pitch control** — 50%–150% playback rate with pitch preservation disabled, so it warps like real wax
- **Seven themes** — basement, bubblegum, midnight, cherry, forest, grape, honey
- **Keyboard shortcuts** — `Space` play/pause, `←` `→` skip tracks
- **Persistence** — albums, artwork settings and your theme survive a reload via `localStorage`

## Quick start

Clone it and open the file:

```bash
git clone https://github.com/YOUR-USERNAME/pixelwax.git
cd pixelwax
open index.html          # macOS
# xdg-open index.html    # Linux
# start index.html       # Windows
```

Opening the file directly works fine. If you'd rather serve it over HTTP
(recommended, and required if you add a demo track):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Usage

| Action | How |
| --- | --- |
| Create an album | `+ NEW ALBUM`, or drop audio files on the left dropzone |
| Add songs | Drop files on the right dropzone, or click it to browse |
| Play an album | Click it in the shelf, then `▶ PLAY ALL` |
| Load a disc | Drag an album from the shelf onto the turntable |
| Change artwork | Select an album, then `✎ EDIT ALBUM` |
| Switch theme | Click a colored dot in the header |

### About the demo button

The `▶ PLAY` button in the transport row looks for an optional file at
`assets/demo-song.wav`. The repo doesn't ship one — see
[`assets/README.md`](assets/README.md). Drop any audio file there (and update
`DEMO_TRACK` in `js/app.js` if you use a different extension) and the button
will spin it.

## Project structure

```
pixelwax/
├── index.html              # markup only
├── css/
│   └── styles.css          # themes, layout, all the pixel chrome
├── js/
│   └── app.js              # state, audio graph, cover generator, UI
├── assets/                 # optional demo track lives here
└── .github/workflows/
    └── deploy-pages.yml    # auto-deploy to GitHub Pages
```

## Deploying

The included workflow publishes the repo to GitHub Pages on every push to
`main`. To turn it on: **Settings → Pages → Source → GitHub Actions**. Your site
lands at `https://YOUR-USERNAME.github.io/pixelwax/`.

## A note on your files

Tracks are read with `URL.createObjectURL()` and never leave your machine.
Because object URLs are per-session, **track lists are not restored after a
reload** — only album metadata and covers persist. Re-drop your files to fill an
album back in.

## Browser support

Needs the Web Audio API, CSS `color-mix()`, and the Web Animations API. Works in
current Chrome, Edge, Firefox and Safari. Mobile layouts collapse to a single
column below 760px, though drag-and-drop is desktop-only.

## Contributing

Issues and pull requests are welcome. Keep it dependency-free and keep the
pixels crunchy (`image-rendering: pixelated` is applied globally on purpose).

## License

[MIT](LICENSE) — hand-soldered in a basement, no records were harmed.
