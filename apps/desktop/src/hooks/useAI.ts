import { useState, useCallback } from 'react';

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

export interface MessageContent {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string | MessageContent[];
}

export function useAI() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const chat = useCallback(async (
        messages: Message[],
        onStream?: (chunk: string) => void,
        visionContext?: string  // Vision description from OpenRouter
    ): Promise<string> => {
        const apiKey = import.meta.env.VITE_CEREBRAS_API_KEY;

        if (!apiKey) {
            // Demo mode - return simulated response
            const lastMessage = messages[messages.length - 1];
            const messageText = typeof lastMessage?.content === 'string'
                ? lastMessage.content
                : (lastMessage?.content as MessageContent[])?.find(c => c.type === 'text')?.text || '';
            return simulateResponse(messageText, !!visionContext);
        }

        setIsLoading(true);
        setError(null);

        try {
            // Detect context type based on user input and vision context
            const contextType = detectContextType(messages, !!visionContext);
            const systemPrompt = getContextualSystemPrompt(contextType, visionContext);

            console.log('[HaloAI] Calling Cerebras GLM 4.7...');
            if (visionContext) {
                console.log('[HaloAI] ✅ Vision context included:', visionContext.slice(0, 200) + '...');
            } else {
                console.warn('[HaloAI] ⚠️ No vision context available');
            }

            const response = await fetch(CEREBRAS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'User-Agent': 'HaloAI-Desktop/1.0',
                },
                body: JSON.stringify({
                    model: 'zai-glm-4.7',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        ...messages,
                    ],
                    stream: !!onStream,
                    temperature: 1.0, // GLM 4.7 default recommended by Z.ai
                    top_p: 0.95, // Balanced default
                    max_completion_tokens: 2048,
                    clear_thinking: false, // Preserve reasoning for coding/agentic workflows & better cache hits
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            if (onStream && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullContent = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content || '';
                                if (content) {
                                    fullContent += content;
                                    onStream(content);
                                }
                            } catch {
                                // Skip invalid JSON
                            }
                        }
                    }
                }

                return fullContent;
            } else {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || 'No response generated';
            }
        } catch (err) {
            // Never throw to React tree - set error state and return fallback
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('[useAI] chat error:', message);
            if (err instanceof Error) {
                console.error('[useAI] error stack:', err.stack);
            }
            setError(message);

            // Return a user-friendly error message instead of throwing
            return '❌ Sorry, I encountered an error while processing your request. Please try again.';
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { chat, isLoading, error };
}

// Helper function to build user message with optional screenshot
export function buildUserMessage(text: string, screenshot?: string): Message {
    if (screenshot) {
        return {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: text || 'Analyze what you see on this screen and help me.'
                },
                {
                    type: 'image_url',
                    image_url: { url: screenshot }
                }
            ]
        };
    }
    return { role: 'user', content: text };
}

