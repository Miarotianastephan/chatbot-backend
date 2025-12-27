import { Injectable } from '@nestjs/common';
import { AiService } from './ai.service';

@Injectable()
export class ChatService {
  constructor(private readonly aiService: AiService) {}

  async processMessage(message: string, history: any[]): Promise<string> {
    // Add content filtering/validation here if needed
    
    // Call AI service
    const response = await this.aiService.generateResponse(message, history);
    
    return response;
  }
}