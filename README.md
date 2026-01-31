# HaloAI

<div align="center">
  <h1>The Intelligent Desktop Assistant That Sees What You See</h1>
  <p>
    <b>Powered by Cerebras GLM-4.7, Deepgram, and Stellar Blockchain</b>
  </p>
</div>

---

## 🚀 Overview

HaloAI is a native desktop assistant built to live *with* you, not just in a browser tab. It wakes up instantly, sees your screen, and helps you execute tasks without breaking your flow.

Unlike traditional chatbots, HaloAI is integrated directly into your OS workflow with global shortcuts, voice commands, and an embedded crypto wallet.

## ✨ Key Features

### 🖥️ Native Desktop Experience
- **Instant Wake**: Summon HaloAI instantly with a global hotkey.
  - **macOS**: `Cmd + Shift + Space`
  - **Windows/Linux**: `Ctrl + Space`
- **Context Vision**: Instantly captures your active window or screen to understand what you're working on.
- **Smart Actions**:
  - **Debug**: Segfault? HaloAI reads the stack trace and suggests a fix.
  - **Draft**: Reads email threads and drafts responses in your tone.
  - **Summarize**: Organizes meeting notes into actionable items.

### 💰 Built-in Crypto Wallet (Stellar)
- **Integrated Wallet**: Secure, non-custodial wallet powered by Stellar.
- **Instant Transactions**: Send and receive XLM instantly.
- **Transaction History**: View your recent transfers directly in the assistant.
- **Secure Auth**: Authentication managed via **Privy**.

### 🎙️ Voice & Multimodal
- **Voice Mode**: Speak naturally to HaloAI using **Deepgram**'s ultra-fast speech-to-text.
- **Vision**: Analyzes screen content using **Llama 3.2 Vision** (via OpenRouter).

## 🛠️ Tech Stack

This project is a modern monorepo managed by **TurboRepo**.

### Desktop App (`apps/desktop`)
- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **State/Auth**: Privy, electron-store

### Server (`apps/server`)
- **Framework**: [Express](https://expressjs.com/)
- **Database**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (Local `wallets.db`)
- **Blockchain**: [Stellar SDK](https://developers.stellar.org/docs/data/sdks/javascript)
- **Encryption**: AES-256-GCM for secure key storage

### AI Infrastructure
- **LLM Engine**: [Cerebras API](https://cerebras.ai/) (for instant inference)
- **Vision**: OpenRouter
- **Voice**: Deepgram API

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PNPM (`npm install -g pnpm`)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd haloai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables**

   **Desktop (`apps/desktop/.env`):**
   ```bash
   VITE_PRIVY_APP_ID=your_privy_app_id
   VITE_CEREBRAS_API_KEY=your_cerebras_key
   VITE_DEEPGRAM_API_KEY=your_deepgram_key
   VITE_OPENROUTER_API_KEY=your_openrouter_key
   VITE_API_URL=http://localhost:3001/api/wallets
   ```

   **Server (`apps/server/.env`):**
   ```bash
   PORT=3001
   WALLET_ENCRYPTION_KEY=your_secure_encryption_key
   ```

### Running the App

You can run the entire suite or individual parts.

```bash
# Run both Desktop and Server
pnpm dev

# Run only Desktop App
pnpm --filter @haloai/desktop dev

# Run only Server
pnpm --filter @haloai/server dev
```

## 📂 Project Structure

```text
haloai/
├── apps/
│   ├── desktop/                 # Electron Application
│   │   ├── electron/            # Main process (Shortcuts, Window mgmt)
│   │   └── src/                 # Renderer process (React UI)
│   │       ├── hooks/           # useAI, useWallet, useAuth
│   │       ├── components/      # Chat, WalletPanel, TransactionHistory
│   │       └── services/        # API clients
│   └── server/                  # Local API Server
│       ├── src/
│       │   ├── routes/          # Wallet endpoints
│       │   └── index.ts         # Server entry
│       └── wallets.db           # SQLite database
├── packages/
│   └── ui/                      # Shared UI components
└── package.json                 # Root dependencies
```

## 🛡️ License

[MIT](LICENSE)