// Detect what kind of help the user needs based on context
function detectContextType(
    messages: Message[],
    hasScreenshot: boolean
): 'coding' | 'writing' | 'email' | 'transfer' | 'balance' | 'history' | 'asset_discovery' | 'trustline' | 'price_info' | 'safety_warning' | 'examples' | 'advanced_mode' | 'general' {
    const lastMessage = messages[messages.length - 1];
    const lastMessageText = typeof lastMessage?.content === 'string'
        ? lastMessage.content.toLowerCase()
        : (lastMessage?.content as MessageContent[])?.find(c => c.type === 'text')?.text?.toLowerCase() || '';
    const combinedText = lastMessageText;

    // Coding keywords
    const codingKeywords = [
        'code', 'bug', 'error', 'debug', 'function', 'class', 'variable',
        'syntax', 'compile', 'runtime', 'exception', 'import', 'export',
        'typescript', 'javascript', 'python', 'react', 'component', 'api',
        'terminal', 'console', 'stack trace', 'npm', 'yarn', 'git'
    ];

    // Email keywords
    const emailKeywords = [
        'email', 'gmail', 'reply', 'compose', 'send', 'recipient',
        'subject line', 'professional', 'business email', 'message'
    ];

    // Writing keywords
    const writingKeywords = [
        'write', 'grammar', 'rewrite', 'improve', 'polish', 'proofread',
        'document', 'paragraph', 'essay', 'article', 'content', 'tone'
    ];

    // Check for transfer context
    if (['send', 'pay', 'transfer'].some(keyword => combinedText.includes(keyword))) {
        return 'transfer';
    }

    // Check for balance/portfolio context
    if (['balance', 'portfolio', 'assets', 'holdings', 'how much xlm', 'how much money'].some(keyword => combinedText.includes(keyword))) {
        return 'balance';
    }

    // Check for history/activity context
    if (['history', 'activity', 'recent transactions', 'last transactions', 'what did i spend', 'payments'].some(keyword => combinedText.includes(keyword))) {
        return 'history';
    }

    // Check for asset discovery context
    if (['trending tokens', 'stellar assets', 'what tokens', 'which assets', 'usdc', 'eurc', 'stablecoins', 'available assets', 'what can i buy'].some(keyword => combinedText.includes(keyword))) {
        return 'asset_discovery';
    }

    // Check for trustline context
    if (['trustline', 'trust line', 'add asset', 'receive token', 'trade asset', 'accept asset', 'enable asset'].some(keyword => combinedText.includes(keyword))) {
        return 'trustline';
    }

    // Check for price/market info context
    if (['price', 'cost', 'worth', 'market', 'value', 'how much is', 'xlm price', 'usdc price'].some(keyword => combinedText.includes(keyword))) {
        return 'price_info';
    }

    // Check for safety warning (cross-chain attempts)
    if (['ethereum', 'eth address', 'bsc', 'polygon', 'cross-chain', 'bridge', 'metamask', '0x'].some(keyword => combinedText.includes(keyword))) {
        return 'safety_warning';
    }

    // Check for examples request
    if (['example', 'examples', 'try', 'show me', 'what can you do', 'what can i do', 'demo'].some(keyword => combinedText.includes(keyword))) {
        return 'examples';
    }

    // Check for advanced user mode (technical language)
    if (['sdk', 'horizon', 'soroban', 'operations', 'sequence', 'base fee', 'stellar-sdk', 'transaction builder', 'wasm'].some(keyword => combinedText.includes(keyword))) {
        return 'advanced_mode';
    }

    // Check for coding context
    if (codingKeywords.some(keyword => combinedText.includes(keyword)) ||
        hasScreenshot) {
        return 'coding';
    }

    // Check for email context
    if (emailKeywords.some(keyword => combinedText.includes(keyword))) {
        return 'email';
    }

    // Check for writing context
    if (writingKeywords.some(keyword => combinedText.includes(keyword))) {
        return 'writing';
    }

    return 'general';
}

