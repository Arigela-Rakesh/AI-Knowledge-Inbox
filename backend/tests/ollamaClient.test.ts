import axios, { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { config } from '../src/config';
import { postOllama } from '../src/services/ollamaClient';

const postSpy = jest.spyOn(axios, 'post');

afterEach(() => {
  postSpy.mockReset();
});

describe('Ollama HTTP client', () => {
  it('uses the local Ollama API and configured timeout', async () => {
    const response = {
      data: { models: [] },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse<{ models: unknown[] }>;
    postSpy.mockResolvedValue(response);

    await expect(postOllama('embed', { model: 'nomic-embed-text' })).resolves.toEqual(response.data);
    expect(postSpy).toHaveBeenCalledWith(
      `${config.ollama.baseUrl}/api/embed`,
      { model: 'nomic-embed-text' },
      expect.objectContaining({ timeout: config.ollama.timeoutMs })
    );
  });

  it('reports a missing local model with pull guidance', async () => {
    const response = {
      data: { error: "model 'nomic-embed-text' not found, try pulling it first" },
      status: 404,
      statusText: 'Not Found',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse;
    postSpy.mockRejectedValue(new AxiosError('Request failed', undefined, undefined, undefined, response));

    await expect(postOllama('embed', { model: 'nomic-embed-text' })).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('ollama pull'),
    });
  });

  it('reports a stopped local Ollama service clearly', async () => {
    postSpy.mockRejectedValue(new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED'));

    await expect(postOllama('chat', { model: 'llama3.2:3b' })).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining(config.ollama.baseUrl),
    });
  });
});
