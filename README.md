# Constellaris

An AI-powered interactive visual novel engine with English learning features. The system generates original stories with unique characters per save, presents them in a visual novel format, and tests comprehension through adaptive quizzes — all in multiple languages.

---

## What It Does

- Generates a cast of 5 unique characters (personality, appearance, AI-illustrated portrait) for each new story save
- Writes episodic story scenes using OpenAI GPT-4o, constrained by scenario prompts and character state
- Presents the story as a visual novel with character portraits, dialogue boxes, and smooth slide transitions
- Tracks relationships, emotional conditions, and knowledge state between characters across iterations
- Offers an in-story dictionary — tap any word to get its definition, in-context meaning, and an example sentence
- Generates a 10-question quiz at the end of each chapter (5 MC, 3 short answer, 2 paragraph)
- AI-grades written answers with score and feedback, calibrated to the selected grammar level
- Supports multiple story languages: English, Indonesian, Chinese, Cantonese
- Supports multiple interface languages: English, Korean, Japanese, Indonesian, Chinese, Spanish, French
- Multiple independent story saves, each with their own characters and story progression

---

## Project Structure

```
Constellaris_Mk2/
│
├── api_server.js                        # Express backend — all API routes
│
├── config/
│   └── env.js                           # dotenv loader
│
├── engines/
│   ├── character_system/
│   │   ├── generate_personality.js      # Generates character personality JSON
│   │   ├── generate_appearance_json.js  # Generates character appearance JSON
│   │   └── generate_character_image.js  # Generates character portrait via DALL-E
│   │
│   └── story_system/
│       ├── run_story.js                 # Entry point — accepts --save and --lang flags
│       ├── generate_story.js            # Builds prompts, calls GPT-4o, returns scene
│       ├── extract_update.js            # Extracts relationship/condition changes from scene
│       ├── update_memory.js             # Updates story memory and character arcs
│       ├── parse_slides.js              # Converts scene text into visual novel slide JSON
│       └── validator.js                 # Validates AI output for unknown tokens
│
├── prompts/
│   ├── character/
│   │   ├── Personality_Prompt.txt       # System prompt for character personality generation
│   │   ├── appearance_prompt.txt        # System prompt for appearance generation
│   │   └── character_global_art_style_prompt.txt  # Art style for portrait generation
│   └── story/
│       ├── scenario1_prompt.txt         # Chapter 1: separate daily lives in Seoul
│       ├── scenario2_prompt.txt         # Chapter 2: towers appear
│       └── ...                          # Up to scenario10_prompt.txt
│
├── data/
│   ├── settings.json                    # Global settings (system language, grammar level)
│   └── saves/
│       └── save_{timestamp}/            # One folder per story save
│           ├── meta.json                # Save name, language, iteration, last edited
│           ├── characters/
│           │   ├── C001_personality.json
│           │   ├── C001_appearance.json
│           │   └── ...
│           ├── images/
│           │   ├── C001_image.png
│           │   └── ...
│           └── story/
│               ├── story_state.json     # Current iteration, phase, tension, relationships
│               ├── story_memory.json    # Key events, summary, character arcs
│               ├── story_slides.json    # Parsed slides for the visual novel reader
│               └── story_log.txt        # Full raw story text log
│
├── outputs/
│   └── visual_novel_trial.html          # The visual novel reader (served by api_server.js)
│
└── .env                                 # API keys
```

---

## Prerequisites

- Node.js v18 or higher
- An OpenAI API key with access to `gpt-4o` and `gpt-image-1`

---

## Installation

```bash
# 1. Clone or download the project
cd Constellaris_Mk2

# 2. Install dependencies
npm install express cors openai dotenv

# 3. Create your .env file
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 4. Create the saves directory
mkdir data\saves
```

---

## Running the Project

### Step 1 — Start the API server

```bash
node api_server.js
```

You should see:
```
✔ Constellaris API — http://localhost:3001
```

Keep this terminal open. The server handles all API calls and also serves the HTML reader.

### Step 2 — Open the reader

Go to **http://localhost:3001** in your browser.

### Step 3 — Create a new story

1. Press **Play** on the menu
2. Press **+ New Story**
3. Enter a name and choose the story language
4. Wait ~15 seconds while characters are generated
5. The first chapter generates automatically and begins playing
6. Character portraits generate in the background — they appear once ready

---

## How the Story Engine Works

### Token substitution system

Characters are never referred to by name in the AI prompt. Instead, names are replaced with tokens (`CHARACTER_001`, `CHARACTER_002`, etc.) before the prompt is sent. The AI writes the scene using only these tokens. After generation, tokens are swapped back to real names. This prevents the AI from inventing character names.

### Iteration and phases

