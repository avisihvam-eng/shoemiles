# 👟 ShoeMiles — Shoe Mileage Tracker

A mobile-first PWA to track your running shoe mileage. Know when to replace them.

## Features

- 🏃 **Track runs** — Log distance, date, and notes per shoe
- 📊 **Progress bars** — See mileage vs target with color-coded warnings
- 🔄 **Auto-backup** — Saves data to Downloads after every change
- 📴 **Works offline** — Service worker caches everything
- 📲 **Installable** — Add to home screen, runs like a native app
- 💾 **Export/Import** — Manual JSON backup & restore
- 🌙 **Dark theme** — Clean athletic UI designed for one-hand use

## Tech Stack

- Pure HTML + CSS + JavaScript
- IndexedDB for storage
- Service Worker for offline
- No framework, no backend, no build step

## Deploy

### GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages → Source: main branch, root /**
3. Your app is live at `https://yourusername.github.io/repo-name/`

### Vercel
```bash
npx -y vercel --prod
```

## Use on Phone

1. Open the URL on your phone browser
2. Tap **"Add to Home Screen"** when prompted
3. Launch from home screen — works like a native app
4. Works fully offline after first load

## Data Safety

Auto-backup saves `shoemiles-backup.json` to your Downloads folder after every change. If you ever clear your browser cache, just import that file from Settings to restore all data.

## License

MIT
