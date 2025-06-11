import * as React from 'react';
import { IconBase, type IconProps } from '../icon-base';

export const YoutubeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => {
    return (
      <IconBase ref={ref} viewBox="0 0 256 180" {...props}>
        <path
          d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134Z m-147.925 99.985 66.328-38.418-66.328-38.418z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </IconBase>
    );
  },
);

YoutubeIcon.displayName = 'YoutubeIcon';
