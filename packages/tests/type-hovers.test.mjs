import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const fixturePath = path.join(import.meta.dirname, 'fixtures/type-hovers.ts');
const fixture = fs.readFileSync(fixturePath, 'utf8');

const compilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  jsx: ts.JsxEmit.ReactJSX,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  skipLibCheck: true,
};

const host = {
  getCompilationSettings: () => compilerOptions,
  getCurrentDirectory: () => workspaceRoot,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  getDirectories: ts.sys.getDirectories,
  getScriptFileNames: () => [fixturePath],
  getScriptSnapshot(fileName) {
    if (!fs.existsSync(fileName)) return undefined;
    return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, 'utf8'));
  },
  getScriptVersion: () => '0',
  readDirectory: ts.sys.readDirectory,
  readFile: ts.sys.readFile,
  fileExists: ts.sys.fileExists,
  directoryExists: ts.sys.directoryExists,
  realpath: ts.sys.realpath,
};

const languageService = ts.createLanguageService(
  host,
  ts.createDocumentRegistry(),
);

function getHover(identifier) {
  const match = new RegExp(`\\b${identifier}\\b`).exec(fixture);
  assert.ok(match, `Missing ${identifier} in hover fixture`);

  const info = languageService.getQuickInfoAtPosition(
    fixturePath,
    match.index + 1,
  );
  assert.ok(info, `Missing quick info for ${identifier}`);
  return ts.displayPartsToString(info.displayParts);
}

const expectedHovers = {
  pathArgs: `(parameter) pathArgs: {
    ctx: {
        userId: () => string;
        role: () => string;
    };
    input: {
        category: () => string;
    };
}`,
  metadataArgs: `(parameter) metadataArgs: {
    ctx: Context;
    input: {
        category: "invoice" | "contract";
    };
}`,
  beforeUploadArgs: `(parameter) beforeUploadArgs: {
    ctx: Context;
    input: {
        category: "invoice" | "contract";
    };
    fileInfo: {
        size: number;
        type: string;
        extension: string;
        fileName?: string;
        replaceTargetUrl?: string;
        temporary: boolean;
    };
}`,
  beforeDeleteArgs: `(parameter) beforeDeleteArgs: {
    ctx: Context;
    fileInfo: {
        url: string;
        size: number;
        uploadedAt: Date;
        path: {
            category: string;
            owner: string;
        };
        metadata: {
            role: "admin" | "visitor";
            category: "invoice" | "contract";
        };
    };
}`,
  providerState: 'const providerState: EdgeStoreProviderState',
  backendSignedUploadMethod: `const backendSignedUploadMethod: (params: {
    content: UploadContent;
    options?: UploadOptions | undefined;
    signal?: AbortSignal | undefined;
    onProgress?: ((progress: {
        transferredBytes: number;
        totalBytes: number;
        percentage: number;
    }) => void) | undefined;
    ctx: Context;
    input: {
        category: "invoice" | "contract";
    };
}) => Promise<{
    url: string;
    size: number;
    metadata: {
        role: "admin" | "visitor";
        category: "invoice" | "contract";
    };
    path: {
        category: string;
        owner: string;
    };
    pathOrder: ("category" | "owner")[];
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    signedThumbnailUrl?: string | null | undefined;
}>`,
  reactSignedUploadMethod: `const reactSignedUploadMethod: (params: {
    file: File;
    signal?: AbortSignal;
    input: {
        category: "invoice" | "contract";
    };
    onProgressChange?: (progress: number) => void;
    options?: UploadOptions;
}) => Promise<{
    url: string;
    size: number;
    uploadedAt: Date;
    metadata: {
        role: "admin" | "visitor";
        category: "invoice" | "contract";
    };
    path: {
        category: string;
        owner: string;
    };
    pathOrder: ("category" | "owner")[];
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    signedThumbnailUrl?: string | null | undefined;
}>`,
  honoHandler: 'const honoHandler: (c: Context) => Promise<Response>',
  fastifyHandler:
    'const fastifyHandler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>',
  backendUnsignedUpload: `const backendUnsignedUpload: {
    url: string;
    size: number;
    metadata: Record<string, never>;
    path: Record<string, never>;
    pathOrder: [];
}`,
  backendSignedFileUpload: `const backendSignedFileUpload: {
    url: string;
    size: number;
    metadata: {
        role: "admin" | "visitor";
        category: "invoice" | "contract";
    };
    path: {
        category: string;
        owner: string;
    };
    pathOrder: ("category" | "owner")[];
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    signedThumbnailUrl?: string | null | undefined;
}`,
  backendGetFile: `const backendGetFile: {
    url: string;
    size: number;
    uploadedAt: Date;
    metadata: {
        role: "admin" | "visitor";
        category: "invoice" | "contract";
    };
    path: {
        category: string;
        owner: string;
    };
}`,
  backendListFiles: `const backendListFiles: {
    data: {
        url: string;
        size: number;
        uploadedAt: Date;
        metadata: {
            role: "admin" | "visitor";
            category: "invoice" | "contract";
        };
        path: {
            category: string;
            owner: string;
        };
    }[];
    pagination: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
    };
}`,
  backendGetSignedUrl: `const backendGetSignedUrl: {
    url: string;
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
}`,
  backendGetSignedUrls: `const backendGetSignedUrls: {
    url: string;
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    thumbnailUrl?: string | null | undefined;
    signedThumbnailUrl?: string | null | undefined;
}[]`,
  reactUnsignedUpload: `const reactUnsignedUpload: {
    url: string;
    size: number;
    uploadedAt: Date;
    metadata: Record<string, never>;
    path: Record<string, never>;
    pathOrder: [];
}`,
  reactSignedFileUpload: `const reactSignedFileUpload: {
    url: string;
    size: number;
    uploadedAt: Date;
    metadata: {
        role: "admin" | "visitor";
        category: "invoice" | "contract";
    };
    path: {
        category: string;
        owner: string;
    };
    pathOrder: ("category" | "owner")[];
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    signedThumbnailUrl?: string | null | undefined;
}`,
  reactSignedImageUpload: `const reactSignedImageUpload: {
    url: string;
    thumbnailUrl: string | null;
    size: number;
    uploadedAt: Date;
    metadata: Record<string, never>;
    path: Record<string, never>;
    pathOrder: [];
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
    signedThumbnailUrl?: string | null | undefined;
}`,
};

for (const [identifier, expected] of Object.entries(expectedHovers)) {
  test(`${identifier} has a readable public hover type`, () => {
    assert.equal(getHover(identifier), expected);
  });
}

test('hover fixture has no TypeScript diagnostics', () => {
  const diagnostics = [
    ...languageService.getSyntacticDiagnostics(fixturePath),
    ...languageService.getSemanticDiagnostics(fixturePath),
  ];
  assert.deepEqual(
    diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    ),
    [],
  );
});
