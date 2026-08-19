'use client';

import { AnswerMark } from '@/components/brand/AnswerMark';
import { cn } from '@/lib/utils';
import { LOBBY_REACTION_MARKS, type LobbyReactionId } from '@/lib/game/reactions';

export type FloatingReaction = {
  id: string;
  mark: LobbyReactionId;
  nickname: string;
  left: string;
};

export function LobbyReactionLayer({ items }: { items: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {items.map((item) => {
        const def = LOBBY_REACTION_MARKS.find((row) => row.id === item.mark) || LOBBY_REACTION_MARKS[0];
        return (
          <span
            key={item.id}
            className="absolute bottom-28 flex flex-col items-center motion-reaction-float"
            style={{ left: item.left }}
          >
            <span className={cn('flex h-12 w-12 items-center justify-center', def.colorClass)}>
              <AnswerMark shape={def.id} className={cn('h-6 w-6', def.markClass)} />
            </span>
            <span dir="auto" className="mt-1 max-w-[7rem] truncate bg-arena-ink/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {item.nickname}
            </span>
          </span>
        );
      })}
    </div>
  );
}
