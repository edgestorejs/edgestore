import { isCancel, password } from '@clack/prompts';
import { CliError, usageError } from './errors';

export interface CliPrompts {
  readToken(input: NodeJS.ReadableStream, inputIsTty: boolean): Promise<string>;
}

export class DefaultCliPrompts implements CliPrompts {
  async readToken(
    input: NodeJS.ReadableStream,
    inputIsTty: boolean,
  ): Promise<string> {
    if (!inputIsTty) {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
        );
      }
      return validateToken(Buffer.concat(chunks).toString('utf8'));
    }

    const result = await password({
      message: 'Management token',
      validate: (value) => (value?.trim() ? undefined : 'Token is required.'),
    });
    if (isCancel(result)) {
      throw new CliError('interrupted', 'Login canceled.', { exitCode: 130 });
    }
    return validateToken(result);
  }
}

function validateToken(value: string): string {
  const token = value.trim();
  if (!token) {
    throw usageError('missing_token', 'No management token was provided.');
  }
  return token;
}
