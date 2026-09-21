import { ArrowUpRight, Braces } from 'lucide-react';
import Link from 'next/link';

export function CodeExample() {
  return (
    <div className="ll-code-pair">
      <div className="ll-code-pane">
        <div className="ll-code-label">
          <span>
            <Braces size={16} />
            Server
          </span>
          <span>Define your bucket</span>
        </div>
        <pre>
          <code>
            <span className="ll-code-key">const</span>
            {
              ' router = es.router({\n  projectFiles: es.fileBucket({\n    maxSize: '
            }
            <span className="ll-code-value">{'10 * 1024 * 1024'}</span>
            {',\n    accept: ['}
            <span className="ll-code-string">{'"application/pdf"'}</span>
            {'],\n  }),\n});'}
          </code>
        </pre>
      </div>
      <div className="ll-code-pane">
        <div className="ll-code-label">
          <span>
            <Braces size={16} />
            React
          </span>
          <span>Use the inferred client</span>
        </div>
        <pre>
          <code>
            <span className="ll-code-key">const</span>
            {' { edgestore } = useEdgeStore();\n\n'}
            <span className="ll-code-key">{'const'}</span>
            {' result = '}
            <span className="ll-code-key">await</span>
            {' edgestore\n  .'}
            <mark>projectFiles</mark>
            {'.upload({\n    file,\n    onProgressChange: setProgress,\n  });'}
          </code>
        </pre>
      </div>
      <div className="ll-code-caption">
        <span>Bucket and upload excerpts. Setup lives in the guide.</span>
        <Link href="/docs/quick-start">
          See the full integration <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
