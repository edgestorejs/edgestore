export function JsonResult({ value }: { value: unknown }) {
  if (value === undefined) return null;

  return (
    <pre className="result" tabIndex={0}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
