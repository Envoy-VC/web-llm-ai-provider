import { z } from 'zod';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const webllmErrorDataSchema = z.object({
	error: z.object({
		message: z.string(),

		type: z.string().nullish(),
		param: z.any().nullish(),
		code: z.union([z.string(), z.number()]).nullish(),
	}),
});

export type WebLLMErrorData = z.infer<typeof webllmErrorDataSchema>;

export const webllmFailedResponseHandler = createJsonErrorResponseHandler({
	errorSchema: webllmErrorDataSchema,
	errorToMessage: (data) => data.error.message,
});
