import { MLCEngineConfig } from '@mlc-ai/web-llm';
import { allModelIds, functionCallingModelIds } from '../data/models';

export type WebLLMModelId = (typeof allModelIds)[number];

export type WebLLMFunctionCallingModelId =
	(typeof functionCallingModelIds)[number];

export type WebLLMChatLanguageModelOpts = MLCEngineConfig;
