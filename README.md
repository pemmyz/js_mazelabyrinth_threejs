# js_mazelabyrinth_threejs

# 🧩 Maze Game: Three.js Redux

A retro-inspired 3D maze exploration game built with Three.js and vanilla JavaScript.

Navigate through a procedurally generated maze in first-person or third-person view while an AI bot solves the maze using the A* pathfinding algorithm. Includes dynamic lighting, flashlight effects, minimap overlay, shadows, candelabras, and customizable graphics presets.

---

## 📸 Features

- 🌀 Procedurally generated maze (DFS algorithm)
- 🤖 AI bot using A* pathfinding
- 🎥 First-person and third-person camera modes
- 🔦 Toggleable flashlight system
- 🕯️ Dynamic candelabra lighting with flicker effects
- 🌫️ Atmospheric fog rendering
- 🗺️ Fullscreen minimap overlay
- 🧱 Collision detection with wall sliding
- 🪞 Smooth camera movement and view bobbing
- ⚙️ Modern and Classic graphics presets
- 🌑 Real-time shadows support
- 📱 Lightweight single-page implementation

---

## 🎮 Controls

| Key | Action |
|------|--------|
| `W / ↑` | Move Forward |
| `S / ↓` | Move Backward |
| `A / ←` | Turn Left |
| `D / →` | Turn Right |
| `M` | Toggle Map |
| `V` | Toggle Camera View |
| `F` | Toggle Flashlight |

---

## 🧠 Technologies Used

- Three.js
- HTML5
- CSS3
- Vanilla JavaScript
- WebGL

---

## 📂 Project Structure

```text
project/
├── index.html
├── style.css
└── script.js
```

---

## 🚀 Getting Started

### 1. Clone or Download

```bash
git clone https://github.com/yourusername/maze-game-threejs-redux.git
```

Or simply download the project files.

---

### 2. Run Locally

Open `index.html` in your browser.

For best compatibility, use a local web server:

#### Python

```bash
python -m http.server 8000
```

#### Node.js

```bash
npx serve
```

Then open:

```text
http://localhost:8000
```

---

## 🧱 Game Systems

### Maze Generation

The maze is generated using a randomized Depth-First Search (DFS) algorithm, creating a perfect maze with one valid path between any two points.

### AI Bot

The autonomous bot uses the A* pathfinding algorithm to solve the maze from start to exit.

Bot behavior includes:

- Countdown start
- Smooth turning
- Grid-based movement
- State machine logic

### Lighting

The game supports:

- Ambient lighting
- Dynamic flashlight shadows
- Procedural candle flicker
- Fog atmosphere

---

## ⚙️ Graphics Presets

### Modern Preset

- Shadows enabled
- Flashlight enabled
- Candelabras enabled
- View bobbing enabled
- Dark atmospheric lighting

### Classic Preset

- Simplified lighting
- No shadows
- No flashlight
- No bobbing
- Brighter retro appearance

---

## 🗺️ Map Overlay

Press `M` to toggle the fullscreen map.

Map colors:

| Color | Meaning |
|------|------|
| Gray | Walls |
| Dark | Empty path |
| Lime | Player |
| Magenta | AI Bot |
| Red | Exit |

---

## 🔧 Customization Ideas

- Add enemy AI
- Add multiplayer
- Add textures and models
- Add sound effects and music
- Add collectibles and keys
- Add procedural room generation
- Add save/load system
- Add mobile controls
- Add Steam Deck support

---

## 📄 License

MIT License

Feel free to use, modify, and distribute this project.

---

## ❤️ Credits

Created using:

- Three.js
- Vanilla JavaScript
- HTML5 Canvas
- WebGL

---

## 🌟 Future Plans

Potential future improvements:

- Better procedural generation
- Multiple maze themes
- Online multiplayer
- Cooperative mode
- More advanced AI
- Random events
- Speedrun timer
- VR support

---

## 🕹️ Have Fun Exploring the Maze!

Escape the labyrinth before the bot reaches the exit first.