Each story save tracks a `current_iteration` counter. Iterations 1–10 are **controlled phase** — the AI must follow the scenario prompt exactly and cannot add new events. After iteration 10, the story enters **free phase** where the AI continues naturally.

Each iteration uses a corresponding scenario file: `scenario1_prompt.txt` for iteration 1, `scenario2_prompt.txt` for iteration 2, and so on.

### State tracking

After each scene is generated, `extract_update.js` scans the text for relationship signals (trust, tension, fear, respect), knowledge changes, and physical/emotional conditions. These are stored in `story_state.json` and injected into the next scene's prompt so characters evolve consistently across chapters.

### Memory

`update_memory.js` maintains a rolling summary of up to 15 key events and per-character arc notes. These are injected into every prompt so the AI has context beyond the immediately preceding scene.

---

## How the Visual Novel Reader Works

The reader loads `story_slides.json` for the active save. Each slide is one of three types:

| Type | Display |
|---|---|
| `narrator` | No character shown. Dimmed text. Background only. |
| `monologue` | Single character centered, speaking/thinking. |
| `dialogue` | Active speaker on the right (bright). Previous speaker on the left (darkened). |

**Click anywhere** on the scene to advance to the next slide.

**Click any word** in the dialogue to open the dictionary tooltip — shows definition, in-context meaning, and a new example sentence, all calibrated to your grammar level setting.

**Logs button** — opens a side panel showing the full transcript of everything read so far. Also accessible from inside the quiz screen.

**Auto button** — auto-advances slides every 3.8 seconds.

---

## Quiz System

After all slides for a chapter are read, the end screen appears. Pressing **Take the Quiz** sends the full chapter text to GPT-4o which generates:

- 5 multiple choice questions (comprehension and vocabulary in context)
- 3 short answer questions (1–3 sentences expected)
- 2 paragraph questions (5–8 sentences of analysis expected)

MC answers are checked instantly. Short and paragraph answers are sent to the `/api/grade` endpoint and AI-graded with a score and written feedback.

After the quiz, you can press **Continue Story** to generate the next chapter automatically.

---

## Settings

Open **Settings** from the main menu.

| Setting | What it does |
|---|---|
| Interface Language | Changes all menus, buttons, and labels immediately |
| Grammar Level | Changes quiz difficulty, grading strictness, and definition complexity |

Grammar levels range from **Beginner (A1–A2)** to **Advanced (C2)**. Each level shows a preview example so you can pick the right fit.

---

## Story Language vs Interface Language

These are two separate settings:

- **Interface Language** — set in Settings, applies globally, changes menus and buttons
- **Story Language** — set when creating a new save, cannot be changed after. Controls the language the story is written in, what language the dictionary definitions use, and what language the quiz is written in

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/saves` | List all saves |
| `POST` | `/api/saves` | Create new save (generates characters) |
| `GET` | `/api/saves/:id` | Get one save's metadata |
| `PUT` | `/api/saves/:id/name` | Rename a save |
| `DELETE` | `/api/saves/:id` | Delete a save and all its files |
| `POST` | `/api/continue` | Run next story iteration for a save |
| `GET` | `/api/characters/:saveId` | Get character config for a save |
| `GET` | `/api/settings` | Get global settings |
| `POST` | `/api/settings` | Update global settings |
| `POST` | `/api/define` | Get word definition + context + example |
| `POST` | `/api/quiz` | Generate quiz from story text |
| `POST` | `/api/grade` | Grade a short/paragraph answer |
| `GET` | `/slides/:saveId` | Serve story_slides.json for a save |
| `GET` | `/images/:saveId/:filename` | Serve a character image |
| `GET` | `/` | Serve the visual novel HTML reader |

---

## Scenario Prompts

Scenario prompts live in `prompts/story/`. The system expects files named `scenario1_prompt.txt` through however many iterations you want. Each file describes what must happen in that chapter.

The default scenario arc:

| Iteration | Event |
|---|---|
| 1–2 | Separate daily lives in Seoul, characters do not meet |
| 3–4 | Towers appear across the world |
| 5 | Someone enters a tower and dies — global news |
| 6–7 | Daily life continues but tension builds |
| 8 | First monster outbreak |
| 9–10 | Escalating chaos |
| 11+ | Free phase — story continues naturally |

To extend the story, add `scenario11_prompt.txt`, `scenario12_prompt.txt`, etc.

---

## Known Limitations

- Character portrait generation (`gpt-image-1`) is slow — expect 30–90 seconds per character image. The story is playable before images finish; fallback silhouettes show in the meantime.
- The visual novel reader must be served through `api_server.js` at `localhost:3001`. Opening the HTML file directly in a browser will not work due to local file access restrictions.
- Scenario prompts only go up to whatever you create. If `run_story.js` is called for an iteration with no matching scenario file, it will throw an error.