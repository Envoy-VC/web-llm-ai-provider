import { WebLLMModelId } from './types';
import { WebLLMChatLanguageModel } from './language-model';

import createDebug from 'debug';

const debug = createDebug('webllm-ai');

export function webllmai(modelId?: WebLLMModelId): WebLLMChatLanguageModel;
export function webllmai(modelId: unknown = 'phi-1_5-q4f16_1-MLC-1k') {
	return new WebLLMChatLanguageModel(modelId as WebLLMModelId);
}
