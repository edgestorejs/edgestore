import * as React from 'react';
import { IconBase, type IconProps } from '../icon-base';

export const DevtoIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => {
    return (
      <IconBase ref={ref} viewBox="0 0 256 256" {...props}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M87.3749 147.217C87.3749 157.436 81.0804 172.918 61.1561 172.886H36V83H61.6874C80.9015 83 87.3641 98.4608 87.3695 108.685L87.3749 147.217ZM62.582 99.8189C64.6856 99.8189 66.7946 100.607 68.8982 102.182C70.9963 103.757 72.0535 106.126 72.0589 109.277V147.114C72.0589 150.27 71.0071 152.633 68.9036 154.209C66.8 155.784 64.691 156.572 62.5874 156.572H53.1268V99.8189H62.582Z"
          fill="currentColor"
        />
        <path
          d="M141.959 99.0529H113.073V119.924H130.731V135.988H113.073V156.854H141.965V172.918H108.253C102.203 173.076 97.1717 168.284 97.0199 162.222V94.2561C96.8735 88.1989 101.661 83.1684 107.706 83.0163H141.965L141.959 99.0529Z"
          fill="currentColor"
        />
        <path
          d="M198.149 161.684C190.992 178.389 178.17 175.064 172.429 161.684L151.539 83.0217H169.197L185.305 144.8L201.336 83.0217H219L198.149 161.684Z"
          fill="currentColor"
        />
      </IconBase>
    );
  },
);

DevtoIcon.displayName = 'DevtoIcon';
