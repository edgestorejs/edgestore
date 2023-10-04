import { motion } from 'framer-motion';
import React, { useRef } from 'react';

export function BlurryBlob(props: {
  mouse: {
    x: number;
    y: number;
  };
  width: number | string;
  height: number | string;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
}) {
  const { mouse, width, height, top, right, bottom, left } = props;
  const ref = useRef<HTMLDivElement>(null);

  const posInfo = ref.current?.getBoundingClientRect();
  const deltaX = mouse.x - ((posInfo?.left ?? 0) + (posInfo?.width ?? 0) / 2);
  const deltaY = mouse.y - ((posInfo?.top ?? 0) + (posInfo?.height ?? 0) / 2);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top,
        right,
        bottom,
        left,
        filter: `blur(120px)`,
        transform: `translate(-50%, 0)`,
      }}
    >
      <motion.div
        animate={{
          translateX: deltaX * 0.2,
          translateY: deltaY * 0.2,
        }}
        transition={{
          ease: 'easeOut',
        }}
      >
        <svg
          viewBox="0 0 900 900"
          preserveAspectRatio="none"
          width={width}
          height={height}
        >
          <g transform="translate(375.26202449907515 463.0883080270246)">
            <motion.path
              fill="#BB004B"
              d="M285.6 -265.9C379.4 -191.9 470.9 -95.9 474 3.1C477.1 102.1 391.6 204.1 297.9 262.6C204.1 321.1 102.1 336.1 -12.5 348.6C-127 361 -254.1 371.1 -301 312.6C-347.8 254.1 -314.6 127 -290.5 24C-266.5 -79 -251.7 -157.9 -204.8 -231.9C-157.9 -305.9 -79 -375 8.5 -383.4C95.9 -391.9 191.9 -339.9 285.6 -265.9"
              animate={{
                d: [
                  'M285.6 -265.9C379.4 -191.9 470.9 -95.9 474 3.1C477.1 102.1 391.6 204.1 297.9 262.6C204.1 321.1 102.1 336.1 -12.5 348.6C-127 361 -254.1 371.1 -301 312.6C-347.8 254.1 -314.6 127 -290.5 24C-266.5 -79 -251.7 -157.9 -204.8 -231.9C-157.9 -305.9 -79 -375 8.5 -383.4C95.9 -391.9 191.9 -339.9 285.6 -265.9',
                  'M294.8 -341C341.7 -248 311.5 -124 298.8 -12.7C286 98.5 290.8 197 243.9 258.4C197 319.7 98.5 343.9 14.3 329.6C-70 315.3 -140 262.7 -207.8 201.3C-275.7 140 -341.3 70 -372.6 -31.3C-403.9 -132.6 -400.8 -265.2 -333 -358.2C-265.2 -451.2 -132.6 -504.6 -4.3 -500.3C124 -496 248 -434 294.8 -341',
                  'M282.8 -253.7C376.5 -189 469.5 -94.5 485.4 15.9C501.3 126.3 440.2 252.7 346.4 328.2C252.7 403.7 126.3 428.3 25.9 402.4C-74.5 376.5 -149 300 -228.5 224.5C-308 149 -392.5 74.5 -388.4 4.1C-384.3 -66.3 -291.6 -132.6 -212.1 -197.3C-132.6 -261.9 -66.3 -325 14.1 -339.1C94.5 -353.2 189 -318.4 282.8 -253.7',
                ],
                fill: ['#873db1', '#6630a7', '#4d30a6', '#6630a7'],
              }}
              transition={{
                repeat: Infinity,
                ease: 'easeInOut',
                repeatType: 'reverse',
                duration: 4,
              }}
            />
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
