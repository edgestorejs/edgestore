import * as React from 'react';

interface ProgressCircleProps {
  progress: number; // Percentage (0-100)
  size?: number; // Diameter of the circle
  strokeWidth?: number;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  progress,
  size = 48,
  strokeWidth = 4,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center text-white">
      <svg
        className="absolute" // Position SVG centered relative to the div
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }} // Start from top
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-gray-600"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-white"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }} // Smooth transition
        />
      </svg>
      {/* Progress Percentage Text (centered visually) */}
      <div className="z-10 text-xs font-medium">{Math.round(progress)}%</div>
    </div>
  );
};
