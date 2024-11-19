import { chat, chatJSONStream, chatStream } from '~/lib/ai';
import { generateHTML } from '~/lib/helpers';

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';

const wrapCodeBlock = (data: string, language: string) => {
  return `\`\`\`${language}\n${data}\n\`\`\``;
};

const HomeComponent = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState<boolean>(false);

  const [isJson, setIsJson] = useState(false);

  const [code, setCode] = useState('');

  useEffect(() => {
    const getPrettyJSON = (data: string) => {
      try {
        return wrapCodeBlock(JSON.stringify(JSON.parse(data), null, 2), 'json');
      } catch {
        return wrapCodeBlock(response, 'json');
      }
    };
    const fn = async () => {
      const code = isJson ? getPrettyJSON(response) : response;
      const res = await generateHTML(code);
      setCode(String(res.value));
    };

    void fn();
  }, [isJson, response]);

  const onStream = async () => {
    setIsJson(false);
    if (prompt.trim().length === 0 || loading) return;
    setResponse('');
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

  const onStreamJSON = async () => {
    setIsJson(true);
    if (prompt.trim().length === 0 || loading) return;
    setResponse('');

    try {
      setResponse('');
      setLoading(true);
      const reader = chatJSONStream(prompt);
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
    setIsJson(false);
    if (prompt.trim().length === 0 || loading) return;
    setResponse('');
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
    <div className='mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12'>
      <h1 className='text-4xl font-semibold'>Welcome to the WebLLM AI Demo</h1>
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
      <div className='flex w-full flex-col md:flex-row items-center gap-3'>
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
        <Button
          className='w-full'
          disabled={prompt.trim().length === 0 || loading}
          onClick={onStreamJSON}
        >
          {loading ? 'Loading...' : 'Create Recipe'}
        </Button>
      </div>
      <p
        dangerouslySetInnerHTML={{ __html: code }}
        className='output-container mt-4 !max-w-3xl whitespace-pre-wrap rounded-xl bg-[#EFF1F5] p-4'
      />
    </div>
  );
};

export const Route = createFileRoute('/')({
  component: HomeComponent,
});
