import { redirect } from 'next/navigation';
import { getSessionReport, getPreviousSessionReport } from '@/app/actions/reports';
import SessionReportClient from './SessionReportClient';

export const dynamic = 'force-dynamic';

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  let report;
  let previous = null;
  try {
    report = await getSessionReport(sessionId);
    previous = await getPreviousSessionReport(sessionId);
  } catch (err: unknown) {
    if (err instanceof Error && /Unauthorized/.test(err.message)) {
      redirect('/');
    }
    redirect('/dashboard');
  }

  return <SessionReportClient report={report} previous={previous} />;
}
