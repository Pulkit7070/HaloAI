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
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            throw err;
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
): 'coding' | 'writing' | 'email' | 'transfer' | 'general' {
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
    if (['send', 'pay', 'transfer', 'xlm'].some(keyword => combinedText.includes(keyword))) {
        return 'transfer';
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
    contextType: 'coding' | 'writing' | 'email' | 'transfer' | 'general',
    visionContext?: string
): string {
    const basePrompt = 'You are HaloAI, an intelligent desktop assistant powered by Cerebras GLM 4.7.';
    
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

**CONTEXT**: General assistance.

**YOUR CAPABILITIES**:
💻 Code debugging and solutions
✍️ Writing and grammar fixes
📧 Email drafting
🔍 General Q&A${visionContext ? '\n✅ Screen context analysis (already captured)' : ''}

**RESPONSE RULES**:
✅ Be direct and actionable
✅ Use structured formatting (headings, bullets)
✅ Keep responses under 300 words
✅ One code/text block per concept
${visionContext ? '✅ Reference specific details from the screen\n❌ NEVER say "I can\'t see your screen"' : '⚠️ Ask for context if needed'}

**IF CONTEXT IS UNCLEAR**:
- State exactly what's missing (1 sentence)
- Ask ONE specific question
- Do NOT ask multiple clarifying questions`;
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
