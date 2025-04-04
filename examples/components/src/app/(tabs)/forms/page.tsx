'use client';

import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code';
import { ExampleFrame } from '@/components/ui/example-frame';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/upload/multi-file';
import {
  UploaderProvider,
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

const formSchema = z.object({
  text: z.string(),
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
          <Label htmlFor="text-field">Upload Input</Label>
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

  return (
    <UploaderProvider
      uploadFn={uploadFn}
      onChange={({ completedFiles }) => {
        const formValue = completedFiles.map((fs) => ({
          filename: fs.file.name,
          url: fs.url,
        }));
        onChange(formValue);
      }}
      autoUpload
    >
      <FileUploader maxFiles={10} maxSize={1024 * 1024 * 1} />
    </UploaderProvider>
  );
}

function MultiFileInstantDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-foreground/80 text-sm">
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
      <div className="text-foreground/80 flex flex-col gap-2 text-sm">
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
          It uses the same component as the multi-file-instant example, but it
          is wrapped in a way that it can be easily used with React Hook Form.
        </p>
      </div>
    </div>
  );
}
