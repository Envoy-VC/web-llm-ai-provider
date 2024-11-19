import { allModelIds, functionCallingModelIds } from '../data/models';

export type WebLLMModelId = (typeof allModelIds)[number];

export type WebLLMFunctionCallingModelId =
	(typeof functionCallingModelIds)[number];
