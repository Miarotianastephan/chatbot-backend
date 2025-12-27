import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  async generateResponse(message: string, history: any[]): Promise<string> {
    try {
      const messages = [
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'my-adult-chatbot-v2:latest',
          messages: messages,
          stream: false,
          options: {
            temperature: 0.65,
            num_predict: 200,     // ~100-150 mots max
            top_p: 0.94,
            repeat_penalty: 1.25
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.message?.content.trim() || 'Unable to generate response';
        
    } catch (error) {
      console.error('Ollama Error:', error);
      throw new HttpException(
        'Failed to generate AI response. Make sure Ollama is running.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateResponseStream(
    message: string,
    history: any[],
    onToken: (token: string) => void, // Callback appelé à chaque token
    onComplete?: () => void
  ): Promise<void> {
    try {
      const messages = [
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'my-adult-chatbot-v2:latest',
          messages: messages,
          stream: true, // ← ACTIVÉ
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      // Streaming : lecture ligne par ligne (Ollama envoie du NDJSON)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const content = json.message?.content || '';
            if (content) {
              onToken(content); // Envoie chaque token au frontend
            }
            if (json.done) {
              onComplete?.();
            }
          } catch (e) {
            // Ignorer les lignes invalides
          }
        }
      }
    } catch (error) {
      console.error('Ollama Streaming Error:', error);
      throw new HttpException(
        'Failed to stream AI response.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}