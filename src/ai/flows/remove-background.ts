'use server';

/**
 * @fileOverview An AI flow for removing the background from an image.
 *
 * - removeBackground - A function that takes an image data URI and returns a new data URI with the background removed.
 * - RemoveBackgroundInput - The input type for the removeBackground function.
 * - RemoveBackgroundOutput - The return type for the removeBackground function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RemoveBackgroundInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type RemoveBackgroundInput = z.infer<typeof RemoveBackgroundInputSchema>;

const RemoveBackgroundOutputSchema = z.object({
    processedPhotoDataUri: z
    .string()
    .describe(
      "The processed photo with the background removed, as a data URI."
    ),
});
export type RemoveBackgroundOutput = z.infer<
  typeof RemoveBackgroundOutputSchema
>;

export async function removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundOutput> {
  const { media } = await ai.generate({
    model: 'googleai/gemini-2.5-flash-image-preview',
    prompt: [
        {media: {url: input.photoDataUri}},
        {text: 'Remove the background from this image. The new background must be transparent.'},
    ],
    config: {
        responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  if (!media?.url) {
      throw new Error("The AI model did not return an image.");
  }

  return { processedPhotoDataUri: media.url };
}
