import * as React from 'react';
import { IconBase, type IconProps } from '../icon-base';

export const TwitterIcon = React.forwardRef<SVGSVGElement, IconProps>(
  (props, ref) => {
    return (
      <IconBase ref={ref} viewBox="0 0 1360 1387" {...props}>
        <path
          fill="currentColor"
          d="M794.163 599.284 1240.89 80h-105.86L747.137 530.887 437.328 80H80l468.492 681.821L80 1306.37h105.866l409.625-476.152 327.181 476.152H1280L794.137 599.284h.026ZM649.165 767.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H972.476L649.165 767.854v-.026Z"
        />
      </IconBase>
    );
  },
);

TwitterIcon.displayName = 'TwitterIcon';
