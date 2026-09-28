'use client';

import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code';
import { ExampleFrame } from '@/components/ui/example-frame';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileField } from '@/components/upload/file-field';
import { FileUploader } from '@/components/upload/multi-file';
import { DOCUMENT_ACCEPT } from '@/components/upload/upload-utils';
import {
  UploaderProvider,
  type CompletedFileState,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import {
  useController,
  useForm,
  type FieldValues,
  type UseControllerProps,
} from 'react-hook-form';
import { z } from 'zod';

export default function Page() {
  return (
    <ExampleFrame details={<MultiFileInstantDetails />} centered>
      <ReactHookFormExample />
    </ExampleFrame>
  );
}

const uploadedFileSchema = z.object({
  filename: z.string().min(1),
  url: z.string().min(1),
});

const formSchema = z.object({
  text: z.string(),
  resume: uploadedFileSchema,
  files: z
    .array(
      z.object({
        filename: z.string().min(1),
        url: z.string().min(1),
      }),
    )
    .min(1),
});

type FormValues = z.infer<typeof formSchema>;

function ReactHookFormExample() {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const [submitValues, setSubmitValues] = React.useState<FormValues>();

  function onSubmit(values: FormValues) {
    setSubmitValues(values);
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit, console.log)}
        className="flex flex-col gap-4"
      >
        <div className="flex w-full flex-col gap-1.5">
          <Label htmlFor="text-field">Text Field</Label>
          <Input
            {...register('text')}
            id="text-field"
            placeholder="Some text field"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <Label id="resume-label" htmlFor="resume-input">
            Resume
          </Label>
          <ResumeInput control={control} name="resume" />
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <Label>Attachments</Label>
          <UploadInput control={control} name="files" />
        </div>
        <Button>Submit</Button>
      </form>
      {submitValues && (
        <div className="mt-4 w-full">
          <h3 className="text-base font-bold">Submitted Values</h3>
          <CodeBlock>{JSON.stringify(submitValues, null, 2)}</CodeBlock>
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div className="mt-4">
          <h3 className="text-base font-bold">Errors</h3>
          <CodeBlock>{JSON.stringify(errors, null, 2)}</CodeBlock>
        </div>
      )}
    </>
  );
}

function UploadInput<T extends FieldValues>(props: UseControllerProps<T>) {
  const {
    field: { onChange },
  } = useController(props);
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      const res = await edgestore.myPublicFiles.upload({
        file,
        signal,
        onProgressChange,
      });
      return {
        url: res.url,
      };
    },
    [edgestore],
  );

  const handleUploaderChange = React.useCallback(
    ({ completedFiles }: { completedFiles: CompletedFileState[] }) => {
      const formValue = completedFiles.map((fs) => ({
        filename: fs.file.name,
        url: fs.url,
      }));
      onChange(formValue);
    },
    [onChange],
  );

  return (
    <UploaderProvider
      uploadFn={uploadFn}
      onChange={handleUploaderChange}
      autoUpload
    >
      <FileUploader maxFiles={10} maxSize={1024 * 1024 * 1} />
    </UploaderProvider>
  );
}

function ResumeInput<T extends FieldValues>(props: UseControllerProps<T>) {
  const {
    field: { onChange },
  } = useController(props);
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      return edgestore.myPublicFiles.upload({
        file,
        signal,
        onProgressChange,
      });
    },
    [edgestore],
  );

  const handleUploaderChange = React.useCallback(
    ({ completedFiles }: { completedFiles: CompletedFileState[] }) => {
      const [completed] = completedFiles;
      onChange(
        completed
          ? { filename: completed.file.name, url: completed.url }
          : null,
      );
    },
    [onChange],
  );

  return (
    <UploaderProvider
      uploadFn={uploadFn}
      onChange={handleUploaderChange}
      autoUpload
    >
      <FileField
        inputId="resume-input"
        aria-labelledby="resume-label"
        accept={DOCUMENT_ACCEPT}
        typesLabel="PDF, DOC or DOCX"
        maxSize={1024 * 1024 * 1} // 1 MB
      />
    </UploaderProvider>
  );
}

function MultiFileInstantDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-sm text-foreground/80">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/forms/page.tsx"
            target="_blank"
            className="underline"
            rel="noreferrer"
          >
            Usage
          </a>
        </li>
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/components/upload/multi-file.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Component
          </a>
        </li>
      </ul>
      <h3 className="mt-4 text-base font-bold">About</h3>
      <div className="flex flex-col gap-2 text-sm text-foreground/80">
        <p>
          This example demonstrates how to use EdgeStore with{' '}
          <a
            href="https://react-hook-form.com/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            React Hook Form
          </a>
          .
        </p>
        <p>
          The resume field uses the compact single-file field. The attachments
          field uses the same component as the multi-file-instant example. Both
          are wrapped so they can be used with React Hook Form.
        </p>
      </div>
    </div>
  );
}
