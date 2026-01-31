# HaloAI

<div align="center">
  <a href="LINK_TO_YOUR_YOUTUBE_VIDEO_OR_LOOM">
    <img src="https://github.com/samarthsaxena2004/haloAI/blob/main/apps/web/public/images/photo_2026-01-24%2023.42.34.jpeg" alt="Watch HaloAI Demo" />
  </a>
  <h1>The Intelligent Desktop Assistant That Sees What You See</h1>
  <p>
    <b>Powered by <b>Cerebras GLM-4.7</b> & Built rapidly with <b>Cline</b>
  </p>
  <p>
    <a href="https://github.com/samarthsaxena2004/haloai/issues">Report Bug</a> ·
    <a href="https://github.com/samarthsaxena2004/haloai/issues">Request Feature</a> 
  </p>
</div>

---

## The "Why" (Our Story)

We've all been there: you're debugging a cryptic error, or staring at a blank email draft, and you have to context-switch. You alt-tab to a browser, copy-paste your code/text into ChatGPT, only to lose your flow.

**We built HaloAI because we wanted an assistant that lives *with* us, not in a browser tab.**

We didn't want another chatbot. We wanted a "tap-on-the-shoulder" companion — something that wakes up instantly, looks at our screen, and says "I see what you're working on, here's the fix."

With just two of us and 24 hours, we set out to build exactly that — a native OS-like experience that feels like magic.

## Use Cases

<div align="center">
  <img src="https://github.com/samarthsaxena2004/haloAI/blob/main/apps/web/public/images/useCase1.png" alt="HaloAI Demo - Coding" />
  <p><strong>Use case: Coding & Debugging</strong><br>Instantly analyze stack traces, suggest fixes, explain errors, or generate code snippets right from your editor/terminal.</p>
</div>

<div align="center">
  <img src="https://github.com/samarthsaxena2004/haloAI/blob/main/apps/web/public/images/195_1x_shots_so.png" alt="HaloAI Demo - Note Taking" />
  <p><strong>Use case: Note Taking & Meetings</strong><br>Summarize messy meeting notes, extract action items, or turn bullet points into structured outlines — all from what's visible on screen.</p>
</div>

<div align="center">
  <img src="https://github.com/samarthsaxena2004/haloAI/blob/main/apps/web/public/images/useCase2.png" alt="HaloAI Demo - Messaging/Email" />
  <p><strong>Use case: Messaging & Email</strong><br>Read the conversation/email thread on screen and draft thoughtful replies in your personal tone, without context switching.</p>
</div>

## The Cerebras & Cline Experience

This project wouldn't have been possible in this timeframe without our core tech stack. Here's what we learned:

### Cerebras GLM-4.7: "It feels instant"

The biggest bottleneck for desktop assistants is usually latency. Waiting 5–10 seconds for a response breaks the magical "assistant" feeling.

- **What worked**: We plugged in Cerebras GLM-4.7 and were blown away. The token generation is so fast that the answer often appears before we finish blinking.
- **The Trick**: We streamed the response directly to our "Message Bubble" component. Because Cerebras is so fast, the UI feels like it's thinking *with* you, rather than processing *for* you.

### Cline: "Vibe Coding"

We practiced "Vibe Coding" — focusing on high-level logic and UX "vibe" while Cline handled the heavy lifting.

- **Rapid Prototyping**: We used Cline to scaffold the entire Electron + React + Vite monorepo structure in minutes, not hours.
- **Refactoring**: When we changed our mind about the design (switching from a sidebar to a floating spotlight search style), Cline refactored the Tailwind classes across multiple files instantly.
- **Learnings**: Providing Cline with a "Context" screen of our current file structure helped it make smarter decisions about where to place new components.

## Challenges Faced

During the intense 24-hour hackathon, we encountered a few rate-limiting hurdles:

1. We initially faced rate limit issues with Cerebras inference. These were later resolved by the Cerebras team, who generously increased the allowed rate limit for hackathon participants to 25M tokens.
2. We also ran into rate limit issues with Cline. The Cline team quickly addressed this for all hackathon participants and additionally introduced us to their new IDE extension, which proved very helpful during development.

Huge thanks to both the Cerebras and Cline teams for their fast support — it was critical to getting the project finished on time.

## What It Does

- **Instant Wake**: Double-tap `Option` (or your custom bind) to summon it. No clicks required.
- **Context Vision**: Captures your active window or full screen instantly. No file uploads needed.
- **Smart Actions**:
  - **Debug**: Segfault? Just invoke HaloAI. It reads the stack trace and suggests a fix.
  - **Draft**: Staring at a blank reply? It reads the email thread and drafts a response in your tone.
  - **Summarize**: Meeting notes on screen? It organizes them into action items.
- **Voice Mode**: Don't want to type? Just speak. Integrated **Deepgram** for near-instant transcription.

## Tech Stack

This project uses a modern monorepo architecture managed by **TurboRepo**.

### Desktop App (`apps/desktop`)

- **Framework**: [Electron](https://www.electronjs.org/) + [Vite](https://vitejs.dev/)
- **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Vision**: OpenRouter (Llama 3.2 Vision) / Tesseract.js (OCR Fallback)
- **Voice**: [Deepgram API](https://deepgram.com/) for speech-to-text

### Web Landing (`apps/web`)

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI Components**: [Shadcn/UI](https://ui.shadcn.com/) + [Framer Motion](https://www.framer.com/motion/)

### AI & Infrastructure

- **Inference**: [Cerebras API](https://cerebras.ai/) (GLM-4.7)
- **Package Manager**: [PNPM](https://pnpm.io/)

## Getting Started

### Prerequisites

- Node.js 18+
- PNPM (`npm install -g pnpm`)

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/samarthsaxena2004/haloai.git
   cd haloai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables**
   Copy `.env.example` to `.env` in `apps/desktop` and fill in your keys:
   ```bash
   cp apps/desktop/.env.example apps/desktop/.env
   ```
   
   **Required Keys:**
   - `VITE_CEREBRAS_API_KEY`: Get from [Cerebras Cloud](https://cloud.cerebras.ai/)
   - `VITE_DEEPGRAM_API_KEY`: Get from [Deepgram](https://deepgram.com/)
   - `VITE_OPENROUTER_API_KEY`: (Optional) For advanced vision capabilities

### Running the App

You can run the entire suite (Desktop + Web) or individual parts.

```bash
# Run everything (Desktop App + Landing Page)
pnpm dev

# Run only Desktop App
pnpm --filter desktop dev

# Run only Web Landing Page
pnpm --filter web dev
```

## Project Structure

A high-level overview of our monorepo structure:

```text
samarthsaxena2004/haloai/
├── apps/
│   ├── desktop/                 # Electron Application
│   │   ├── electron/            # Main process code
│   │   └── src/                 # Renderer process (React)
│   │       ├── hooks/           # AI, Vision, Voice hooks
│   │       └── components/      # Chat & UI components
│   └── web/                     # Next.js Landing Page
│       ├── app/                 # App Router pages
│       └── components/          # Marketing sections (Bento grids, Hero)
├── packages/
│   ├── ui/                      # Shared UI components
│   └── api-client/              # Typed API wrappers
├── turbo.json                   # TurboRepo configuration
└── package.json                 # Root dependencies
```

## Hackathon Context

- **Challenge**: Build a project in under 24 hours.
- **Tools Used**: 
    - **Cline**: For rapid systematic coding and refactoring.
    - **Cerebras**: utilized for its insane token generation speed, making the assistant feel instant.
    - **Electron**: For cross-platform desktop capabilities.

## The Team

- **Maaz** - [GitHub](https://github.com/somewherelostt)
- **Samarth Saxena** - [GitHub](https://github.com/samarthsaxena2004)

---

<div align="center">
  Made by <b>Samarth Saxena</b> & <b>Maaz</b>
</div>
