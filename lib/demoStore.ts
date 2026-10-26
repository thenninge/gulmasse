/**
 * In-memory store for LOCAL_DEMO=1 so invite/påmelding can be tested
 * without Supabase. Data resets when the server restarts.
 */

export type DemoEvent = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  location: string | null;
  event_date: string | null;
  event_time: string | null;
  status: 'draft' | 'registration' | 'live' | 'archived';
  invite_code: string;
  registration_open: boolean;
  max_participants: number | null;
  created_at: string;
};

export type DemoRegistration = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'invited' | 'accepted' | 'declined' | 'waitlist' | 'cancelled';
  bringing_beer: boolean | null;
  beer_note: string | null;
  message: string | null;
  invite_token: string;
  participant_pin: string | null;
  created_at: string;
  responded_at: string | null;
};

export type DemoParticipant = {
  pin: string;
  nickname: string | null;
  active: boolean;
  beer_name?: string | null;
  producer?: string | null;
  beer_type?: string | null;
  abv?: number | null;
  created_at: string;
};

type DemoState = {
  events: DemoEvent[];
  registrations: DemoRegistration[];
  participants: DemoParticipant[];
  appState: Record<string, { text_value?: string; bool_value?: boolean; int_value?: number }>;
};

const globalForDemo = globalThis as unknown as { __gulmasseDemo?: DemoState };

function seed(): DemoState {
  const eventId = '00000000-0000-4000-8000-000000000026';
  return {
    events: [
      {
        id: eventId,
        slug: 'gulmasse-2026',
        name: "Gulmasse '26",
        tagline: 'Christmas Beer Competition',
        description:
          'Det er en juleøl-event. Istedenfor å komme på juleølsmaking, skal du som deltaker ta med en juleøl du mener kan være årets beste!',
        location: null,
        event_date: '2026-11-28',
        event_time: null,
        status: 'registration',
        invite_code: 'GULMASSE26',
        registration_open: true,
        max_participants: null,
        created_at: new Date().toISOString(),
      },
    ],
    registrations: [],
    participants: [],
    appState: {
      active_event_slug: { text_value: 'gulmasse-2026' },
      logins_locked: { bool_value: false },
      current_round: { int_value: 1 },
      reveal_results: { bool_value: false },
    },
  };
}

export function isLocalDemo(): boolean {
  return process.env.LOCAL_DEMO === '1' || process.env.LOCAL_DEMO === 'true';
}

export function getDemoStore(): DemoState {
  if (!globalForDemo.__gulmasseDemo) {
    globalForDemo.__gulmasseDemo = seed();
  }
  return globalForDemo.__gulmasseDemo;
}

export function demoActiveEvent(): DemoEvent | null {
  const store = getDemoStore();
  const slug = store.appState.active_event_slug?.text_value || 'gulmasse-2026';
  return store.events.find((e) => e.slug === slug) || store.events[0] || null;
}

function token(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function id(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function demoRegisterAccepted(name: string, pin: string) {
  const store = getDemoStore();
  const event = demoActiveEvent();
  if (!event) throw new Error('Ingen aktivt event');
  if (!event.registration_open) {
    const err = new Error('Påmelding er stengt');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  if (store.appState.logins_locked?.bool_value) {
    const err = new Error('Pålogging er midlertidig låst');
    (err as Error & { status?: number }).status = 423;
    throw err;
  }
  if (store.participants.some((p) => p.pin === pin)) {
    const err = new Error('PIN er allerede i bruk – velg en annen');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  store.participants.push({
    pin,
    nickname: name,
    active: true,
    created_at: new Date().toISOString(),
  });

  const registration: DemoRegistration = {
    id: id(),
    event_id: event.id,
    name,
    email: null,
    phone: null,
    status: 'accepted',
    bringing_beer: true,
    beer_note: null,
    message: null,
    invite_token: token(),
    participant_pin: pin,
    created_at: new Date().toISOString(),
    responded_at: new Date().toISOString(),
  };
  store.registrations.push(registration);
  return registration;
}

export function demoRegisterDeclined(name?: string) {
  const store = getDemoStore();
  const event = demoActiveEvent();
  if (!event) throw new Error('Ingen aktivt event');
  if (!event.registration_open) {
    const err = new Error('Påmelding er stengt');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }

  const registration: DemoRegistration = {
    id: id(),
    event_id: event.id,
    name: (name || '').trim() || 'Anonym',
    email: null,
    phone: null,
    status: 'declined',
    bringing_beer: false,
    beer_note: null,
    message: null,
    invite_token: token(),
    participant_pin: null,
    created_at: new Date().toISOString(),
    responded_at: new Date().toISOString(),
  };
  store.registrations.push(registration);
  return registration;
}

export function demoListRegistrations() {
  const event = demoActiveEvent();
  if (!event) return { event: null, registrations: [], counts: {} };
  const registrations = getDemoStore().registrations.filter((r) => r.event_id === event.id);
  const counts = {
    accepted: registrations.filter((r) => r.status === 'accepted').length,
    invited: registrations.filter((r) => r.status === 'invited').length,
    declined: registrations.filter((r) => r.status === 'declined').length,
    waitlist: registrations.filter((r) => r.status === 'waitlist').length,
    cancelled: registrations.filter((r) => r.status === 'cancelled').length,
    total: registrations.length,
  };
  return { event, registrations, counts };
}
