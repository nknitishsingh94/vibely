import React, { Suspense } from 'react';
import DirectConversationClient from './client';

export default async function DirectConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center bg-background text-foreground text-sm">
          Loading conversation...
        </div>
      }
    >
      <DirectConversationClient conversationId={conversationId} />
    </Suspense>
  );
}
