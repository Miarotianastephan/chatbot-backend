import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import * as fs from "fs/promises"
import * as path from 'path';
import { HttpException, HttpStatus } from "@nestjs/common";
import { performance } from "perf_hooks";
import * as osUtils from 'os-utils';

interface Examples { 
    user: string;
    response: string;
    mood: string;
    category: string;
    prefs: string;
}

@Injectable()
export class OllamaService implements OnModuleInit {
    private readonly ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    private readonly logger = new Logger(OllamaService.name);
    private datasets: Examples[] = [];
    // Prompt système pour inférer mood (ajoutez en propriété de classe ou constante)
    private moodInferencePrompt = `
    Infer the user's mood from this message. Choose from: playful, seductive, submissive, dominant, bratty, needy, aggressive, romantic, curious, shy.
    Output ONLY the mood name (e.g., "submissive"). No explanation.
    Message: {{message}}
    `;

    // Prompt système pour inférer category
    private categoryInferencePrompt = `
    Infer the category from this message. Choose from: soft-seductive, flirty-tease, classic-naughty, very-explicit, hardcore.
    Output ONLY the category name (e.g., "hardcore"). No explanation.
    Message: {{message}}
    `;

    async onModuleInit() {
        try {
            const filePath = path.join(
            process.cwd(),
                'dist',
                'assets',
                'shots',
                'd_extrait_eng.json'
            );
            const data = await fs.readFile(filePath, 'utf-8');    
            this.datasets = JSON.parse(data).map(entry => ({
                user: entry.user_message.msg,
                response: entry.bot_response.resp,
                mood: entry.user_profile.mood,
                category: entry.user_message.msg_category,
                prefs: entry.user_profile.prefs
            }));
            this.logger.log(`Dataset loaded: ${this.datasets.length} examples.`);
        } catch (error) {
            this.logger.error('Failed to load dataset', error);
            throw new HttpException('Dataset loading failed', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async generateResponse(message: string, history:any[]): Promise<string> {
        const startTime = performance.now();

        try {
            const inferredMood = this.inferMood(message);
            const inferredCategory = this.inferCategory(message);
            const examples = this.filterExamples(inferredMood, inferredCategory, 5);

            if(examples.length < 3) {
                this.logger.warn(`Few examples found for mood: ${inferredMood}, category: ${inferredCategory}`);
            }

            let dynamicPrompt = 'Example of response:\n';
            examples.forEach(ex => {
                dynamicPrompt += `User: ${ex.user}\nAssistant: ${ex.response}\n\n`;
            });
            dynamicPrompt += `User: ${message}\nAssistant:`;

            // logger the constructed prompt for debugging
            this.logger.debug(`Constructed Prompt: ${dynamicPrompt}`);  

            const messages = [
                ...history.map(h => ({
                    role: h.role === 'assistant' ? 'assistant' : 'user',
                    content: h.content
                })),
                {
                    role: 'user',
                    content: dynamicPrompt
                }
            ]

            const response = await fetch(`${this.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
            })
            if(!response.ok){
                throw new Error(`Ollama error: ${response.statusText}`);
            }
            
            const data = await response.json();
            const endtTime = performance.now();
            const latency = endtTime - startTime;
            // Mesure CPU/RAM après réponse (plus représentatif de la charge réelle)
            osUtils.cpuUsage((cpuPercent) => {
                const ramPercent = (1 - osUtils.freememPercentage()) * 100;
                this.logger.log(`[PERF] Latency: ${latency.toFixed(2)} ms | CPU: ${cpuPercent.toFixed(1)}% | RAM: ${ramPercent.toFixed(1)}%`);
            });
            return data.message?.content.trim() || 'I\'m unable to make your desire for now. Maybe later ?!';
        }catch (error) {
            const endtTime = performance.now();
            const latency = endtTime - startTime;
            this.logger.error(`[PERF] Error after ${latency.toFixed(2)}ms.`, error)
            throw new HttpException(
                'Failed to generate response. Ollama may be down.',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }

    private inferMood(message: string): string {
        const lower = message.toLowerCase();
        if (lower.match(/\bbeg|please|need you\b/)) return 'submissive';
        if (lower.match(/\bcommand|dominate|order\b/)) return 'dominant';
        if (lower.match(/\btease|fun|wink\b/)) return 'playful';
        // Ajoutez plus de regex pour précision
        return 'playful'; // Default
    }

    private inferCategory(message: string): string {
        const lower = message.toLowerCase();
        if (lower.match(/\bgentle|romantic|kiss\b/)) return 'soft-seductive';
        if (lower.match(/\bhard|rough|bdsm\b/)) return 'hardcore';
        if (lower.match(/\bdirty talk|naughty\b/)) return 'classic-naughty';
        // Plus de regex
        return 'classic-naughty';
    }

    private filterExamples(mood: string, category: string, count: number): Examples[] {
        return this.datasets
        .filter(ex => ex.mood === mood && ex.category === category)
        .slice(0, count);
    }

    
}