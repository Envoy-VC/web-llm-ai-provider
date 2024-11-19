import { chat, chatStream } from '~/lib/ai';

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';

const HomeComponent = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState<boolean>(false);

  const onStream = async () => {
    if (prompt.trim().length === 0 || loading) return;
    try {
      setResponse('');
      setLoading(true);
      const reader = chatStream(prompt);
      let isStreaming = true;
      while (isStreaming) {
        const { done, value } = await reader.read();
        if (done) {
          isStreaming = false;
          continue;
        }
        setResponse((prev) => prev + value);
      }
      setLoading(false);
    } catch (error) {
      setResponse('Error generating response');
      setLoading(false);
      console.error('Error generating response:', error);
    }
  };

  const onGenerate = async () => {
    if (prompt.trim().length === 0 || loading) return;
    try {
      setResponse('');
      setLoading(true);
      const res = await chat(prompt);
      setResponse(res);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setResponse('Error generating response');
      console.error('Error generating response:', error);
    }
  };

  return (
    <div className='mx-auto flex max-w-xl flex-col gap-4 px-4 py-12'>
      <h1 className='text-2xl'>Welcome to the WebLLM AI Demo</h1>
      <p>Enter a prompt to generate a response:</p>
      <Textarea
        className='rounded-md !text-base outline-none'
        minLength={1}
        placeholder='Enter a prompt...'
        rows={6}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void onStream();
          }
        }}
      />
      <div className='flex w-full flex-row items-center gap-3'>
        <Button
          className='w-full'
          disabled={prompt.trim().length === 0 || loading}
          onClick={onStream}
        >
          {loading ? 'Loading...' : 'Stream Response'}
        </Button>
        <Button
          className='w-full'
          disabled={prompt.trim().length === 0 || loading}
          onClick={onGenerate}
        >
          {loading ? 'Loading...' : 'Generate Response'}
        </Button>
      </div>
      <div className='mt-4'>
        <p>{response}</p>
      </div>
    </div>
  );
};

export const Route = createFileRoute('/')({
  component: HomeComponent,
});
