import React, { useState } from 'react';
import { Send, AlertCircle, Pin, X, Eye } from 'lucide-react';
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
  /** Director/officer/coordinator authority to pin and redact — a
      narrower gate than canPost (an ordinary member can post but not
      moderate). Omit both onPin/onRedact to hide moderation entirely. */
  onPin?: (messageId: string, pinned: boolean) => Promise<unknown>;
  onRedact?: (messageId: string) => Promise<unknown>;
}

function MessageRow({
  message, users, currentUser, onPin, onRedact,
}: {
  message: GroupMessage; users: User[]; currentUser: User;
  onPin?: (messageId: string, pinned: boolean) => Promise<unknown>;
  onRedact?: (messageId: string) => Promise<unknown>;
}) {
  const user = users.find((u) => u.id === message.senderId);
  const isCurrentUser = message.senderId === currentUser.id;
  const isPinned = !!message.pinnedAt;
  const canRedact = !message.redactedAt && (isCurrentUser || currentUser.role === 'director');

  return (
    <div className={`flex gap-3 group ${isPinned ? 'bg-ptr-accent/5 -mx-2 px-2 py-1.5 rounded' : ''}`}>
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
          {isPinned && (
            <span className="text-xs bg-ptr-accent/10 text-ptr-accent px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
              <Pin className="w-2.5 h-2.5" />Pinned
            </span>
          )}
          {(onPin || (onRedact && canRedact)) && !message.redactedAt && (
            <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onPin && (
                <button
                  onClick={() => void onPin(message.id, !isPinned)}
                  className="text-xs text-ptr-brown-light hover:text-ptr-accent px-1.5 h-6 rounded hover:bg-ptr-accent/10"
                  title={isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              {onRedact && canRedact && (
                <button
                  onClick={() => { if (confirm('Remove this message? This cannot be undone.')) void onRedact(message.id); }}
                  className="text-xs text-ptr-brown-light hover:text-signal-red px-1.5 h-6 rounded hover:bg-signal-red-bg"
                  title="Remove message"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          )}
        </div>
        <p className={`text-sm mt-0.5 break-words ${message.redactedAt ? 'italic text-ptr-brown-light' : 'text-ptr-brown'}`}>
          {message.redactedAt ? 'This message was removed.' : message.body}
        </p>
        {!message.redactedAt && (message.readCount ?? 0) > 0 && (
          <p className="flex items-center gap-1 text-[11px] text-ptr-brown-light mt-0.5">
            <Eye className="w-3 h-3" />Seen by {message.readCount}
          </p>
        )}
      </div>
    </div>
  );
}

export default function MessageThread({ messages, users, currentUser, canPost, disabledReason, onSend, emptyLabel = 'No messages yet.', onPin, onRedact }: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

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

  const pinned = messages.filter((m) => m.pinnedAt && !m.redactedAt);
  const unpinned = messages.filter((m) => !m.pinnedAt || m.redactedAt);

  return (
    <div className="space-y-4">
      {pinned.length > 0 && (
        <div className="space-y-3 pb-3 border-b border-ptr-cream-dark">
          {pinned.map((message) => (
            <MessageRow key={message.id} message={message} users={users} currentUser={currentUser} onPin={onPin} onRedact={onRedact} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-ptr-brown-light italic">{emptyLabel}</p>
        ) : (
          unpinned.map((message) => (
            <MessageRow key={message.id} message={message} users={users} currentUser={currentUser} onPin={onPin} onRedact={onRedact} />
          ))
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
