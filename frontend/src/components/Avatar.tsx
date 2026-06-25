const AVATAR_COLORS = [
  '#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894',
  '#74B9FF', '#A29BFE', '#55EFC4', '#FFEAA7', '#FAB1A0',
  '#E17055', '#0984E3', '#6C5CE7', '#00B894', '#E84393',
];

const ANIMAL_ICONS = ['🦊', '🐼', '🦉', '🐬', '🐯', '🐨', '🐰', '🐧', '🦩', '🦦',
  '🦔', '🦥', '🦨', '🦩', '🦫', '🦙', '🦨', '🦥', '🦩', '🦫'];

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

interface AvatarProps {
  /** Real avatar ID (for profile/settings pages) */
  id?: number;
  /** Anonymous avatar seed (for room participants) */
  seed?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ id, seed, size = 'md', className = '' }: AvatarProps) {
  const key = id ?? seed ?? 0;
  const color = AVATAR_COLORS[key % AVATAR_COLORS.length];
  const animal = ANIMAL_ICONS[key % ANIMAL_ICONS.length];
  const initials = id != null ? `A${id}` : animal;

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white ${sizeClasses[size]} ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
      title={id != null ? `Avatar ${id}` : `Anonymous #${seed}`}
    >
      {initials}
    </div>
  );
}

export function AvatarGrid({ selected, onSelect }: { selected?: number; onSelect: (id: number) => void }) {
  return (
    <div className="grid grid-cols-10 gap-2">
      {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className={`rounded-lg p-2 transition-all ${selected === n ? 'ring-2 ring-primary scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100'}`}
        >
          <Avatar id={n} size="sm" />
        </button>
      ))}
    </div>
  );
}
