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
    <div className="flex flex-col gap-4 md:flex-row md:gap-2">
      <div className="flex flex-1 justify-center md:justify-end">
        <div className="max-w-xs">{details}</div>
      </div>
      <div className="my-2 border-b md:hidden" />
      <div className={centered ? 'flex-1' : 'flex-[2]'}>{children}</div>
      {centered && <div className="lg:flex-1"></div>}
    </div>
  );
}
