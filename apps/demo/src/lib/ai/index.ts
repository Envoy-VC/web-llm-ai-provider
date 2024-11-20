import { generateText, streamObject, streamText } from 'ai';
import { createWebLLM } from 'webllm-ai';
import { z } from 'zod';

const webllmai = createWebLLM('Llama-3.1-8B-Instruct-q4f16_1-MLC', {
  initProgressCallback: (p) => console.log(p),
  worker: true,
});

const webllmLanguageModel = webllmai.languageModel();

export const chat = async (prompt: string) => {
  const { text } = await generateText({
    model: webllmLanguageModel,
    prompt,
  });

  return text;
};

export const chatStream = (prompt: string) => {
  const res = streamText({
    model: webllmLanguageModel,
    prompt,
  });

  return res.textStream.getReader();
};

export const chatJSONStream = (prompt: string) => {
  const res = streamObject({
    mode: 'json',
    model: webllmLanguageModel,
    prompt,
    schema: z.object({
      name: z.string().min(1, 'Recipe name is required'),
      description: z.string().optional(),
      servings: z.number().positive('Servings must be greater than 0'),
      preparationTime: z
        .number()
        .int()
        .min(0, 'Preparation time must be a non-negative integer')
        .optional(),
      cookingTime: z
        .number()
        .int()
        .min(0, 'Cooking time must be a non-negative integer')
        .optional(),
      ingredients: z
        .array(
          z.object({
            name: z.string().min(1, 'Ingredient name is required'),
            quantity: z.string().min(1, 'Quantity is required'), // Use string for flexibility (e.g., "1 cup")
          })
        )
        .min(1, 'At least one ingredient is required'),
      instructions: z
        .array(z.string().min(1, 'Instruction step cannot be empty'))
        .min(1, 'At least one instruction step is required'),
      tags: z.array(z.string()).optional(),
      isVegetarian: z.boolean().optional(),
      isVegan: z.boolean().optional(),
      nutrition: z
        .object({
          calories: z
            .number()
            .positive('Calories must be a positive number')
            .optional(),
          protein: z
            .number()
            .nonnegative('Protein must be non-negative')
            .optional(),
          fat: z.number().nonnegative('Fat must be non-negative').optional(),
          carbohydrates: z
            .number()
            .nonnegative('Carbohydrates must be non-negative')
            .optional(),
        })
        .optional(),
    }),
  });

  return res.textStream.getReader();
};
