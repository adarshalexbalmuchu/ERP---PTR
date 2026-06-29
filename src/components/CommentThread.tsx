import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { Comment, User } from '../types';
import { formatRelative } from '../utils/formatters';

interface Props {
  comments: Comment[];
  users: User[];
  currentUser: User;
  onAddComment: (content: string) => void;
}

export default function CommentThread({ comments, users, currentUser, onAddComment }: Props) {
  const [value, setValue] = useState('');

  const getUserById = (id: string) => users.find((u) => u.id === id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setValue('');
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
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-ptr-cream-dark">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-ptr-green text-white"
        >
          {currentUser.avatarInitials}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a comment..."
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="btn-primary px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