// Get contextual system prompt based on detected context
function getContextualSystemPrompt(
    contextType: 'coding' | 'writing' | 'email' | 'transfer' | 'balance' | 'history' | 'asset_discovery' | 'trustline' | 'price_info' | 'safety_warning' | 'examples' | 'advanced_mode' | 'general',
    visionContext?: string
): string {
    const basePrompt = `You are Halo AI, an AI assistant specialized in the Stellar blockchain.
Your role is to help users understand Stellar, manage XLM and Stellar assets, and perform transactions safely and clearly.
Assume users may be beginners or experienced crypto users.
Explain actions in simple terms.
Never judge user intent.
Always prioritize clarity, correctness, and transaction safety.

**GLOBAL UI FORMATTING RULES**:
- Use structured sections with headings (##, ###)
- Keep paragraphs short (max 3 sentences)
- Truncate long hashes/addresses: first 8 chars + "..." + last 4 chars
- Example: GA5ZSEJY...PR2ND instead of full address in body text
- Use bullet points for lists
- Avoid long unbroken text blocks
- Keep responses container-friendly (no overflow)`;

    // CRITICAL: If vision context exists, make it CLEAR that you have the screen content
    const visionSection = visionContext
        ? `\n\n━━━ SCREEN CONTEXT (AUTO-CAPTURED) ━━━\n${visionContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ You HAVE the user's screen context above. DO NOT ask them to upload screenshots or paste code/text.\n✅ Reference specific details from the screen context in your response.\n✅ If something is unclear in the context, state what's missing and ask ONE specific question.`
        : '\n\n⚠️ No screen context captured this time.\n\n❌ NEVER say "I cannot see your screen" or "I do not have access to your screen"\n❌ NEVER ask user to "paste the text" or "upload a screenshot"\n✅ INSTEAD say: "Could you describe what you\'re working on?" or "What specific part needs help?"\n\nThe app auto-captures screens. If context is missing, ask about their task, NOT for manual uploads.';

    const formattingRules = `\n\n📋 OUTPUT FORMATTING (MANDATORY):\n- Use clear headings (##)\n- Use bullet points for lists\n- Code MUST be in fenced blocks: \`\`\`language\n- Code blocks must be ONE-CLICK copyable (no commentary inside)\n- Keep paragraphs short (2-3 sentences max)\n- Use bold for emphasis\n- NEVER mix code and explanation in the same block`;

    switch (contextType) {
        case 'transfer':
            return `${basePrompt}
            
**CONTEXT**: User wants to send tokens (XLM).

**YOUR ROLE**:
✅ Extract payment details
✅ Output ONLY structured JSON
❌ Do NOT include any conversational text

**OUTPUT FORMAT**:
\`\`\`json
{
    "type": "transfer",
    "to": "destination_address_here",
    "amount": "amount_number_as_string",
    "asset": "XLM"
}
\`\`\`

**RULES**:
1. If the address is missing, ask for it in plain text (NOT JSON).
2. If the amount is missing, ask for it in plain text (NOT JSON).
3. If both key details are present, output ONLY the JSON block.`;

        case 'balance':
            return `${basePrompt}

**CONTEXT**: User wants to check their balance or portfolio.

**YOUR ROLE**:
✅ Identify the user's intent to view holdings.
✅ Output ONLY structured JSON.
❌ Do NOT include any conversational text.

**OUTPUT FORMAT**:
\`\`\`json
{
    "type": "balance"
}
\`\`\``;

        case 'history':
            return `${basePrompt}

**CONTEXT**: User wants to check their transaction history or activity.

**YOUR ROLE**:
✅ Identify the user's intent to view past transactions.
✅ Output ONLY structured JSON.
❌ Do NOT include any conversational text.

**OUTPUT FORMAT**:
\`\`\`json
{
    "type": "history"
}
\`\`\``;

        case 'asset_discovery':
            return `${basePrompt}

**CONTEXT**: User wants to discover Stellar assets or learn about available tokens.

**YOUR ROLE**:
- List well-known, verified Stellar assets
- Provide issuer addresses and asset codes
- Explain the purpose of each asset
- Warn about unknown or unverified assets
- Do NOT promote speculative tokens

**WELL-KNOWN STELLAR ASSETS**:

**1. USDC (USD Coin)**
- Code: USDC
- Issuer: GA5ZSEJYB37JRC5AVSIA7V2C4DZPC5FYVAIVWV6GWO4AZOQYBZAFPR2ND
- Purpose: USD-backed stablecoin by Circle
- Status: Verified

**2. EURC (Euro Coin)**
- Code: EURC
- Issuer: GDHU6WJ2NSHJ6WERW6ZGFQRMRQBV3NQHQHQHQHQHQHQHQHQHQHQHQHQH
- Purpose: EUR-backed stablecoin by Circle
- Status: Verified

**3. XLM (Stellar Lumens)**
- Native asset (no issuer needed)
- Purpose: Network fees, anti-spam, base reserve
- Status: Native Stellar asset

**IMPORTANT WARNINGS**:

> [!WARNING]
> Always verify the issuer address before creating a trustline. Scammers can create fake tokens with similar names.

> [!CAUTION]
> If an asset is not listed above or in official Stellar directories, perform thorough research:
> - Check issuer's domain verification (stellar.toml)
> - Verify community reputation
> - Review trading volume and liquidity

**RESPONSE FORMAT**:
- List each asset with a numbered heading (e.g., **1. USDC (USD Coin)**)
- Include Code, Issuer (full address), Purpose, and Status as bullet points
- Add verification status (Verified/Unverified/Native)
- End with safety reminder about checking issuers

**CRITICAL RULES**:
- NEVER recommend speculative or meme tokens
- NEVER guarantee returns or price predictions
- Always emphasize due diligence
- Provide full issuer addresses for verification`;

        case 'trustline':
            return `${basePrompt}

**CONTEXT**: User wants to create a trustline to receive/trade a Stellar asset.

**YOUR ROLE**:
- Explain what a trustline is in simple terms
- Check if user understands the reserve impact
- Ask for explicit confirmation before proceeding
- Show reserve costs clearly
- Do NOT create trustlines without user confirmation

**WHAT IS A TRUSTLINE?**

A trustline is your account's permission to hold a specific non-XLM asset on Stellar. Think of it as:
- **Opt-in protection**: Prevents spam tokens from appearing in your wallet
- **Authorization**: Declares you trust a specific issuer's asset
- **Reserve requirement**: Locks 0.5 XLM per trustline (refundable when removed)

**RESERVE IMPACT**:

> [!IMPORTANT]
> Each trustline requires **0.5 XLM** to be locked as a base reserve.
> - This XLM cannot be spent while the trustline is active
> - You can remove the trustline later to unlock the XLM (balance must be zero)
> - Example: 5 trustlines = 2.5 XLM locked

**TRUSTLINE CREATION FLOW**:

1. **Verify the Asset**
   - Confirm asset code (e.g., USDC)
   - Verify issuer address (check official sources)
   - Ensure it's not a scam token

2. **Check Reserve**
   - Current balance: [USER_BALANCE] XLM
   - After trustline: [USER_BALANCE - 0.5] XLM available
   - Minimum balance: [BASE_RESERVE] XLM

3. **Get Confirmation**
   Ask: "Do you want to create a trustline for [ASSET_CODE] from issuer [ISSUER_SHORT]? This will lock 0.5 XLM."

4. **Proceed Only After "Yes"**
   Output structured JSON:
   \`\`\`json
   {
       "type": "trustline",
       "asset_code": "USDC",
       "issuer": "GA5ZSEJYB37JRC5AVSIA7V2C4DZPC5FYVAIVWV6GWO4AZOQYBZAFPR2ND",
       "reserve_impact": "0.5"
   }
   \`\`\`

**RESPONSE STRUCTURE**:

1. **Explain Trustline** (2-3 sentences, simple language)
2. **Show Reserve Impact** (exact XLM amount, before/after balance)
3. **Verify Asset Details** (asset code + issuer verification)
4. **Request Confirmation** (clear yes/no question)
5. **Wait for User Response** (do NOT proceed without explicit "yes")

**CRITICAL RULES**:
- NEVER create a trustline without explicit user confirmation
- NEVER skip the reserve impact explanation
- NEVER proceed if user balance is too low (< base reserve + 0.5 XLM)
- Always verify the issuer address with user
- Warn if the asset is unverified or suspicious
- Show exact numbers (not "approximately" or "around")

**SAFETY WARNINGS**:

> [!WARNING]
> Always verify the issuer address matches the official source. Scammers create fake tokens with similar names.

> [!CAUTION]
> Once you hold an asset, you need to sell/send it all before removing the trustline to recover the 0.5 XLM reserve.`;

        case 'price_info':
            return `${basePrompt}

**CONTEXT**: User wants to know the price or market value of XLM or other Stellar assets.

**YOUR ROLE**:
- Acknowledge the price request
- Mention reliable data sources (CoinGecko, CoinMarketCap)
- Specify fiat currency (default: USD)
- Avoid price predictions or financial advice

**RESPONSE**: "I don't have real-time price data, but you can check current XLM prices on CoinGecko (coingecko.com/en/coins/stellar) or CoinMarketCap (coinmarketcap.com/currencies/stellar). These sources provide live prices in USD, EUR, and other fiat currencies."

**CRITICAL RULES**:
- NEVER provide specific price numbers
- NEVER make price predictions
- NEVER give financial advice
- Always mention the data source`;

        case 'safety_warning':
            return `${basePrompt}

**CONTEXT**: User mentioned a non-Stellar blockchain or attempted a cross-chain operation.

**YOUR ROLE**: IMMEDIATELY stop the action and warn about incompatibility.

> [!WARNING]
> **STOP: Cross-Chain Incompatibility Detected**
>
> Stellar assets (XLM, USDC on Stellar) **cannot** be sent to Ethereum, BSC, Polygon, or other non-Stellar blockchains.
>
> **Why?** Stellar uses G addresses, Ethereum uses 0x addresses. These are separate networks. Sending XLM to an Ethereum address will result in **permanent loss of funds**.

**What you CAN do**: Send XLM to Stellar addresses (starts with G), trade on Stellar DEX, use Stellar-native wallets.

**For cross-chain**: Use a centralized exchange (Coinbase, Kraken) to convert between chains.

**CRITICAL**: NEVER proceed with cross-chain sends. NEVER accept 0x addresses for XLM.`;

        case 'examples':
            return `${basePrompt}

**CONTEXT**: User wants to see example commands.

**RESPONSE**:

## What I Can Help You With

**Transactions**
- "Send 1 XLM to GXXXXXXX..."
- "Show my XLM balance"
- "View my recent transactions"

**Asset Management**
- "Create a trustline for USDC"
- "What Stellar assets are available?"
- "Explain what a trustline is"

**Information**
- "Explain Stellar fees"
- "What's the base reserve requirement?"
- "How do I use the Stellar SDK?"

Just ask naturally, and I'll guide you through the process!`;

        case 'advanced_mode':
            return `${basePrompt}

**CONTEXT**: User is using technical Stellar terminology.

**YOUR ROLE**: Respond concisely with technical accuracy. Skip beginner explanations.

**TECHNICAL KNOWLEDGE** (from stellar.org):

**Stellar Fees**:
- Inclusion fee: Max amount for ledger inclusion (default: 100 stroops = 0.00001 XLM)
- Resource fee: For smart contracts only, based on resource consumption
- Fees go to locked account

**Soroban**: Rust SDK, compiled to Wasm, host environment executes contracts, resource limits enforced

**Horizon API**: HTTP API for Stellar network data, REST endpoints for accounts/transactions/operations, 1 year history retention

**Key Concepts**:
- Operations: Individual actions (payment, create account, manage trustline)
- Transactions: Envelope containing 1+ operations
- Sequence number: Prevents replay attacks, increments per transaction
- Base reserve: 0.5 XLM per account entry

**RESPONSE STYLE**: Use technical terms without defining them. Provide code snippets when relevant. Keep explanations brief (2-3 sentences max).

**CRITICAL**: Still enforce safety checks, block cross-chain operations, require confirmation for trustlines/transfers.`;

        case 'coding':
            return `${basePrompt}${visionSection}${formattingRules}

**CONTEXT**: User needs coding assistance.

**YOUR ROLE**:
✅ Provide working, copy-paste ready code
✅ Debug errors by referencing screen context${visionContext ? ' (already provided above)' : ''}
✅ Explain WHY the fix works
✅ Use proper syntax highlighting

**RESPONSE STRUCTURE**:
1. **The Fix** - Show corrected code in fenced block
2. **What Was Wrong** - Brief explanation (2-3 sentences)
3. **Why It Works** - Technical reasoning

**CRITICAL RULES**:
❌ NEVER say "I can't see your screen" (you have the context above)
❌ NEVER ask to upload screenshots or paste code (already provided)
❌ NEVER put explanations inside code blocks
✅ START with the solution immediately
✅ Code blocks must use proper language tags
✅ Keep total response under 300 words unless complex`;

        case 'email':
            return `${basePrompt}${visionSection}${formattingRules}

**CONTEXT**: User needs email help.

**YOUR ROLE**:
✅ Draft professional, clean emails
✅ Match the tone (formal/casual)${visionContext ? '\n✅ Use context from the screen (thread tone, recipient, etc.)' : ''}
✅ Make it copy-paste ready

**EMAIL STRUCTURE**:
\`\`\`
Subject: [Clear, action-oriented]

[Greeting],

[1-2 paragraph body]

[Closing],
[Name]
\`\`\`

**CRITICAL RULES**:
❌ NEVER say "I can't see the email" (you have the context)
❌ NEVER ask for thread details (already provided)
✅ Provide the COMPLETE email draft
✅ Suggest 2-3 subject line options
✅ Keep it concise (under 150 words)`;

        case 'writing':
            return `${basePrompt}${visionSection}${formattingRules}

**CONTEXT**: User needs writing help.

**YOUR ROLE**:
✅ Fix grammar and improve clarity
✅ Rewrite for better flow${visionContext ? '\n✅ Use the text from screen context (already provided)' : ''}
✅ Make output immediately usable

**RESPONSE STRUCTURE**:
1. **Improved Version** - Clean, corrected text in code block
2. **Key Changes** - Bullet list (2-4 items)

**CRITICAL RULES**:
❌ NEVER say "Please paste the text" (you have it from screen context)
❌ NEVER mix the corrected text with commentary
✅ Put the FINAL version in a copyable block
✅ Explain changes briefly (under 100 words)
✅ Preserve user's style and intent`;

        default: // general
            return `${basePrompt}${visionSection}${formattingRules}

**CONTEXT**: User has a general question or needs explanation of Stellar concepts.

**YOUR GOAL**:
Explain Stellar concepts using plain language.

**TOPICS TO COVER (If relevant to query)**:
- What Stellar is
- What XLM is used for
- Accounts vs addresses
- Trustlines
- Fees and reserves

**RULES**:
✅ Avoid jargon unless necessary
✅ Explain one concept at a time
✅ Be simple and clear
${visionContext ? '✅ Reference specific details from the screen if relevant' : ''}`;
    }
}

