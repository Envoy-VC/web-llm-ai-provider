import {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1CallWarning,
	LanguageModelV1FinishReason,
	LanguageModelV1FunctionToolCall,
	LanguageModelV1ImagePart,
	LanguageModelV1LogProbs,
	LanguageModelV1Prompt,
	LanguageModelV1ProviderMetadata,
	LanguageModelV1StreamPart,
	LanguageModelV1TextPart,
	LanguageModelV1ToolCallPart,
	LanguageModelV1ToolResultPart,
	UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import { WebLLMModelId, WebLLMChatLanguageModelOpts } from '../types';
import {
	ChatCompletionMessageParam,
	MLCEngine,
	ResponseFormat,
} from '@mlc-ai/web-llm';

import createDebug from 'debug';

const debug = createDebug('webllm-ai');
export const objectStartSequence = ' ```json\n';
export const objectStopSequence = '\n```';

type ContentType =
	| string
	| (LanguageModelV1TextPart | LanguageModelV1ImagePart)[]
	| (LanguageModelV1TextPart | LanguageModelV1ToolCallPart)[]
	| LanguageModelV1ToolResultPart[];

function getStringContent(content: ContentType): string {
	if (typeof content === 'string') {
		return content.trim();
	} else if (Array.isArray(content) && content.length > 0) {
		const [first] = content;
		if (first.type !== 'text') {
			throw new UnsupportedFunctionalityError({ functionality: 'toolCall' });
		}
		return first.text.trim();
	} else {
		return '';
	}
}

export class WebLLMChatLanguageModel implements LanguageModelV1 {
	readonly specificationVersion = 'v1';
	readonly defaultObjectGenerationMode = 'json';
	readonly modelId: WebLLMModelId = 'phi-1_5-q4f16_1-MLC-1k';
	readonly provider = 'gemini-nano';
	readonly supportsImageUrls = false;
	readonly supportsStructuredOutputs = false;

	private engine!: MLCEngine;
	private options: WebLLMChatLanguageModelOpts;

	constructor(
		modelId?: WebLLMModelId,
		options: WebLLMChatLanguageModelOpts = {}
	) {
		this.modelId = modelId ?? 'phi-1_5-q4f16_1-MLC';
		this.options = options;
	}

	private getEngine = async (): Promise<MLCEngine> => {
		if (this.engine) return this.engine;
		debug('Loading engine...');
		const engine = new MLCEngine(this.options);
		await engine.reload(this.modelId);
		debug('Engine loaded');
		this.engine = engine;
		return engine;
	};

	private formatMessages = (
		options: LanguageModelV1CallOptions
	): Array<ChatCompletionMessageParam> => {
		let prompt: LanguageModelV1Prompt = options.prompt;
		debug('before format prompt:', prompt);

		const messages: ChatCompletionMessageParam[] = [];

		if (options.mode.type === 'object-json') {
			console.log(prompt);
			const schema = options.mode.schema ?? ``;
			const description = options.mode.description ?? '';
			// prompt.shift();
			// prompt.unshift({
			// 	role: 'system',
			// 	content: `Throughout our conversation, always start your responses with "{" and end with "}", ensuring the output is a concise JSON object and strictly avoid including any comments, notes, explanations, or examples in your output.\nThe JSON schema to use is ${schema}. ${
			// 		description && `Here are some additional details: \n${description}\n`
			// 	}\nAdhere to this format for all queries moving forward. write only a code block starting with \`\`\`json and ending with \`\`\`, nothing else in the code.`,
			// });
		}

		for (let i = 0; i < prompt.length; i++) {
			const { role, content } = prompt[i];
			const contentString = getStringContent(content as ContentType);
			if (role === 'tool') {
				messages.push({
					role,
					content: contentString,
					tool_call_id: content[0].toolCallId,
				});
			} else {
				messages.push({
					role,
					content: contentString,
				});
			}
		}

		debug('formatted messages:', messages);
		return messages;
	};

	async doGenerate(options: LanguageModelV1CallOptions): Promise<{
		text?: string;
		toolCalls?: Array<LanguageModelV1FunctionToolCall>;
		finishReason: LanguageModelV1FinishReason;
		usage: { promptTokens: number; completionTokens: number };
		rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
		rawResponse?: { headers?: Record<string, string> };
		request?: { body?: string };
		response?: { id?: string; timestamp?: Date; modelId?: string };
		warnings?: LanguageModelV1CallWarning[];
		providerMetadata?: LanguageModelV1ProviderMetadata;
		logprobs?: LanguageModelV1LogProbs;
	}> {
		if (['regular', 'object-json'].indexOf(options.mode.type) < 0) {
			throw new UnsupportedFunctionalityError({
				functionality: `${options.mode.type} mode`,
			});
		}

		const isJson = options.mode.type === 'object-json';

		debug('Generate Options: ', options);
		console.log('Generate Options: ', options);

		const engine = await this.getEngine();
		const messages = this.formatMessages(options);

		console.log('Messages: ', messages);

		const responseFormat: ResponseFormat =
			options.mode.type === 'object-json'
				? { type: 'json_object', schema: JSON.stringify(options.mode.schema) }
				: { type: 'text' };

		console.log('Response format: ', responseFormat);

		let reply = await engine.chat.completions.create({
			messages,
			response_format: responseFormat,
			n: 1,
			max_tokens: 128,
		});

		console.log('Reply: ', reply);

		let text = reply.choices[0].message.content ?? '';

		// if (options.mode.type === 'object-json') {
		// 	text = text.replace(new RegExp('^' + objectStartSequence, 'ig'), '');
		// 	text = text.replace(new RegExp(objectStopSequence + '$', 'ig'), '');
		// }

		return {
			text,
			finishReason: 'stop',
			usage: {
				promptTokens: reply.usage?.prompt_tokens ?? 0,
				completionTokens: reply.usage?.completion_tokens ?? 0,
			},
			rawCall: { rawPrompt: options.prompt, rawSettings: {} },
		};
	}

	async doStream(options: LanguageModelV1CallOptions): Promise<{
		stream: ReadableStream<LanguageModelV1StreamPart>;
		rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
		rawResponse?: { headers?: Record<string, string> };
		request?: { body?: string };
		warnings?: LanguageModelV1CallWarning[];
	}> {
		throw new Error('not implemented');
	}
}
