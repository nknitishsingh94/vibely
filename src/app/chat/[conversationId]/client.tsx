'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/chat-context';
import ChatPage from '../page';

export default function DirectConversationClient({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const { setActiveConversationId, activeConversationId } = useChat();
  const hasInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (conversationId && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setActiveConversationId(conversationId);
    }
  }, [conversationId, setActiveConversationId]);

  // If user backed out while on /chat/[conversationId], navigate to /chat so they stay on the user list
  React.useEffect(() => {
    if (hasInitializedRef.current && !activeConversationId) {
      router.push('/chat');
    }
  }, [activeConversationId, router]);

  return <ChatPage />;
}
