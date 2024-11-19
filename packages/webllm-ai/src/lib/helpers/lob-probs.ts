import { LanguageModelV1LogProbs } from '@ai-sdk/provider';
import { CompletionChoice } from '@mlc-ai/web-llm';

export function mapWebLLMCompletionLogProbs(
	logprobs: CompletionChoice['logprobs']
): LanguageModelV1LogProbs | undefined {
	const res: LanguageModelV1LogProbs = [];
	const len = logprobs?.content?.length ?? 0;

	for (let i = 0; i < len; i++) {
		const token = logprobs?.content?.at(i);
		if (token) {
			res.push({
				token: token.token,
				logprob: token.logprob,
				topLogprobs: token.top_logprobs,
			});
		}
	}

	if (res.length === 0) return undefined;
	return res;
}
