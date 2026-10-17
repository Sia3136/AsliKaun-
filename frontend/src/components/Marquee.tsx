import React from 'react';

const ITEMS = [
  'Rideshare Platforms',
  'Last-Mile Logistics',
  'On-Demand Delivery',
  'Micro-Mobility Fleets',
  'Courier Networks',
  'Gig Economy Systems',
  'Fleet Dispatch',
  'Trust Intelligence',
];

export const Marquee: React.FC = () => {
  return (
    <div className="mq" aria-hidden="true">
      <div className="mq-track">
        {ITEMS.concat(ITEMS).map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </div>
    </div>
  );
};
