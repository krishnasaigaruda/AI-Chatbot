# Orbix AI

A free, open-source AI chatbot that runs in your browser. No accounts, no API keys, no server costs.

## Features

- **Free AI** — Powered by [Pollinations.ai](https://pollinations.ai) (free, no auth)
- **Code blocks** — Syntax-highlighted with copy button
- **Chat history** — Multiple chats saved in your browser (localStorage)
- **Markdown** — Bold, italic, lists, inline code rendered properly
- **Dark theme** — Clean, modern UI
- **Mobile friendly** — Responsive sidebar layout

## Quick Start

1. Make sure you have Python 3 installed
2. Run the server:
   ```bash
   cd "AI model custom"
   python3 server.py
   ```
3. Open http://localhost:8000
4. Click **Connect** and start chatting!

## How It Works

- `index.html` / `style.css` / `app.js` — Frontend chat UI
- `server.py` — Local Python server that serves static files and proxies AI requests to Pollinations.ai

The Python server acts as a proxy so that browser CORS restrictions don't block the AI API calls. Everything runs locally on your machine — the only external call is to Pollinations.ai's free inference API.

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend:** Python 3 standard library (no dependencies)
- **AI:** [Pollinations.ai](https://pollinations.ai) free text generation API

## Credits

- **AI API:** [Pollinations.ai](https://pollinations.ai) — Free, open-source AI API
- **Models:** Open-source LLMs hosted by Pollinations (Mistral, Llama, ChatGPT, etc.)
- **Inspiration:** Making AI accessible to everyone, for free

## License

MIT — do whatever you want with it. Just give credit to pollinations.com and if you would like, PLS give credit to my github account.
