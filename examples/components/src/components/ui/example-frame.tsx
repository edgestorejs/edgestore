import { cn } from '@/lib/utils';

export function ExampleFrame({
  children,
  details,
  centered,
}: {
  children?: React.ReactNode;
  details?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-2',
        centered ? 'lg:grid-cols-3' : 'md:grid-cols-3',
      )}
    >
      <div className="md:justify-self-end">
        <div className="max-w-xs">{details}</div>
      </div>
      <div className="border-b md:hidden" />
      <div
        className={cn(
          'col-span-1',
          centered ? 'md:col-span-1' : 'md:col-span-2',
        )}
      >
        {children}
      </div>
      {centered && <div className="hidden lg:col-span-1 lg:block"></div>}
    </div>
  );
}
