export type DotenvAssignment = {
  name: string;
  prefix: string;
  separator: string;
  value: string;
  carriageReturn: string;
};

export function parseDotenvAssignment(
  line: string,
): DotenvAssignment | undefined {
  const carriageReturn = line.endsWith('\r') ? '\r' : '';
  const content = carriageReturn ? line.slice(0, -1) : line;
  const match =
    /^(\s*(?:export[ \t]+)?)([A-Za-z_][A-Za-z0-9_]*)([ \t]*=[ \t]*)(.*)$/.exec(
      content,
    );
  if (match?.[1] === undefined || !match[2] || !match[3]) return undefined;
  return {
    prefix: match[1],
    name: match[2],
    separator: match[3],
    value: parseDotenvValue(match[4] ?? ''),
    carriageReturn,
  };
}

export function dotenvValue(
  contents: string,
  name: string,
): string | undefined {
  let value: string | undefined;
  for (const line of contents.split('\n')) {
    const assignment = parseDotenvAssignment(line);
    if (assignment?.name === name) value = assignment.value || undefined;
  }
  return value;
}

function parseDotenvValue(rawValue: string): string {
  const value = rawValue.trim();
  const quote = value[0];
  if (quote === '"' || quote === "'" || quote === '`') {
    const closingQuote = findClosingQuote(value, quote);
    if (closingQuote !== -1) {
      const quoted = value.slice(1, closingQuote);
      return quote === '"'
        ? quoted.replaceAll('\\n', '\n').replaceAll('\\r', '\r')
        : quoted;
    }
  }
  return value.replace(/[ \t]+#.*$/, '').trim();
}

function findClosingQuote(value: string, quote: string): number {
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] !== quote) continue;
    let backslashes = 0;
    for (
      let cursor = index - 1;
      cursor >= 0 && value[cursor] === '\\';
      cursor--
    ) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) return index;
  }
  return -1;
}
