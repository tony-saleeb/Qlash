import type { ReactNode } from 'react';
import { RegisterPlaySw } from '@/components/pwa/RegisterPlaySw';

export default function PlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RegisterPlaySw />
      {children}
    </>
  );
}
