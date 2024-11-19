import {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1CallWarning,
	LanguageModelV1ImagePart,
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
	ChatCompletionRequestNonStreaming,
} from '@mlc-ai/web-llm';

import createDebug from 'debug';
import {
	convertToWebLLMChatMessages,
	convertToWebLLMCompletionPrompt,
	mapWebLLMCompletionLogProbs,
	mapWebLLMFinishReason,
} from '../lib/helpers';

const debug = createDebug('webllm-ai');

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
	readonly defaultObjectGenerationMode = undefined;
	readonly modelId: WebLLMModelId = 'phi-1_5-q4f16_1-MLC-1k';
	readonly provider: string = 'webllm';

	private engine!: MLCEngine | WebWorkerMLCEngine;
	private readonly options: WebLLMChatLanguageModelOpts;
	private readonly settings: WebLLMChatLanguageModelOpts['generationOptions'];

	constructor(
		modelId?: WebLLMModelId,
		options: WebLLMChatLanguageModelOpts = {}
	) {
		this.modelId = modelId ?? 'phi-1_5-q4f16_1-MLC';
		this.options = options;
		this.settings = options.generationOptions;
	}

	private getEngine = async (): Promise<MLCEngine | WebWorkerMLCEngine> => {
		if (this.engine) return this.engine;
		debug('Loading engine...');
		let engine: MLCEngine | WebWorkerMLCEngine;
		if (this.options.worker) {
			engine = new WebWorkerMLCEngine(
				new Worker(new URL('../worker/worker.ts', import.meta.url), {
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
		maxTokens,
		temperature,
		topP,
		topK,
		frequencyPenalty,
		presencePenalty,
		stopSequences: userStopSequences,
		responseFormat,
		seed,
	}: Parameters<LanguageModelV1['doGenerate']>[0]): {
		args: ChatCompletionRequestNonStreaming;
		warnings: Array<LanguageModelV1CallWarning>;
		rawPrompt: string;
	} {
		const type = mode.type === 'regular' ? 'text' : 'json_object';
		const schema = mode.type === 'object-json' ? mode.schema : undefined;

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

		const args: ChatCompletionRequestNonStreaming = {
			...this.settings,
			model: this.modelId,
			messages,
			stream: false,
			stop,
			response_format: { type, schema },
		};

		return { args, warnings, rawPrompt };
	}

	async doGenerate(
		options: LanguageModelV1CallOptions
	): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
		const { args, warnings, rawPrompt } = this.getArgs(options);

		const engine = await this.getEngine();

		let reply = await engine.chat.completions.create(args);

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
