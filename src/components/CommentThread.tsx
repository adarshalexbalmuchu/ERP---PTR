import React, { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import type { Comment, User } from '../types';
import { formatRelative } from '../utils/formatters';

interface Props {
  comments: Comment[];
  users: User[];
  currentUser: User;
  /** May reject — the caller's real mutation, not fire-and-forget, so this
      component can tell a genuine failure apart from a successful send and
      never silently discard what the user typed. */
  onAddComment: (content: string) => Promise<unknown>;
}

export default function CommentThread({ comments, users, currentUser, onAddComment }: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const getUserById = (id: string) => users.find((u) => u.id === id);

  const send = async (content: string) => {
    setSending(true);
    setFailed(false);
    try {
      await onAddComment(content);
      setValue('');
    } catch {
      // Deliberately keep the typed text in the box — this is exactly the
      // "failed state, don't lose what was typed" case comments didn't
      // handle before (the input used to clear unconditionally).
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
      {/* Comment list */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-ptr-brown-light italic">No comments yet.</p>
        ) : (
          comments.map((comment) => {
            const user = getUserById(comment.userId);
            const isCurrentUser = comment.userId === currentUser.id;
            return (
              <div key={comment.id} className="flex gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    isCurrentUser
                      ? 'bg-ptr-green text-white'
                      : 'bg-ptr-cream-dark text-ptr-brown'
                  }`}
                >
                  {user?.avatarInitials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ptr-brown">
                      {user?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-ptr-brown-light">
                      {formatRelative(comment.createdAt)}
                    </span>
                    {(user?.role === 'director' || user?.role === 'range_officer') && (
                      <span className="text-xs bg-ptr-green/10 text-ptr-green px-1.5 py-0.5 rounded-full font-medium">
                        {user.role === 'director' ? 'Director' : 'Officer'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ptr-brown mt-0.5 break-words">{comment.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add comment */}
      <div className="pt-2 border-t border-ptr-cream-dark">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-ptr-green text-white">
            {currentUser.avatarInitials}
          </div>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); if (failed) setFailed(false); }}
              placeholder="Add a comment..."
              maxLength={2000}
              disabled={sending}
              className="input-field flex-1"
              style={{ fontSize: '16px' }}
            />
            <button
              type="submit"
              disabled={!value.trim() || sending}
              className="btn-primary px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={sending ? 'Sending comment' : 'Send comment'}
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
      </div>
    </div>
  );
}
