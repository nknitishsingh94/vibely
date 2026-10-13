import React, { Suspense } from 'react';
import InviteAcceptClient from './client';

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground text-sm">
          Loading invitation...
        </div>
      }
    >
      <InviteAcceptClient token={token} />
    </Suspense>
  );
}
