# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A gamified study quiz application for elementary students. Static web app with no build system - runs directly in the browser.

## Running the Application

Serve the directory with a static server (required for fetch to work):
```bash
npx serve .
# or
python -m http.server 8000
```
Then open `http://localhost:8000` (or the port shown).

## Architecture

Single-page vanilla JavaScript application:

- **index.html** - Quiz UI with XP bar, theme selector, mode buttons, study/quiz areas, level-up modal
- **app.js** - All application logic (~500 lines): game state, XP/leveling, themes, spaced repetition, localStorage
- **style.css** - Styling with CSS custom properties for theming, animations, responsive design
- **content/current.json** - Quiz content loaded at runtime

## Key Systems

### XP & Leveling
- 10 base XP per correct answer
- Streak bonus: up to 5x multiplier
- Levels: Beginner → Student → Scholar → Expert → Master → Champion
- Config in `LEVELS` array

### Unlockable Themes
- Themes unlock at level milestones (Ocean at L2, Forest at L3, etc.)
- Theme colors defined in `THEMES` object
- Applied via CSS custom properties: `--primary`, `--accent`, `--bg`

### Spaced Repetition
- Each question has mastery score 0-5
- Correct answers increase mastery, wrong answers decrease it
- Lower mastery = higher weight in question selection
- Mastery 5 = mastered (shown with ⭐)

### localStorage
- Save key: `studyQuizSave`
- Stores: XP, level, unlocked themes, current theme, question mastery scores

## Game Modes

| Mode | Description |
|------|-------------|
| Study | Flashcard review - tap to reveal answers |
| Practice | Weighted question selection via spaced repetition |
| Streak | 2 wrong answers ends the session |
| Boss | Missed questions repeat until answered correctly |

## Quiz Data Format

The `content/current.json` file structure:

```json
{
  "title": "Quiz Title",
  "testDate": "optional date string",
  "questions": [...]
}
```

### Question Types

| Type | Required Fields |
|------|-----------------|
| `multiple_choice` | `id`, `type`, `prompt`, `choices` (array 2+), `answer` (string) |
| `true_false` | `id`, `type`, `prompt`, `answer` (boolean) |
| `short_answer` | `id`, `type`, `prompt`, `answer` (string) |
| `order` | `id`, `type`, `prompt`, `items` (array 2+), `answerOrder` (array) |
