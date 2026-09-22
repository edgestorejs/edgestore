import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const consumer of [
  'docs',
  'examples/components',
  'examples/next-complete',
]) {
  test(`${consumer}: dropzone types do not depend on root hoisting`, () => {
    const file = path.join(root, consumer, '__dropzone_types_test.ts');
    const source = `
      import type { DropzoneOptions } from 'react-dropzone';
      const options: DropzoneOptions = { multiple: false, maxSize: 1024 };
      const imageOptions: Omit<DropzoneOptions, 'disabled' | 'onDrop' | 'multiple' | 'maxFiles'> = { maxSize: 1024 };
    `;
    const options: ts.CompilerOptions = {
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: [],
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    };
    const host = ts.createCompilerHost(options);
    const fileExists = host.fileExists.bind(host);
    const getSourceFile = host.getSourceFile.bind(host);
    const hoistedTypes = path.join(root, 'node_modules', '@types', 'react');

    // Simulate a build where dropzone cannot fall back to the root's public
    // hoist. Its declared peer must supply React's types instead.
    host.fileExists = (name) => {
      const normalized = path.normalize(name);
      return (
        normalized === file ||
        (!(
          normalized === hoistedTypes ||
          normalized.startsWith(hoistedTypes + path.sep)
        ) &&
          fileExists(name))
      );
    };
    host.getSourceFile = (...args) => {
      const [name, languageVersion] = args;
      return path.normalize(name) === file
        ? ts.createSourceFile(name, source, languageVersion, true)
        : getSourceFile(...args);
    };

    const program = ts.createProgram([file], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnostics(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      }),
    );
  });
}
