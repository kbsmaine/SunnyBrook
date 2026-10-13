# Sunnybrook Farm

Sunnybrook Farm is an original, dependency-free browser farming game. It uses a bright, friendly isometric farm aesthetic while keeping its name, artwork, interface, and code original.

## Play locally

You can open `dist/index.html` directly, or serve the repository with any static server:

```bash
python -m http.server 8080 --directory dist
```

Then visit `http://localhost:8080`.

## Put it on GitHub

1. Create an empty GitHub repository.
2. Run:

```bash
git init
git add .
git commit -m "Add Sunnybrook Farm"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
git push -u origin main
```

The included GitHub Actions workflow publishes `dist/` to GitHub Pages. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.

## Features

- Plant, water, grow, harvest, and sell five crops
- Raise chickens and cows and collect their goods
- Weather, day progression, energy, experience, and leveling
- Farm orders, achievements, unlockable plots, and barn upgrades
- Local autosave, sound toggle, responsive layout, and onboarding
- No dependencies, build step, backend, copied assets, or tracking

## Project layout

- `dist/index.html` — application shell
- `dist/styles.css` — responsive UI and original CSS artwork
- `dist/game.js` — game state and mechanics
- `.github/workflows/pages.yml` — GitHub Pages deployment

## License

MIT. “FarmVille” is a trademark of its respective owner; this project is not affiliated with or endorsed by Zynga.
