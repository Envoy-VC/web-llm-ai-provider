import { generateText, streamText } from 'ai';
import { createWebLLM } from 'webllm-ai';

const webllmai = createWebLLM('TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k', {
  initProgressCallback: (p) => console.log(p),
});

export const chat = async (prompt: string) => {
  const { text } = await generateText({
    model: webllmai.languageModel(),
    prompt,
  });

  return text;
};

export const chatStream = (prompt: string) => {
  const res = streamText({
    model: webllmai.languageModel(),
    prompt,
  });

  return res.textStream.getReader();
};
