'use client';

import dynamic from 'next/dynamic';

const PlanAnalyzerPage = dynamic(
  () => import('@/features/plan-analyzer/components/plan-analyzer-page'),
  { ssr: false }
);

export default function Page() {
  return <PlanAnalyzerPage />;
}
