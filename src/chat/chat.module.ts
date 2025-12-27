import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { OllamaService } from './ai-few-shoted';

@Module({
  controllers: [ChatController],
  providers: [ChatService, AiService, OllamaService],
})
export class ChatModule {}