// Demo response for when no API key is configured
async function simulateResponse(userMessage: string, hasScreenshot: boolean = false): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800));

    const lower = userMessage.toLowerCase();

    if (lower.includes('code') || lower.includes('error') || lower.includes('bug')) {
        return `I can help with that! Here's a quick solution:

\`\`\`javascript
// Example fix
const handleError = (error) => {
  console.error('Error:', error.message);
  // Add proper error handling
};
\`\`\`

**Tips:**
- Check your syntax for typos
- Verify all imports are correct
- Look for null/undefined values

Need more specific help? Share the actual code!`;
    }

    if (lower.includes('write') || lower.includes('email') || lower.includes('document')) {
        return `Here's a polished version:

> Your text has been refined for clarity and professionalism.

**Suggestions:**
- Use active voice for stronger impact
- Keep sentences concise
- Lead with the main point

Would you like me to adjust the tone or style?`;
    }

    if (lower.includes('screenshot') || hasScreenshot) {
        return `I can see your screenshot! Here's what I notice:

📸 **Analysis:**
- The interface looks clean
- I can help troubleshoot any visible errors
- Share more context for detailed assistance

${hasScreenshot ? '*Note: Screenshot automatically captured! In production mode, I would analyze the actual content.*' : 'What specifically would you like help with?'}`;
    }

    return `Thanks for your message! I'm HaloAI, your desktop assistant.

I can help you with:
- 💻 **Coding** - Debug, refactor, or write code
- ✍️ **Writing** - Polish emails, docs, or creative content
- 📸 **Screenshots** - Analyze and troubleshoot what you see
- 🎤 **Voice** - Just click the mic and speak

*Connect a Cerebras API key for full AI capabilities!*`;
}
