import React, { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import type { GroupMessage, User } from '../types';
import { formatRelative } from '../utils/formatters';

// Same visual language and failed/sending-state handling as
// CommentThread.tsx (private task discussion, left untouched — see the
// schema-doc note in supabase/schema.sql on why private task discussion
// stays on the `comments` table). This is the generalized version for the
// two genuinely new conversation types (group announcements, occurrence
// discussion), which is why it takes a GroupMessage[] + a
// canPost/disabledReason pair instead of always allowing input.
interface Props {
  messages: GroupMessage[];
  users: User[];
  currentUser: User;
  canPost: boolean;
  /** Shown in place of the input when canPost is false (e.g. "Only coordinators and officers can post here."). */
  disabledReason?: string;
  onSend: (body: string) => Promise<unknown>;
  emptyLabel?: string;
}

export default function MessageThread({ messages, users, currentUser, canPost, disabledReason, onSend, emptyLabel = 'No messages yet.' }: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const getUserById = (id: string) => users.find((u) => u.id === id);

  const send = async (body: string) => {
    setSending(true);
    setFailed(false);
    try {
      await onSend(body);
      setValue('');
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    void send(trimmed);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-ptr-brown-light italic">{emptyLabel}</p>
        ) : (
          messages.map((message) => {
            const user = getUserById(message.senderId);
            const isCurrentUser = message.senderId === currentUser.id;
            return (
              <div key={message.id} className="flex gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    isCurrentUser ? 'bg-ptr-green text-white' : 'bg-ptr-cream-dark text-ptr-brown'
                  }`}
                >
                  {user?.avatarInitials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ptr-brown">{user?.name || 'Unknown'}</span>
                    <span className="text-xs text-ptr-brown-light">{formatRelative(message.createdAt)}</span>
                    {(user?.role === 'director' || user?.role === 'range_officer') && (
                      <span className="text-xs bg-ptr-green/10 text-ptr-green px-1.5 py-0.5 rounded-full font-medium">
                        {user.role === 'director' ? 'Director' : 'Officer'}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 break-words ${message.redactedAt ? 'italic text-ptr-brown-light' : 'text-ptr-brown'}`}>
                    {message.redactedAt ? 'This message was removed.' : message.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-2 border-t border-ptr-cream-dark">
        {canPost ? (
          <>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-ptr-green text-white">
                {currentUser.avatarInitials}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (failed) setFailed(false); }}
                  placeholder="Write a message…"
                  maxLength={4000}
                  disabled={sending}
                  className="input-field flex-1"
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="submit"
                  disabled={!value.trim() || sending}
                  className="btn-primary px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={sending ? 'Sending message' : 'Send message'}
                >
                  <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            </form>
            {failed && (
              <p className="flex items-center gap-1.5 text-xs text-signal-red mt-1.5 ml-11">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Couldn&rsquo;t send — check your connection and try again.
              </p>
            )}
          </>
        ) : (
          disabledReason && <p className="text-13 text-n-70 text-center py-1">{disabledReason}</p>
        )}
      </div>
    </div>
  );
}
