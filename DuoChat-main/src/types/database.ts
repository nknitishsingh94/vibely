export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  role: 'member' | 'admin';
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType;
  body: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  duration_seconds: number | null;
  reply_to_message_id: string | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface MessageReceipt {
  id: string;
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  created_by: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  read_receipts_enabled: boolean;
  typing_indicators_enabled: boolean;
  sounds_enabled: boolean;
  updated_at: string;
}

export type DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageWithDetails extends Message {
  sender?: Profile;
  receipts?: MessageReceipt[];
  reactions?: MessageReaction[];
  reply_to?: {
    id: string;
    sender_name: string;
    message_type: MessageType;
    body: string | null;
    original_filename: string | null;
  } | null;
  deliveryStatus?: DeliveryStatus;
  signedMediaUrl?: string | null;
  isOptimistic?: boolean;
}

export interface ConversationWithDetails extends Conversation {
  members: (ConversationMember & { profile: Profile })[];
  otherUser?: Profile;
  lastMessage?: Message | null;
  unreadCount: number;
}

export interface UserPresence {
  userId: string;
  online: boolean;
  lastSeen: string;
  isTyping?: boolean;
  typingInConversationId?: string | null;
}
