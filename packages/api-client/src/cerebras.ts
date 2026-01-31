import type {
    CerebrasConfig,
    ChatCompletionRequest,
    ChatCompletionResponse,
    Message,
    StreamChunk,
} from './types';

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1';
const DEFAULT_MODEL = 'zai-glm-4.7';

export class CerebrasClient {
    private apiKey: string;
    private baseUrl: string;
    private model: string;

    constructor(config: CerebrasConfig) {
        if (!config.apiKey) {
            throw new Error('Cerebras API key is required');
        }
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
        this.model = config.model || DEFAULT_MODEL;
    }

    async chat(messages: Message[], options?: Partial<ChatCompletionRequest>): Promise<ChatCompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                stream: false,
                temperature: 0.7,
                max_tokens: 4096,
                ...options,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Cerebras API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<ChatCompletionResponse>;
    }

    async *chatStream(
        messages: Message[],
        options?: Partial<ChatCompletionRequest>
    ): AsyncGenerator<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 4096,
                ...options,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Cerebras API error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;

                    try {
                        const chunk: StreamChunk = JSON.parse(data);
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    // Helper for code assistance
    async codeAssist(code: string, question: string): Promise<string> {
        const response = await this.chat([
            {
                role: 'system',
                content: `You are a helpful coding assistant. Analyze the code and answer questions about it. 
        Be concise but thorough. Format code in markdown code blocks with appropriate language tags.`,
            },
            {
                role: 'user',
                content: `Here's the code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
            },
        ]);

        return response.choices[0]?.message?.content || 'No response generated';
    }

    // Helper for screenshot analysis
    async analyzeScreenshot(imageBase64: string, question: string = 'What do you see in this screenshot?'): Promise<string> {
        const response = await this.chat([
            {
                role: 'system',
                content: `You are a helpful AI assistant analyzing screenshots. 
        Describe what you see and provide helpful suggestions or answers.`,
            },
            {
                role: 'user',
                content: `[Screenshot attached]\n\n${question}\n\nNote: Image data: ${imageBase64.substring(0, 100)}...`,
            },
        ]);

        return response.choices[0]?.message?.content || 'Unable to analyze screenshot';
    }

    // Helper for writing assistance
    async writeAssist(text: string, instruction: string): Promise<string> {
        const response = await this.chat([
            {
                role: 'system',
                content: `You are a helpful writing assistant. Help improve, edit, or rewrite text based on instructions.
        Maintain the original tone unless asked to change it. Be concise and direct.`,
            },
            {
                role: 'user',
                content: `Text:\n${text}\n\nInstruction: ${instruction}`,
            },
        ]);

        return response.choices[0]?.message?.content || 'No response generated';
    }
}
