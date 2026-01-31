# HaloAI

<div align="center">
  <h1>The Intelligent Desktop Assistant That Sees What You See</h1>
  <p>
    <b>Powered by Stellar Blockchain & Advanced AI</b>
  </p>
</div>

---

## 🚀 Overview

HaloAI is a **native desktop assistant** built to live *with* you, not just in a browser tab. It wakes up instantly with a global hotkey, **automatically captures and analyzes your screen**, and helps you execute tasks without breaking your flow.

Unlike traditional chatbots, HaloAI is integrated directly into your OS workflow with **global shortcuts**, **vision AI**, **voice input**, and an **embedded Stellar crypto wallet**.

## ✨ Key Features

### 🖥️ Native Desktop Experience
- **Instant Wake**: Summon HaloAI instantly with a customizable global hotkey
  - **macOS**: `Cmd + Shift + Space` (default)
  - **Windows/Linux**: `Ctrl + Space` (default)
  - Fully customizable in settings
- **Auto Screen Capture**: Automatically captures your screen when activated to understand context
- **Vision AI Analysis**: Analyzes screen content using **Llama 3.2 Vision** via OpenRouter
- **Contextual AI**: Detects what you're doing and adapts responses (coding, writing, email, Stellar operations)
- **Smart Actions**:
  - **Debug**: Reads stack traces and suggests fixes
  - **Draft**: Reads email threads and drafts responses in your tone
  - **Summarize**: Organizes meeting notes into actionable items
  - **Code**: Provides working, copy-paste ready solutions
- **Frameless UI**: Transparent, always-on-top window with glassmorphism design
- **System Tray Integration**: Runs in background, accessible anytime

### 💰 Built-in Stellar Wallet
- **Integrated Wallet**: Secure, non-custodial wallet powered by Stellar blockchain
- **Auto-Creation**: Wallets created on-demand via Privy authentication
- **Instant Transactions**: Send and receive XLM with natural language commands
- **Transaction History**: View recent transfers with full details (amount, sender, recipient, timestamp)
- **Portfolio View**: Real-time XLM balance display
- **Testnet Support**: Automatic Friendbot funding for testing
- **Secure Storage**: AES-256-GCM encrypted private keys in Supabase
- **Advanced Features**:
  - Trustline management for custom Stellar assets
  - Asset discovery (USDC, EURC, and more)
  - Safety warnings for cross-chain operations
  - Price information guidance

### 🤖 Advanced AI Capabilities
- **GLM 4.7 Model**: Powered by Cerebras for ultra-fast inference (via Z.ai)
- **Contextual System Prompts**: Automatically adapts to your task:
  - **Coding Mode**: Debug assistance with screen context
  - **Writing Mode**: Grammar fixes and content improvement
  - **Email Mode**: Professional email drafting
  - **Transfer Mode**: Structured JSON for Stellar transactions
  - **Balance/History Mode**: Portfolio and activity queries
  - **Asset Discovery**: Learn about Stellar tokens
  - **Trustline Mode**: Guided trustline creation with safety checks
  - **Advanced Mode**: Technical Stellar SDK assistance
  - **Safety Warnings**: Blocks dangerous cross-chain operations
- **Streaming Responses**: Real-time AI output with markdown rendering
- **Vision Context Integration**: Screen content automatically included in AI prompts
- **Fallback Mode**: Works without API keys in demo mode

### 🎙️ Voice & Multimodal
- **Voice Input**: Speak naturally using **Deepgram**'s ultra-fast speech-to-text
- **Real-time Transcription**: Live transcription with final text processing
- **Vision Analysis**: Automatic screen capture and OCR fallback (Tesseract.js)
- **Multimodal Context**: Combines voice, vision, and text for comprehensive understanding

### 🔐 Authentication & Security
- **Privy Integration**: Secure authentication for wallet access
- **Encrypted Storage**: Private keys encrypted with AES-256-GCM
- **Supabase Backend**: Secure cloud database for wallet data
- **Non-Custodial**: Users maintain full control of their keys
- **Session Management**: Persistent auth state with electron-store


## 🛠️ Tech Stack

This project is a **modern monorepo** managed by **TurboRepo** with **pnpm workspaces**.

