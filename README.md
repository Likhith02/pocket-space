# Pocket Space

Pocket Space is a mobile-first, AI-assisted prototype for capturing and organizing everyday information in one place. It is designed around a simple idea: students often save important things in too many places like notes apps, screenshots, bookmarks, reminders, and chat messages. Pocket Space brings those into one space and helps sort what matters.

## What It Does

- Capture notes, links, reminders, and image snapshots
- Keep everything in one timeline instead of across multiple apps
- Create short summaries automatically
- Sort entries into simple categories like tasks, ideas, memories, and references
- Surface high-priority items first in a focused dashboard
- Store data locally on the device for a lightweight, privacy-friendly experience
- Work offline after the first load with service worker support

## Why This Project Exists

Pocket Space was built as a product prototype inspired by "smart space" experiences such as Essential Space, but adapted into a simpler and more accessible web-based format. The goal was not to copy a system-level mobile feature exactly, but to explore how a student-friendly capture app could feel more helpful than a normal notes app.

## How It Works

This version does not use a large AI model yet. Instead, it uses lightweight rules to create an AI-like experience.

- It reads the title and details you save
- It looks for clue words like `pay`, `deadline`, `idea`, `article`, or `screenshot`
- It guesses the most likely category
- It creates a short summary
- It assigns a simple priority so urgent items rise to the top

That makes it fast, local-first, and easy to understand while still demonstrating the product idea.

## Student Use Cases

- Save assignment deadlines in one place
- Keep project ideas before you forget them
- Store useful tutorial links for later
- Save screenshots from class groups or event chats
- Review your most important pending items at the start of the day

## Tech Stack

- HTML
- CSS
- JavaScript
- Local Storage
- Progressive Web App manifest
- Service Worker for offline support

## Run Locally

### Quick Option

Open `index.html` in your browser for a simple preview.

### Recommended Option

Open a terminal in the project folder, then run:

```powershell
python -m http.server 8000
```

Then open:

[http://127.0.0.1:8000](http://127.0.0.1:8000)

### Windows Shortcut

You can also run:

```powershell
.\start-local.bat
```

## Use It On a Phone

1. Start the local server on your computer.
2. Make sure your phone and computer are on the same Wi-Fi network.
3. Find your computer's local IP address with:

```powershell
ipconfig
```

4. Open `http://YOUR-IP-ADDRESS:8000` in your phone browser.

Example:

`http://192.168.1.5:8000`

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- manifest.webmanifest
|-- sw.js
|-- start-local.bat
`-- assets/
    `-- icon.svg
```

## Current Limitations

- Data is stored in browser local storage, not a cloud database
- No account system or sync across devices
- No real AI API integration yet
- No Android-native packaging yet

## Future Improvements

- Real AI summarization and smarter search
- Voice note capture and transcription
- OCR for screenshots and image understanding
- Better reminders and calendar integration
- Android packaging for mobile installability
- IndexedDB support for larger saved files

## AI-Assisted Credit Note

This is an AI-assisted prototype. I contributed the project idea, user problem, direction, and product concept, while using AI support to help speed up implementation and prototyping. I want to be transparent about that.

## Open Source

This project is open source and available for learning, remixing, and improvement.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
