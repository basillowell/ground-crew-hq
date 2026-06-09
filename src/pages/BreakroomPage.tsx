import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { toast } from '@/components/ui/sonner';
import { Send, MessageSquare, Hash } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';

// columns from messages migration
interface Message {
  id: string;
  org_id: string;
  channel: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const COMPANY_CHANNEL = 'general';
const UNREAD_KEY = (orgId: string, channel: string) =>
  `gc-breakroom-last-seen-${orgId}-${channel}`;

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BreakroomPage() {
  const { orgId } = useAuth();
  const isHydrated = useAppStore((s) => s.isHydrated);
  const employees = useAppStore((s) => s.employees);
  const properties = useAppStore((s) => s.properties);
  const channels = [
    { id: COMPANY_CHANNEL, label: 'Company-wide' },
    ...properties.map((p) => ({ id: `property-${p.id}`, label: p.name })),
  ];

  const [activeChannel, setActiveChannel] = useState(COMPANY_CHANNEL);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<RealtimeChannel | null>(null);

  // Find current employee from auth
  const authContext = useAuth();
  const myEmployeeId = authContext.currentUser?.employeeId ?? null;

  const fetchMessages = useCallback(async (channel: string) => {
    if (!orgId || !isHydrated) return;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => setError('Request timed out after 8 seconds.'), 8000);
    try {
      const { data, error: err } = await supabase
        .from('messages')
        .select('id, org_id, channel, sender_id, body, created_at')
        .eq('org_id', orgId)
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(200);
      if (err) throw err;
      setMessages(data ?? []);
    } catch (e) {
      setError((e as Error).message || 'Failed to load messages');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [orgId, isHydrated]);

  // Mark channel as read
  const markRead = useCallback((channel: string) => {
    if (!orgId) return;
    localStorage.setItem(UNREAD_KEY(orgId, channel), new Date().toISOString());
    setUnreadCounts((prev) => ({ ...prev, [channel]: 0 }));
  }, [orgId]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchMessages(activeChannel);
    markRead(activeChannel);
  }, [fetchMessages, activeChannel, isHydrated, markRead]);

  // Scroll to bottom when messages load or change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!orgId || !isHydrated) return;

    realtimeRef.current?.unsubscribe();

    const channel = supabase
      .channel(`breakroom-${orgId}-${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.channel === activeChannel) {
            setMessages((prev) => [...prev, msg]);
          } else {
            // increment unread for other channel
            setUnreadCounts((prev) => ({
              ...prev,
              [msg.channel]: (prev[msg.channel] ?? 0) + 1,
            }));
          }
        },
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      void channel.unsubscribe();
    };
  }, [orgId, isHydrated, activeChannel]);

  const handleSend = async () => {
    if (!body.trim() || !orgId || !myEmployeeId) {
      if (!myEmployeeId) toast.error('Cannot identify your employee record to send messages.');
      return;
    }
    setSending(true);
    const { error: err } = await supabase.from('messages').insert({
      org_id: orgId,
      channel: activeChannel,
      sender_id: myEmployeeId,
      body: body.trim(),
    });
    setSending(false);
    if (err) { toast.error(err.message); return; }
    setBody('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const getSenderName = (senderId: string) => {
    const emp = employees.find((e) => e.id === senderId);
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
  };

  const getSenderInitials = (senderId: string) => {
    const emp = employees.find((e) => e.id === senderId);
    return emp ? initials(emp.first_name, emp.last_name) : '?';
  };

  // Group messages by date
  const groupedMessages: Array<{ dateLabel: string; messages: Message[] }> = [];
  messages.forEach((msg) => {
    const label = fmtDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.dateLabel === label) {
      last.messages.push(msg);
    } else {
      groupedMessages.push({ dateLabel: label, messages: [msg] });
    }
  });

  const activeChannelLabel =
    channels.find((c) => c.id === activeChannel)?.label ?? activeChannel;

  if (!isHydrated) return <PageSkeleton />;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Channel sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-surface-border bg-surface-base">
        <div className="border-b border-surface-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-text-primary">Channels</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {channels.map((ch) => {
            const unread = unreadCounts[ch.id] ?? 0;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeChannel === ch.id
                    ? 'bg-surface-hover font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <span className="flex-1 truncate text-left">{ch.label}</span>
                {unread > 0 && (
                  <span className="rounded-full bg-brand px-1.5 py-0.5 text-xs font-bold text-text-inverse">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Message area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Hash className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{activeChannelLabel}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error ? (
            <ErrorRetry message={error} onRetry={() => void fetchMessages(activeChannel)} />
          ) : loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-surface-elevated" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-surface-elevated" />
                    <div className="h-4 w-64 animate-pulse rounded bg-surface-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
                <MessageSquare className="h-6 w-6 text-text-muted" />
              </div>
              <p className="mb-1 text-sm font-semibold text-text-primary">No messages yet</p>
              <p className="text-sm text-text-secondary">
                Be the first to say something in #{activeChannelLabel}.
              </p>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.dateLabel}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex-1 border-t border-surface-border" />
                  <span className="text-xs font-medium text-text-muted">{group.dateLabel}</span>
                  <div className="flex-1 border-t border-surface-border" />
                </div>
                <div className="space-y-3">
                  {group.messages.map((msg) => {
                    const isMe = msg.sender_id === myEmployeeId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-brand">
                          {getSenderInitials(msg.sender_id)}
                        </div>
                        <div
                          className={`max-w-[70%] rounded-xl px-3 py-2 ${
                            isMe
                              ? 'bg-brand-ghost text-text-primary'
                              : 'bg-surface-elevated text-text-primary'
                          }`}
                        >
                          {!isMe && (
                            <div className="mb-1 text-xs font-semibold text-brand">
                              {getSenderName(msg.sender_id)}
                            </div>
                          )}
                          <p className="text-sm leading-relaxed">{msg.body}</p>
                          <div className="mt-1 text-[11px] text-text-muted">
                            {fmtTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-surface-border p-3">
          <div className="flex items-end gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${activeChannelLabel}…`}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              style={{ maxHeight: 120, overflowY: 'auto' }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!body.trim() || sending}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-text-inverse transition-colors hover:bg-brand-bright disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}

