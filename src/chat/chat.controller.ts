import { Controller, Post, Body, Sse } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { Observable } from 'rxjs';
import { OllamaService } from './ai-few-shoted';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private ollamaService: AiService,
    private fewShotService: OllamaService) {}

  @Post()
  async chat(@Body() body: { message: string; history: any[] }) {
    const response = await this.chatService.processMessage(
      body.message,
      body.history || []
    );
    return { response };
  }

  @Post('stream')
  @Sse() // Server-Sent Events pour le streaming
  stream(@Body() body: { message: string; history: any[] }): Observable<string> {
    return new Observable(observer => {
      let fullResponse = '';

      this.ollamaService.generateResponseStream(
        body.message,
        body.history || [],
        (token) => {
          fullResponse += token;
          observer.next(token); // Envoie au frontend en temps réel
        },
        () => {
          observer.complete();
        }
      ).catch(err => observer.error(err));
    });
  }

  @Post('few-shot')
  async chatFewShoted(@Body() body: { message: string; history: any[] }) {
    const response = await this.fewShotService.generateResponse(
      body.message,
      body.history || []
    );
    return { response };
  }


}