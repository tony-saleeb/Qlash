import { redirect } from 'next/navigation';
import { readHostAuth } from '@/lib/supabase/hostAuth';
import HostGameClient from '@/app/host/[sessionId]/HostGameClient';
import HostClickerClient from '@/app/host/[sessionId]/HostClickerClient';
import { livePlayerCap } from '@/lib/game/constants';
import { isHostClickerView } from '@/lib/game/lateJoin';
import { normalizeLocale } from '@/lib/i18n/locale';
import { loadHostRoom } from '@/lib/host/hostRoom';

export const dynamic = 'force-dynamic';

interface HostSessionPageProps {
  params: {
    sessionId: string;
  };
  searchParams: {
    view?: string;
  };
}

export default async function HostSessionPage({ params, searchParams }: HostSessionPageProps) {
  const { sessionId } = params;
  const { supabase, user } = await readHostAuth();
  if (!user) {
    redirect('/');
  }

  const [room, hostResult] = await Promise.all([
    loadHostRoom(supabase, user, sessionId),
    supabase.from('hosts').select('plan, ui_locale').eq('id', user.id).maybeSingle(),
  ]);
  if (!room) {
    redirect('/dashboard');
  }

  const hostRow = hostResult.data;

  const clicker = isHostClickerView(searchParams.view);
  const initialLocale = normalizeLocale(hostRow?.ui_locale);

  return clicker ? (
    <HostClickerClient
      initialSession={room.session}
      quiz={room.quiz}
      questions={room.questions}
      initialPlayers={room.players}
      initialLocale={initialLocale}
    />
  ) : (
    <HostGameClient
      initialSession={room.session}
      quiz={room.quiz}
      questions={room.questions}
      initialPlayers={room.players}
      playerCap={livePlayerCap(hostRow?.plan)}
      initialLocale={initialLocale}
    />
  );
}
