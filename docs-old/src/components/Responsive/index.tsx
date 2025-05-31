import React from 'react';

const Responsive: React.FC<{
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}> = ({ mobile, desktop }) => {
  return (
    <>
      <div className="hidden md:block">{desktop}</div>
      <div className="block md:hidden">{mobile}</div>
    </>
  );
};

export default Responsive;
