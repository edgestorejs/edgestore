export function LimitedCode({ children }: { children: React.ReactNode }) {
  return <div className="[&_div:has(>pre)]:max-h-[200px]!">{children}</div>;
}
