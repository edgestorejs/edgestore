export function ExampleFrame({
  children,
  details,
}: {
  children?: React.ReactNode;
  details?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-2">
      <div className="flex flex-1 justify-center md:justify-end">
        <div className="max-w-xs">{details}</div>
      </div>
      <div className="flex-1">{children}</div>
      <div className="lg:flex-1"></div>
    </div>
  );
}
