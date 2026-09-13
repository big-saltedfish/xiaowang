import Image from 'next/image';
export function CompanionAvatar({
  state = 'idle',
  compact = false,
}: {
  state?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`companion-avatar ${compact ? 'compact' : ''} state-${state}`}
      aria-hidden="true"
    >
      <div className="companion-halo" />
      <Image
        src="/images/xiaowang.png"
        alt=""
        width={1280}
        height={1280}
        priority
        unoptimized
        draggable={false}
      />
    </div>
  );
}
