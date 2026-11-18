import axios from 'axios';
import { config } from '../config';

export class OllamaError extends Error {
  public readonly expose = true;

  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'OllamaError';
  }
}

export async function postOllama<T>(endpoint: 'embed' | 'chat', body: unknown): Promise<T> {
  try {
    const response = await axios.post<T>(
      `${config.ollama.baseUrl}/api/${endpoint}`,
      body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: config.ollama.timeoutMs,
      }
    );
    return response.data;
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) {
      throw new OllamaError('Unexpected error while calling Ollama.', 502);
    }

    const status = err.response?.status;
    const code = err.code;
    const data = err.response?.data as { error?: unknown } | undefined;
    const detail = typeof data?.error === 'string' ? data.error.slice(0, 300) : '';

    if (status === 404 || /model .* not found|try pulling it first/i.test(detail)) {
      throw new OllamaError(`${detail || 'Ollama model or endpoint was not found.'} Pull the configured model with \`ollama pull\`.`, 503);
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
      throw new OllamaError(`Cannot connect to Ollama at ${config.ollama.baseUrl}. Start Ollama and try again.`, 503);
    }
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      throw new OllamaError('Ollama request timed out. Check that the local model is running and try again.', 504);
    }

    const message = detail
      ? `Ollama request failed (HTTP ${status ?? 'unknown'}): ${detail}`
      : `Ollama request failed${status ? ` with HTTP ${status}` : ''}.`;
    throw new OllamaError(message, status && status < 500 ? 502 : 503);
  }
}
