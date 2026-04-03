# 🌆 Fantasy Hong Kong Learning System

An AI-powered storytelling system where children explore fantasy worlds through gates in Hong Kong and are later tested on language understanding.

---

## 🧱 Project Structure

| Type | Where |
|------|------|
| Prompt text | `/prompts/.../*.txt` |
| Logic (AI calls) | `/engines/*.js` |
| Data (JSON output) | `/data/...` |
| Images | `/outputs/images/` |

---

## 📂 Folder Overview

### `/prompts/`
Stores all AI prompts (DO NOT hardcode prompts in JS)

- `character/`
  - `generate_personality.txt`
  - `generate_appearance.txt`
  - `image_prompt.txt`
- `story/`
  - `generate_story.txt`
- `quiz/`
  - `generate_quiz.txt`
- `system/`
  - `style_prompt.txt`

---

### `/engines/`
Core logic for each system

- `character_engine.js`
- `story_engine.js`
- (future) `gate_engine.js`
- (future) `quiz_engine.js`

---

### `/data/`
Persistent system state (source of truth)

- `characters/` → saved character JSON
- `gates/` → gate data
- `worlds/` → world data
- `quizzes/` → generated quizzes
- `story/`
  - `story_log.txt` → full story
  - `story_state.json` → current state

---

### `/outputs/`
Generated assets

- `images/` → character images

---

## ⚙️ Core System Design

### Character Pipeline