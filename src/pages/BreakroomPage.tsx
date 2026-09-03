import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePagePropertySelection } from '@/hooks/usePagePropertySelection';
import { createClient } from '@/lib/supabase';
import { useAssignments, useEmployees, useNotes, useProperties, useTasks } from '@/lib/supabase-queries';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { ErrorRetry } from '@/components/ErrorRetry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Bell, Check, ClipboardList, Hash, MessageSquare, Search, Send, StickyNote, Users, X } from 'lucide-react';

const supabase = createClient();

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

type CommsTab = 'announcements' | 'channels' | 'send';

function getInitials(first: string, last: string) {
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

function validTab(value: string | null): CommsTab {
  return value === 'channels' || value === 'send' || value === 'announcements' ? value : 'announcements';
}

export default function BreakroomPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') ?? null;
  const { orgId, currentUser } = useOrgProfile();
  const authUserId = currentUser?.authUser?.id;
  const myEmployeeId = currentUser?.employeeId ?? null;
  const todayKey = new Date().toLocaleDateString('en-CA');
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(orgId ?? undefined);
  const [selectedPropertyId, setSelectedPropertyId] = usePagePropertySelection({
    allowAllProperties: false,
    currentUser,
    properties,
  });
  const { data: employees = [], isLoading: employeesLoading } = useEmployees(
    selectedPropertyId || undefined,
    orgId ?? undefined,
  );
  const { data: notes = [], isLoading: notesLoading } = useNotes(
    selectedPropertyId || undefined,
    orgId ?? undefined,
  );
  const { data: assignments = [] } = useAssignments(
    todayKey,
    selectedPropertyId || undefined,
    orgId ?? undefined,
  );
  const { data: tasks = [] } = useTasks(undefined, orgId ?? undefined);

  const [activeTab, setActiveTab] = useState<CommsTab>(() => validTab(tabParam));
  const [activeChannel, setActiveChannel] = useState(COMPANY_CHANNEL);
  const [sendChannel, setSendChannel] = useState(COMPANY_CHANNEL);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSearch, setSendSearch] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(validTab(tabParam));
  }, [tabParam]);

  const channels = useMemo(
    () => [
      { id: COMPANY_CHANNEL, label: 'Company-wide' },
      ...properties.map((property) => ({ id: `property-${property.id}`, label: property.name })),
    ],
    [properties],
  );

  useEffect(() => {
    if (channels.some((channel) => channel.id === activeChannel)) return;
    setActiveChannel(COMPANY_CHANNEL);
  }, [activeChannel, channels]);

  useEffect(() => {
    if (channels.some((channel) => channel.id === sendChannel)) return;
    setSendChannel(COMPANY_CHANNEL);
  }, [channels, sendChannel]);

  const dailyNote = notes.find((note) => note.type === 'daily' && note.date === todayKey);
  const announcementNotes = useMemo(
    () => notes.filter((note) => note.type === 'daily' || note.type === 'general' || note.type === 'alert').slice(0, 40),
    [notes],
  );

  const assignmentSummary = useMemo(() => {
    const employeeNames = new Map(
      employees.map((employee) => [
        employee.id,
        `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim(),
      ]),
    );
    const taskNames = new Map(tasks.map((task) => [task.id, task.name]));
    return assignments.map((assignment) => ({
      id: assignment.id ?? `${assignment.employeeId}-${assignment.taskId}`,
      employeeName: employeeNames.get(assignment.employeeId) || 'Unassigned crew member',
      taskName: assignment.title || taskNames.get(assignment.taskId) || 'Assigned task',
    }));
  }, [assignments, employees, tasks]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'active'),
    [employees],
  );

  const filteredRecipients = useMemo(
    () =>
      activeEmployees.filter((employee) =>
        `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(sendSearch.toLowerCase()),
      ),
    [activeEmployees, sendSearch],
  );

  const selectedRecipients = useMemo(
    () => activeEmployees.filter((employee) => selectedRecipientIds.includes(employee.id)),
    [activeEmployees, selectedRecipientIds],
  );

  const fetchMessages = useCallback(async (channel: string) => {
    if (!orgId) return;
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
  }, [orgId]);

  const markRead = useCallback((channel: string) => {
    if (!orgId) return;
    localStorage.setItem(UNREAD_KEY(orgId, channel), new Date().toISOString());
    setUnreadCounts((prev) => ({ ...prev, [channel]: 0 }));
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void fetchMessages(activeChannel);
    markRead(activeChannel);
  }, [fetchMessages, activeChannel, orgId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!supabase || !authUserId || !orgId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timer = window.setTimeout(() => {
      channel = supabase
        .channel(`crew-comms-${authUserId}-${orgId}-${activeChannel}`)
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
              setUnreadCounts((prev) => ({
                ...prev,
                [msg.channel]: (prev[msg.channel] ?? 0) + 1,
              }));
            }
          },
        )
        .subscribe();
    }, 5000);

    return () => {
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [activeChannel, authUserId, orgId]);

  const postMessageToChannel = useCallback(
    async (channel: string, messageBody: string, successMessage: string) => {
      if (!messageBody.trim() || !orgId || !myEmployeeId) {
        if (!myEmployeeId) toast.error('Cannot identify your employee record to send messages.');
        return false;
      }
      setSending(true);
      const { error: err } = await supabase.from('messages').insert({
        org_id: orgId,
        channel,
        sender_id: myEmployeeId,
        body: messageBody.trim(),
      });
      setSending(false);
      if (err) {
        toast.error(err.message);
        return false;
      }
      toast.success(successMessage);
      return true;
    },
    [myEmployeeId, orgId],
  );

  const handleChannelSend = async () => {
    const sent = await postMessageToChannel(activeChannel, body, 'Message sent');
    if (sent) setBody('');
  };

  const handleSendToCrew = async () => {
    const recipientNames = selectedRecipients.length > 0
      ? selectedRecipients.map((employee) => `${employee.firstName} ${employee.lastName}`.trim()).join(', ')
      : 'All active crew in this property scope';
    const parts = [
      `To: ${recipientNames}`,
      sendSubject.trim() ? `Subject: ${sendSubject.trim()}` : '',
      sendBody.trim(),
    ].filter(Boolean);
    const sent = await postMessageToChannel(sendChannel, parts.join('\n\n'), 'Posted to Crew Comms');
    if (sent) {
      setSelectedRecipientIds([]);
      setSendSubject('');
      setSendBody('');
      setActiveChannel(sendChannel);
      setActiveTab('channels');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleChannelSend();
    }
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const getSenderName = (senderId: string) => {
    const employee = employees.find((item) => item.id === senderId);
    return employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';
  };

  const getSenderInitials = (senderId: string) => {
    const employee = employees.find((item) => item.id === senderId);
    return employee ? getInitials(employee.firstName, employee.lastName) : '?';
  };

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

  const activeChannelLabel = channels.find((channel) => channel.id === activeChannel)?.label ?? activeChannel;
  const sendChannelLabel = channels.find((channel) => channel.id === sendChannel)?.label ?? sendChannel;

  if (!orgId || propertiesLoading || employeesLoading) return <PageSkeleton />;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Crew Comms</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Announcements, live channels, and crew schedule posts in one place.
          </p>
        </div>
        <PropertySelector
          allowAllProperties={false}
          className="w-full sm:max-w-xs"
          orgId={orgId}
          value={selectedPropertyId}
          onChange={setSelectedPropertyId}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-h-0 overflow-hidden rounded-xl border border-surface-border bg-surface-card">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CommsTab)} className="flex h-full min-h-0 flex-col">
            <div className="border-b border-surface-border p-3">
              <TabsList className="grid h-auto w-full grid-cols-3 bg-surface-elevated p-1 text-text-secondary">
                <TabsTrigger value="announcements" className="text-xs data-[state=active]:bg-surface-card data-[state=active]:text-text-primary">
                  Announcements
                </TabsTrigger>
                <TabsTrigger value="channels" className="text-xs data-[state=active]:bg-surface-card data-[state=active]:text-text-primary">
                  Channels
                </TabsTrigger>
                <TabsTrigger value="send" className="text-xs data-[state=active]:bg-surface-card data-[state=active]:text-text-primary">
                  Send to Crew
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="announcements" className="m-0 min-h-0 flex-1 overflow-y-auto p-4">
              {notesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-lg bg-surface-elevated" />
                  ))}
                </div>
              ) : announcementNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
                    <Bell className="h-6 w-6 text-text-muted" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-text-primary">No announcements yet</p>
                  <p className="max-w-sm text-sm text-text-secondary">
                    Daily notes, general updates, and alerts for the selected property will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcementNotes.map((note) => (
                    <article key={note.id} className="rounded-lg border border-surface-border bg-surface-elevated p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={note.type === 'alert' ? 'warning' : note.type === 'daily' ? 'active' : 'hold'} className="capitalize">
                          {note.type}
                        </Badge>
                        <span className="text-xs text-text-muted">{note.date}</span>
                      </div>
                      <h2 className="text-sm font-semibold text-text-primary">{note.title}</h2>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{note.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="channels" className="m-0 min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0">
                <aside className="hidden w-56 shrink-0 flex-col border-r border-surface-border bg-surface-base md:flex">
                  <div className="border-b border-surface-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-brand" />
                      <span className="text-sm font-semibold text-text-primary">Channels</span>
                    </div>
                  </div>
                  <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                    {channels.map((channel) => {
                      const unread = unreadCounts[channel.id] ?? 0;
                      return (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => setActiveChannel(channel.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                            activeChannel === channel.id
                              ? 'bg-surface-hover font-medium text-text-primary'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <Hash className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          <span className="flex-1 truncate text-left">{channel.label}</span>
                          {unread > 0 ? (
                            <span className="rounded-full bg-brand px-1.5 py-0.5 text-xs font-bold text-text-inverse">
                              {unread}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </nav>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="border-b border-surface-border p-3 md:hidden">
                    <select
                      value={activeChannel}
                      onChange={(event) => setActiveChannel(event.target.value)}
                      className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-primary"
                    >
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>{channel.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
                    <Hash className="h-4 w-4 text-text-muted" />
                    <span className="text-sm font-semibold text-text-primary">{activeChannelLabel}</span>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto p-4">
                    {error ? (
                      <ErrorRetry message={error} onRetry={() => void fetchMessages(activeChannel)} />
                    ) : loading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((item) => (
                          <div key={item} className="flex items-start gap-3">
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
                                    {!isMe ? (
                                      <div className="mb-1 text-xs font-semibold text-brand">
                                        {getSenderName(msg.sender_id)}
                                      </div>
                                    ) : null}
                                    <p className="whitespace-pre-line text-sm leading-relaxed">{msg.body}</p>
                                    <div className="mt-1 text-2xs text-text-muted">
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

                  <div className="border-t border-surface-border p-3">
                    <div className="flex items-end gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
                      <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message #${activeChannelLabel}`}
                        rows={1}
                        className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                        style={{ maxHeight: 120, overflowY: 'auto' }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleChannelSend()}
                        disabled={!body.trim() || sending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-text-inverse transition-colors hover:bg-brand-bright disabled:opacity-40"
                        aria-label="Send channel message"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-2xs text-text-muted">Enter to send · Shift+Enter for new line</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="send" className="m-0 min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <section className="rounded-xl border border-surface-border bg-surface-elevated p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    <h2 className="text-sm font-semibold text-text-primary">Recipients</h2>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                    <Input
                      placeholder="Search crew"
                      value={sendSearch}
                      onChange={(event) => setSendSearch(event.target.value)}
                      className="h-8 border-surface-border bg-surface-card pl-7 text-xs text-text-primary"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mb-3 h-8 w-full text-xs"
                    onClick={() => setSelectedRecipientIds(filteredRecipients.map((employee) => employee.id))}
                  >
                    Select All
                  </Button>
                  <div className="max-h-96 space-y-1 overflow-y-auto">
                    {filteredRecipients.map((employee) => {
                      const selected = selectedRecipientIds.includes(employee.id);
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => toggleRecipient(employee.id)}
                          className={`flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors ${
                            selected ? 'bg-brand-ghost text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded border border-surface-border bg-surface-card">
                            {selected ? <Check className="h-3 w-3 text-brand" /> : null}
                          </span>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-ghost text-3xs font-semibold text-brand">
                            {getInitials(employee.firstName, employee.lastName)}
                          </span>
                          <span className="truncate text-xs">{employee.firstName} {employee.lastName}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-surface-border bg-surface-elevated p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">Post to Crew Comms</h2>
                      <p className="mt-1 text-xs text-text-secondary">
                        Posts to a shared channel. Recipient names are included in the message for clarity.
                      </p>
                    </div>
                    <select
                      value={sendChannel}
                      onChange={(event) => setSendChannel(event.target.value)}
                      className="rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-primary"
                    >
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>{channel.label}</option>
                      ))}
                    </select>
                  </div>

                  {selectedRecipients.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {selectedRecipients.map((employee) => (
                        <Badge key={employee.id} variant="secondary" className="gap-1 pr-1">
                          {employee.firstName} {employee.lastName}
                          <button type="button" onClick={() => toggleRecipient(employee.id)} className="ml-0.5 hover:text-status-warning" aria-label={`Remove ${employee.firstName} ${employee.lastName}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <Input
                    placeholder="Subject"
                    value={sendSubject}
                    onChange={(event) => setSendSubject(event.target.value)}
                    className="mb-3 border-surface-border bg-surface-card text-text-primary"
                  />
                  <Textarea
                    placeholder={`Type a crew update for ${sendChannelLabel}`}
                    value={sendBody}
                    onChange={(event) => setSendBody(event.target.value)}
                    className="min-h-[220px] resize-none border-surface-border bg-surface-card text-text-primary"
                  />
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleSendToCrew()}
                      disabled={!sendBody.trim() || sending}
                      className="bg-brand text-text-inverse hover:bg-brand/90"
                    >
                      <Send className="h-4 w-4" />
                      Post to Crew Comms
                    </Button>
                  </div>
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <aside className="min-h-0 overflow-y-auto rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Today</h2>
          </div>
          <div className="space-y-3">
            <section className="rounded-xl border border-surface-border bg-surface-elevated p-4">
              <div className="mb-2 flex items-center gap-2 text-brand">
                <StickyNote className="h-4 w-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wide">Today's Daily Note</h3>
              </div>
              {notesLoading ? (
                <div className="h-12 animate-pulse rounded bg-surface-hover" />
              ) : dailyNote ? (
                <>
                  <p className="font-semibold text-text-primary">{dailyNote.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{dailyNote.content}</p>
                </>
              ) : (
                <p className="text-sm text-text-muted">No daily note has been posted for today.</p>
              )}
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-elevated p-4">
              <div className="mb-3 flex items-center gap-2 text-brand">
                <ClipboardList className="h-4 w-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wide">Today's Assignments</h3>
              </div>
              {assignmentSummary.length > 0 ? (
                <div className="space-y-2">
                  {assignmentSummary.map((assignment) => (
                    <div key={assignment.id} className="rounded-lg bg-surface-hover px-3 py-2">
                      <p className="text-sm font-semibold text-text-primary">{assignment.employeeName}</p>
                      <p className="text-xs text-text-secondary">{assignment.taskName}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No assignments scheduled for today.</p>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
