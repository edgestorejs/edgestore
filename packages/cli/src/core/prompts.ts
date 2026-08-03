import { confirm, isCancel, password, select, text } from '@clack/prompts';
import { CliError, usageError } from './errors';

export type PromptOption<TValue extends string> = {
  value: TValue;
  label: string;
  hint?: string;
};

export interface CliPrompts {
  readToken(input: NodeJS.ReadableStream, inputIsTty: boolean): Promise<string>;
  confirmTyped(message: string, expected: string): Promise<void>;
  confirm(message: string, initialValue?: boolean): Promise<boolean>;
  select<TValue extends string>(
    message: string,
    options: PromptOption<TValue>[],
  ): Promise<TValue>;
  text(message: string, placeholder?: string): Promise<string>;
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

  async confirmTyped(message: string, expected: string): Promise<void> {
    const result = await text({
      message,
      placeholder: expected,
      validate: (value) =>
        value === expected ? undefined : `Type ${expected} to confirm.`,
    });
    if (isCancel(result)) {
      throw new CliError('interrupted', 'Operation canceled.', {
        exitCode: 130,
      });
    }
  }

  async confirm(message: string, initialValue = false): Promise<boolean> {
    return unwrapPrompt(
      await confirm({
        message,
        initialValue,
      }),
    );
  }

  async select<TValue extends string>(
    message: string,
    options: PromptOption<TValue>[],
  ): Promise<TValue> {
    return unwrapPrompt(
      await select<string>({
        message,
        options,
      }),
    ) as TValue;
  }

  async text(message: string, placeholder?: string): Promise<string> {
    const result = unwrapPrompt(
      await text({
        message,
        placeholder,
        validate: (value) => (value?.trim() ? undefined : 'Value is required.'),
      }),
    );
    return result.trim();
  }
}

function validateToken(value: string): string {
  const token = value.trim();
  if (!token) {
    throw usageError('missing_token', 'No management token was provided.');
  }
  return token;
}

function unwrapPrompt<TValue>(value: TValue | symbol): TValue {
  if (isCancel(value)) {
    throw new CliError('interrupted', 'Operation canceled.', { exitCode: 130 });
  }
  return value;
}
