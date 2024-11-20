import { WebLLMChatLanguageModelOpts } from './types';
import { WebLLMChatLanguageModel } from './language-model';

import createDebug from 'debug';
import { ProviderV1 } from '@ai-sdk/provider';

const debug = createDebug('webllm-ai');

export interface WebLLMProvider extends ProviderV1 {
	languageModel(): WebLLMChatLanguageModel;
}

export const createWebLLM = (
	modelId?: string,
	options?: WebLLMChatLanguageModelOpts
): WebLLMProvider => {
	const createLanguageModel = () => {
		return new WebLLMChatLanguageModel(modelId, options);
	};

	const textEmbeddingModel = () => {
		throw new Error('Not implemented');
	};

	const provider = function () {
		return createLanguageModel();
	};

	provider.languageModel = createLanguageModel;
	provider.textEmbeddingModel = textEmbeddingModel;

	return provider as WebLLMProvider;
};

export const webllmai = createWebLLM();