### Desktop App (`apps/desktop`)
- **Runtime**: [Electron 28](https://www.electronjs.org/) with TypeScript
- **Frontend**: [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- **Styling**: [TailwindCSS 3.4](https://tailwindcss.com/)
- **UI Components**: Custom components with react-markdown, react-syntax-highlighter
- **State Management**: React hooks (useAI, useWallet, useAuth, useVision, useVoiceInput)
- **Storage**: electron-store for settings and preferences
- **Screen Capture**: Electron desktopCapturer API
- **OCR**: Tesseract.js for fallback text extraction
- **Build**: electron-builder for cross-platform packaging

### Server (`apps/server`)
- **Framework**: [Express 4](https://expressjs.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Blockchain**: [Stellar SDK 12.3](https://developers.stellar.org/docs/data/sdks/javascript)
- **Network**: Stellar Testnet (Horizon API)
- **Encryption**: Node.js crypto (AES-256-GCM with scrypt key derivation)
- **API Endpoints**:
  - `POST /api/wallets` - Create wallet
  - `GET /api/wallets/:userId` - Get wallet info
  - `POST /api/wallets/:userId/send` - Send XLM
  - `GET /api/wallets/:userId/transactions` - Transaction history

### Web App (`apps/web`)
- **Framework**: [Next.js 15.2](https://nextjs.org/) with App Router
- **UI Library**: [Shadcn/UI](https://ui.shadcn.com/) (Radix UI primitives)
- **Styling**: TailwindCSS with tailwindcss-animate
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Forms**: react-hook-form + zod validation
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Analytics**: Vercel Analytics

### AI Infrastructure
- **LLM**: [GLM 4.7](https://cerebras.ai/) via Cerebras API (Z.ai)
  - Model: `zai-glm-4.7`
  - Temperature: 1.0
  - Top-p: 0.95
  - Max tokens: 2048
  - Streaming support
- **Vision**: [OpenRouter](https://openrouter.ai/) (Llama 3.2 Vision)
- **Voice**: [Deepgram](https://deepgram.com/) speech-to-text API
- **OCR Fallback**: Tesseract.js for offline text extraction

## 🚀 Getting Started

### Prerequisites
- **Node.js 20.x** (specified in package.json engines)
- **pnpm 8.15.5+** (`npm install -g pnpm`)
- **Supabase account** (for wallet storage)
- **API Keys**:
  - Privy App ID
  - Cerebras API key
  - Deepgram API key
  - OpenRouter API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/HaloAI.git
   cd HaloAI
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Supabase**
   
   Create a `wallets` table in your Supabase project:
   ```sql
   CREATE TABLE wallets (
     id SERIAL PRIMARY KEY,
     privy_user_id TEXT UNIQUE NOT NULL,
     public_key TEXT NOT NULL,
     encrypted_secret TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **Set up Environment Variables**

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
   WALLET_ENCRYPTION_KEY=your_secure_encryption_key_32_chars_min
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   ```

   **Web (Optional - `apps/web/.env.local`):**
   ```bash
   # Add any web-specific env vars here
   ```

### Running the App

**Development Mode:**

```bash
# Run all apps (desktop, server, web)
pnpm dev

# Run only Desktop App
pnpm desktop

# Run only Web App
pnpm web

# Run only Server
pnpm server
```

**Build for Production:**

```bash
# Build all apps
pnpm build

# Build Desktop App (creates installers)
cd apps/desktop
pnpm build        # All platforms
pnpm build:win    # Windows only
pnpm build:mac    # macOS only
```

## 📂 Project Structure

```text
HaloAI/
├── apps/
│   ├── desktop/                      # Electron Desktop App
│   │   ├── electron/
│   │   │   └── main.ts               # Main process (window, shortcuts, IPC)
│   │   ├── src/
│   │   │   ├── App.tsx               # Main React component
│   │   │   ├── components/
│   │   │   │   ├── MessageBubble.tsx # Chat message rendering
│   │   │   │   ├── WalletPanel.tsx   # Wallet UI
│   │   │   │   ├── WalletSendForm.tsx
│   │   │   │   ├── TransactionHistory.tsx
│   │   │   │   ├── TransactionCard.tsx
│   │   │   │   ├── PortfolioCard.tsx
│   │   │   │   └── SettingsModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAI.ts          # AI chat with contextual prompts
│   │   │   │   ├── useWallet.ts      # Stellar wallet operations
│   │   │   │   ├── useAuth.ts        # Privy authentication
│   │   │   │   ├── useVision.ts      # Screen capture & vision analysis
│   │   │   │   └── useVoiceInput.ts  # Deepgram voice input
│   │   │   ├── services/
│   │   │   │   └── walletApi.ts      # API client for server
│   │   │   └── index.css             # Global styles
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── server/                       # Express API Server
│   │   ├── src/
│   │   │   ├── index.ts              # Server entry point
│   │   │   └── routes/
│   │   │       └── wallets.ts        # Wallet CRUD + Stellar operations
│   │   ├── package.json
│   │   └── wallets.db                # SQLite (legacy, now using Supabase)
│   │
│   └── web/                          # Next.js Landing Page
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx              # Landing page
│       │   └── globals.css
│       ├── components/               # UI components (78 files)
│       │   ├── hero-section.tsx
│       │   ├── dashboard-preview.tsx
│       │   ├── bento-section.tsx
│       │   ├── how-it-works-section.tsx
│       │   ├── faq-section.tsx
│       │   └── ... (Shadcn/UI components)
│       ├── lib/
│       │   └── utils.ts
│       ├── public/                   # Static assets
│       ├── package.json
│       └── next.config.mjs
│
├── packages/
│   └── ui/                           # Shared UI components (future)
│
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml               # pnpm workspace definition
├── turbo.json                        # TurboRepo configuration
└── README.md
```

## 🎯 Key Features Deep Dive

### Screen Capture & Vision Analysis
- **Auto-Capture**: Captures screen before showing window (captures what's underneath)
- **Retry Logic**: 3 attempts with 5-second timeout per attempt
- **Windows 11 Optimized**: 500ms delay for compositor reliability
- **Vision Processing**: Sends to OpenRouter for AI analysis
- **OCR Fallback**: Tesseract.js extracts text if vision fails
- **Context Injection**: Vision results automatically included in AI prompts

### Contextual AI System
HaloAI detects your intent and adapts its behavior:
- **Transfer Detection**: Extracts payment details, outputs structured JSON
- **Balance Queries**: Shows portfolio with real-time data
- **History Requests**: Displays transaction timeline
- **Coding Help**: Provides working code with explanations
- **Email Drafting**: Matches tone and context from screen
- **Safety Mode**: Blocks cross-chain operations (Ethereum, BSC, etc.)

### Stellar Wallet Features
- **Testnet Ready**: Automatic Friendbot funding
- **Transaction Signing**: Server-side signing with encrypted keys
- **Balance Tracking**: Real-time XLM balance updates
- **History**: Last 20 transactions with full details
- **Asset Support**: Native XLM + custom assets via trustlines
- **Safety Checks**: Validates addresses, prevents cross-chain errors

## 🔧 Configuration

### Global Shortcuts
- Default: `Cmd+Shift+Space` (macOS) or `Ctrl+Space` (Windows/Linux)
- Customizable in Settings modal
- `Escape` always hides the window

### AI Model Settings
- Model: `zai-glm-4.7` (GLM 4.7 via Cerebras)
- Temperature: 1.0 (recommended by Z.ai)
- Top-p: 0.95
- Max tokens: 2048
- Streaming: Enabled
- Clear thinking: Disabled (preserves reasoning for coding)

### Stellar Network
- Network: Testnet (Horizon: `https://horizon-testnet.stellar.org`)
- Friendbot: `https://friendbot.stellar.org`
- Base fee: 100 stroops (0.00001 XLM)
- Transaction timeout: 30 seconds

## 🛡️ Security

- **Encrypted Keys**: AES-256-GCM with scrypt key derivation
- **Secure Storage**: Supabase with service role key
- **Non-Custodial**: Users control their keys
- **HTTPS Only**: All API calls over secure connections
- **Input Validation**: Zod schemas for form validation
- **CORS**: Configured for localhost development

## 📝 License

[MIT](LICENSE)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.
