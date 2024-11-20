import { LanguageModelV1Prompt } from '@ai-sdk/provider';
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import {
	ChatCompletionContentPartImage,
	ChatCompletionMessageParam,
} from '@mlc-ai/web-llm';

export function convertToWebLLMChatMessages({
	prompt,
}: {
	prompt: LanguageModelV1Prompt;
}): Array<ChatCompletionMessageParam> {
	const messages: ChatCompletionMessageParam[] = [];

	for (const { role, content } of prompt) {
		switch (role) {
			case 'system': {
				messages.push({ role: 'system', content });
				break;
			}

			case 'user': {
				if (content.length === 1 && content[0].type === 'text') {
					messages.push({ role: 'user', content: content[0].text });
					break;
				}

				messages.push({
					role: 'user',
					content: content.map((part) => {
						if (part.type === 'text') {
							return { type: 'text', text: part.text };
						} else if (part.type === 'image') {
							const imgDetail = part.providerMetadata?.webllm?.imageDetail;
							return {
								type: 'image_url',
								image_url: {
									url:
										part.image instanceof URL
											? part.image.toString()
											: `data:${
													part.mimeType ?? 'image/jpeg'
												};base64,${convertUint8ArrayToBase64(part.image)}`,

									// WebLLM specific extension: image detail
									detail:
										typeof imgDetail === 'string'
											? (imgDetail as ChatCompletionContentPartImage['image_url']['detail'])
											: undefined,
								},
							};
						} else {
							return { type: 'text', text: 'Unsupported part' };
						}
					}),
				});

				break;
			}

			case 'assistant': {
				let text = '';
				const toolCalls: Array<{
					id: string;
					type: 'function';
					function: { name: string; arguments: string };
				}> = [];

				for (const part of content) {
					switch (part.type) {
						case 'text': {
							text += part.text;
							break;
						}
						case 'tool-call': {
							toolCalls.push({
								id: part.toolCallId,
								type: 'function',
								function: {
									name: part.toolName,
									arguments: JSON.stringify(part.args),
								},
							});
							break;
						}
						default: {
							const _exhaustiveCheck: never = part;
							throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
						}
					}
				}

				messages.push({
					role: 'assistant',
					content: text,
					tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
				});

				break;
			}

			case 'tool': {
				for (const toolResponse of content) {
					messages.push({
						role: 'tool',
						tool_call_id: toolResponse.toolCallId,
						content: JSON.stringify(toolResponse.result),
					});
				}
				break;
			}

			default: {
				const _exhaustiveCheck: never = role;
				throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
			}
		}
	}

	return messages;
}
