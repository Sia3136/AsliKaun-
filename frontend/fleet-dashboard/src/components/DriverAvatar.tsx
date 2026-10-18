import React from 'react';

interface DriverAvatarProps {
  id: string;
  name: string;
  statusDot?: 'red' | 'green' | 'amber';
  size?: 'sm' | 'md' | 'lg';
}

export const DriverAvatar: React.FC<DriverAvatarProps> = ({
  id,
  name,
  statusDot = 'green',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  };

  const dotSizeClasses = {
    sm: 'w-2.5 h-2.5 border',
    md: 'w-3 h-3 border-2',
    lg: 'w-4 h-4 border-2',
  };

  const dotColorClasses = {
    red: 'bg-[#ba1a1a]',
    green: 'bg-[#00855b]',
    amber: 'bg-[#d97706]',
  };

  // Curated SVG styling or photo silhouettes matching the screenshot drivers
  const getAvatarContent = () => {
    switch (id) {
      case 'DRV-9042': // Marcus Vance
        return (
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" fill="#fde68a" />
            {/* Character styling: friendly smile, beard, dark hair, blue collared shirt */}
            <circle cx="50" cy="40" r="22" fill="#d97706" />
            <path d="M28 85 C28 65 38 60 50 60 C62 60 72 65 72 85 Z" fill="#1e3a8a" />
            <path d="M42 60 L50 72 L58 60 Z" fill="#ffffff" />
            <path d="M40 32 C40 22 60 22 60 32" stroke="#451a03" strokeWidth="6" strokeLinecap="round" />
            <circle cx="43" cy="38" r="2.5" fill="#451a03" />
            <circle cx="57" cy="38" r="2.5" fill="#451a03" />
            <path d="M45 46 Q50 50 55 46" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M40 43 Q50 58 60 43" fill="#78350f" opacity="0.4" />
          </svg>
        );
      case 'DRV-4112': // Sophia Chen
        return (
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" fill="#bfdbfe" />
            {/* Sophia Chen: dark sleek hair, professional blazer */}
            <circle cx="50" cy="40" r="20" fill="#fbcfe8" />
            <path d="M26 85 C26 64 36 58 50 58 C64 58 74 64 74 85 Z" fill="#0f172a" />
            <path d="M44 58 L50 68 L56 58 Z" fill="#38bdf8" />
            <path d="M30 38 C30 20 70 20 70 38 C70 48 68 54 66 58 C60 54 62 44 62 44" fill="#0f172a" />
            <path d="M30 38 C30 48 32 54 34 58 C40 54 38 44 38 44" fill="#0f172a" />
            <circle cx="43" cy="38" r="2.5" fill="#0f172a" />
            <circle cx="57" cy="38" r="2.5" fill="#0f172a" />
            <path d="M46 47 Q50 50 54 47" stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'DRV-7890': // David Miller
        return (
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" fill="#dcfce7" />
            {/* David Miller: brown hair, navy utility vest */}
            <circle cx="50" cy="40" r="21" fill="#fed7aa" />
            <path d="M26 85 C26 66 36 60 50 60 C64 60 74 66 74 85 Z" fill="#1e293b" />
            <path d="M42 60 L50 74 L58 60 Z" fill="#059669" />
            <path d="M34 32 C35 22 65 22 66 32" stroke="#78350f" strokeWidth="8" strokeLinecap="round" />
            <circle cx="43" cy="39" r="2.5" fill="#451a03" />
            <circle cx="57" cy="39" r="2.5" fill="#451a03" />
            <path d="M45 47 Q50 50 55 47" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'DRV-3319': // Tariq Al-Mansoor
        return (
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" fill="#fed7aa" />
            {/* Tariq: black hair, trimmed beard, dark suit jacket */}
            <circle cx="50" cy="40" r="21" fill="#fcd34d" />
            <path d="M26 85 C26 64 36 59 50 59 C64 59 74 64 74 85 Z" fill="#334155" />
            <path d="M43 59 L50 70 L57 59 Z" fill="#ffffff" />
            <path d="M34 30 C35 20 65 20 66 30" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
            <path d="M37 42 C37 54 63 54 63 42" fill="#0f172a" opacity="0.8" />
            <circle cx="43" cy="37" r="2.5" fill="#0f172a" />
            <circle cx="57" cy="37" r="2.5" fill="#0f172a" />
            <path d="M46 45 Q50 48 54 45" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        );
      case 'DRV-6621': // Elena Rostova
        return (
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" fill="#e0e7ff" />
            {/* Elena Rostova: blonde/light brown hair, dark turtleneck */}
            <circle cx="50" cy="40" r="20" fill="#ffedd5" />
            <path d="M28 85 C28 65 38 60 50 60 C62 60 72 65 72 85 Z" fill="#1e1b4b" />
            <path d="M42 60 C42 56 58 56 58 60" stroke="#1e1b4b" strokeWidth="6" />
            <path d="M32 36 C34 22 66 22 68 36 C68 46 64 52 64 54" stroke="#d97706" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="43" cy="38" r="2.5" fill="#1e1b4b" />
            <circle cx="57" cy="38" r="2.5" fill="#1e1b4b" />
            <path d="M46 47 Q50 49 54 47" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-slate-700 text-white font-semibold">
            {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        );
    }
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full overflow-visible shrink-0`}>
      <div className="w-full h-full rounded-full overflow-hidden border border-slate-200 shadow-xs">
        {getAvatarContent()}
      </div>
      {statusDot && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-white ${dotSizeClasses[size]} ${dotColorClasses[statusDot]}`}
        />
      )}
    </div>
  );
};
