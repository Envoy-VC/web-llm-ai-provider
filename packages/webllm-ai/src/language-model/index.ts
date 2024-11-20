import {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1CallWarning,
	LanguageModelV1FinishReason,
	LanguageModelV1ImagePart,
	LanguageModelV1LogProbs,
	LanguageModelV1StreamPart,
	LanguageModelV1TextPart,
	LanguageModelV1ToolCallPart,
	LanguageModelV1ToolResultPart,
	UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import { WebLLMModelId, WebLLMChatLanguageModelOpts } from '../types';
import {
	MLCEngine,
	WebWorkerMLCEngine,
	ChatCompletionRequestBase,
	ChatCompletionChunk,
} from '@mlc-ai/web-llm';

import createDebug from 'debug';
import {
	convertToWebLLMChatMessages,
	convertToWebLLMCompletionPrompt,
	getResponseMetadata,
	mapWebLLMCompletionLogProbs,
	mapWebLLMFinishReason,
} from '../lib/helpers';

const debug = createDebug('webllm-ai');

export class WebLLMChatLanguageModel implements LanguageModelV1 {
	readonly specificationVersion = 'v1';
	readonly defaultObjectGenerationMode = undefined;
	readonly modelId: string = WebLLMModelId['phi-1_5-q4f16_1-MLC'];
	readonly provider: string = 'webllm';

	private engine!: MLCEngine | WebWorkerMLCEngine;
	private readonly options: WebLLMChatLanguageModelOpts;
	private readonly settings: WebLLMChatLanguageModelOpts['generationOptions'];

	constructor(modelId?: string, options: WebLLMChatLanguageModelOpts = {}) {
		this.modelId = modelId ?? WebLLMModelId['phi-1_5-q4f16_1-MLC'];
		this.options = options;
		this.settings = options.generationOptions;
	}

	private getEngine = async (): Promise<MLCEngine | WebWorkerMLCEngine> => {
		if (this.engine) return this.engine;
		debug('Loading engine...');
		let engine: MLCEngine | WebWorkerMLCEngine;
		if (this.options.worker) {
			engine = new WebWorkerMLCEngine(
				new Worker(new URL('../src/worker/worker.ts', import.meta.url), {
					type: 'module',
				}),
				this.options
			);
		} else {
			engine = new MLCEngine(this.options);
		}
		await engine.reload(this.modelId);
		debug('Engine loaded');
		this.engine = engine;
		return engine;
	};

	private getArgs({
		mode,
		inputFormat,
		prompt,
		topK,
		stopSequences: userStopSequences,
	}: Parameters<LanguageModelV1['doGenerate']>[0]): {
		args: ChatCompletionRequestBase;
		warnings: Array<LanguageModelV1CallWarning>;
		rawPrompt: string;
	} {
		console.log(mode);
		const type = mode.type === 'regular' ? 'text' : 'json_object';
		const schema =
			mode.type === 'object-json' ? JSON.stringify(mode.schema) : undefined;

		const warnings: LanguageModelV1CallWarning[] = [];

		if (topK != null) {
			warnings.push({
				type: 'unsupported-setting',
				setting: 'topK',
			});
		}

		const { stopSequences, prompt: rawPrompt } = convertToWebLLMCompletionPrompt({
			prompt,
			inputFormat,
		});

		const stop = [...(stopSequences ?? []), ...(userStopSequences ?? [])];
		const messages = convertToWebLLMChatMessages({ prompt });

		const args: ChatCompletionRequestBase = {
			...this.settings,
			model: this.modelId,
			messages,
			stop,
			response_format: { type, schema },
		};

		return { args, warnings, rawPrompt };
	}

	private createReadableStreamFromChunks(
		chunks: AsyncIterable<ChatCompletionChunk>
	): ReadableStream<LanguageModelV1StreamPart> {
		let isFirstChunk = true;
		let finishReason: LanguageModelV1FinishReason = 'unknown';
		let logprobs: LanguageModelV1LogProbs;

		let usage: { promptTokens: number; completionTokens: number } = {
			promptTokens: Number.NaN,
			completionTokens: Number.NaN,
		};

		return new ReadableStream<LanguageModelV1StreamPart>({
			async start(controller) {
				try {
					for await (const chunk of chunks) {
						if (isFirstChunk) {
							isFirstChunk = false;
							controller.enqueue({
								type: 'response-metadata',
								...getResponseMetadata({
									id: chunk.id,
									model: chunk.model,
									created: chunk.created,
								}),
							});
						}
						for (const choice of chunk.choices) {
							const delta = choice.delta;

							// Handle text content
							if (delta.content) {
								controller.enqueue({
									type: 'text-delta',
									textDelta: delta.content,
								});
							}

							// Handle tool calls if present
							if (delta.tool_calls) {
								for (const toolCall of delta.tool_calls) {
									controller.enqueue({
										type: 'tool-call-delta',
										toolCallType: 'function',
										toolCallId: toolCall.id || '',
										toolName: toolCall?.function?.name || '',
										argsTextDelta: toolCall.function?.arguments || '',
									});
								}
							}
							if (choice.finish_reason) {
								finishReason = mapWebLLMFinishReason(choice.finish_reason);
							}
							// Handle usage information if present
							if (chunk.usage) {
								usage = {
									promptTokens: chunk.usage.prompt_tokens ?? 0,
									completionTokens: chunk.usage.completion_tokens ?? 0,
								};
							}

							const mappedLogprobs = mapWebLLMCompletionLogProbs(choice?.logprobs);
							if (mappedLogprobs?.length) {
								if (logprobs === undefined) logprobs = [];
								logprobs.push(...mappedLogprobs);
							}
						}

						// Handle metadata (optional)
						controller.enqueue({
							type: 'response-metadata',
							id: chunk.id,
							timestamp: new Date(chunk.created * 1000),
							modelId: chunk.model,
						});
					}

					controller.enqueue({
						type: 'finish',
						finishReason,
						logprobs,
						usage,
					});

					controller.close();
				} catch (err) {
					controller.error(err);
				}
			},
		});
	}

	async doGenerate(
		options: LanguageModelV1CallOptions
	): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
		const { args, warnings, rawPrompt } = this.getArgs(options);

		const engine = await this.getEngine();

		let reply = await engine.chat.completions.create({ ...args, stream: false });

		const choice = reply.choices[0];

		const { messages, ...rawSettings } = args;

		return {
			text: choice.message.content ?? '',
			usage: {
				promptTokens: reply.usage?.prompt_tokens ?? 0,
				completionTokens: reply.usage?.completion_tokens ?? 0,
			},
			finishReason: mapWebLLMFinishReason(choice.finish_reason),
			logprobs: mapWebLLMCompletionLogProbs(choice.logprobs),
			rawCall: { rawPrompt, rawSettings },
			warnings,
			request: { body: JSON.stringify(args) },
		};
	}

	async doStream(
		options: Parameters<LanguageModelV1['doStream']>[0]
	): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
		const { args, warnings, rawPrompt } = this.getArgs(options);

		console.log(args);

		const engine = await this.getEngine();

		let chunks = await engine.chat.completions.create({
			...args,
			stream: true,
			stream_options: { include_usage: true },
		});

		const { messages, ...rawSettings } = args;

		let isFirstChunk = true;
		let finishReason: LanguageModelV1FinishReason = 'unknown';
		let logprobs: LanguageModelV1LogProbs;

		let usage: { promptTokens: number; completionTokens: number } = {
			promptTokens: Number.NaN,
			completionTokens: Number.NaN,
		};

		const stream = new ReadableStream<LanguageModelV1StreamPart>({
			async start(controller) {
				try {
					for await (const chunk of chunks) {
						if (isFirstChunk) {
							isFirstChunk = false;
							controller.enqueue({
								type: 'response-metadata',
								...getResponseMetadata({
									id: chunk.id,
									model: chunk.model,
									created: chunk.created,
								}),
							});
						}
						for (const choice of chunk.choices) {
							const delta = choice.delta;

							// Handle text content
							if (delta.content) {
								controller.enqueue({
									type: 'text-delta',
									textDelta: delta.content,
								});
							}

							// Handle tool calls if present
							if (delta.tool_calls) {
								for (const toolCall of delta.tool_calls) {
									controller.enqueue({
										type: 'tool-call-delta',
										toolCallType: 'function',
										toolCallId: toolCall.id || '',
										toolName: toolCall?.function?.name || '',
										argsTextDelta: toolCall.function?.arguments || '',
									});
								}
							}
							if (choice.finish_reason) {
								finishReason = mapWebLLMFinishReason(choice.finish_reason);
							}
							// Handle usage information if present
							if (chunk.usage) {
								usage = {
									promptTokens: chunk.usage.prompt_tokens ?? 0,
									completionTokens: chunk.usage.completion_tokens ?? 0,
								};
							}

							const mappedLogprobs = mapWebLLMCompletionLogProbs(choice?.logprobs);
							if (mappedLogprobs?.length) {
								if (logprobs === undefined) logprobs = [];
								logprobs.push(...mappedLogprobs);
							}
						}

						// Handle metadata (optional)
						controller.enqueue({
							type: 'response-metadata',
							id: chunk.id,
							timestamp: new Date(chunk.created * 1000),
							modelId: chunk.model,
						});
					}

					controller.enqueue({
						type: 'finish',
						finishReason,
						logprobs,
						usage,
					});

					controller.close();
				} catch (err) {
					controller.error(err);
				}
			},
		});

		return {
			stream,
			rawCall: { rawPrompt, rawSettings },
			warnings,
		};
	}
}
