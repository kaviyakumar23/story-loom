'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/chrome';
import { NewsletterForm } from '@/components/landing/NewsletterForm';
import { Icon, Sparkle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useEnsureSession } from '@/lib/auth';
import { OCCASION_PACKS_ENABLED } from '@/lib/beta-flags';
import { PHOTO_LIKENESS_ENABLED as PHOTO_ENABLED } from '@/lib/photo-likeness';
import { supabase } from '@/lib/supabase';
import {
  AGE_BANDS,
  GOAL_LABELS,
  OCCASION_PACKS,
  READING_LEVELS,
  type BetaAccessResponse,
  type AgeBand,
  type CreateBookResponse,
  type CreateConsentResponse,
  type Goal,
  type OccasionPackId,
  type ReadingLevel,
} from '@/lib/types';

const CONSENT_VERSION = '2026-08-beta-v1';
// Optional photo likeness — separate, versioned consent (PHOTO_ENABLED is the
// shared flag from @/lib/photo-likeness, imported above).
const PHOTO_CONSENT_VERSION = '2026-08-photo-v1';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
// Persist the in-progress form so a refresh / accidental navigation doesn't lose
// the details a parent already entered. Local to this browser; cleared on submit.
const DRAFT_KEY = 'moonbell:create-draft:v1';
const SKIN_TONES = [
  { id: 'fair', c: '#F2D5BC' },
  { id: 'light', c: '#E3B591' },
  { id: 'medium', c: '#C68A63' },
  { id: 'tan', c: '#A2683F' },
  { id: 'deep', c: '#6F4327' },
];
// Hair is three orthogonal choices — a child's hair can be short AND curly AND
// worn in braids, which the old single list couldn't express.
const HAIR_LENGTHS = ['short', 'medium', 'long'];
const HAIR_TEXTURES = ['straight', 'wavy', 'curly', 'coily'];
const HAIR_STYLES = ['loose', 'ponytail', 'braids', 'bun', 'buzz'];
// Parent-stated; blank means the story uses they/them (never inferred).
const PERSONALITY_TRAITS = ['curious', 'brave', 'kind', 'funny', 'imaginative', 'thoughtful'];
const MAX_TRAITS = 3;
// Three interests at most: a story asked to serve ten serves none of them well.
const MAX_INTERESTS = 3;
// Pronouns are stated by the parent, never inferred. Left blank, the story uses
// they/them.
const GENDER_OPTIONS = [
  { id: 'girl', label: 'She / her' },
  { id: 'boy', label: 'He / him' },
  { id: 'neutral', label: 'They / them' },
];

function Progress({ step }: { step: number }) {
  const labels = ['About them', 'Their story', 'Review'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
      {labels.map((l, i) => {
        const n = i + 1, done = n < step, active = n === step;
        return (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < 2 ? 1 : 'none' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, background: done ? 'var(--success)' : active ? 'var(--brand)' : 'var(--bg-2)', color: done || active ? '#fff' : 'var(--ink-soft)', border: active ? 'none' : '1px solid var(--hairline)' }}>
              {done ? <Icon name="check" size={14} stroke="#fff" sw={2.4} /> : n}
            </div>
            <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--ink)' : 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{l}</span>
            {i < 2 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: n < step ? 'var(--success)' : 'var(--hairline)' }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function Create() {
  const { ready, error: sessionError } = useEnsureSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand | ''>('');
  const [skinTone, setSkinTone] = useState('');
  const [gender, setGender] = useState('');
  const [hairLength, setHairLength] = useState('');
  const [hairTexture, setHairTexture] = useState('');
  const [hairStyle, setHairStyle] = useState('');
  const [personality, setPersonality] = useState<string[]>([]);
  const [glasses, setGlasses] = useState(false);
  const [goal, setGoal] = useState<Goal | ''>('');
  const [occasionPack, setOccasionPack] = useState<OccasionPackId | null>(null);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel | ''>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestDraft, setInterestDraft] = useState('');
  const [dedication, setDedication] = useState('');
  // Transactional contact for a printed order. Captured before generation, but
  // never gated on a confirmation click — that detour loses parents mid-funnel.
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [birthMonth, setBirthMonth] = useState<number | ''>('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [reuseHeroId, setReuseHeroId] = useState<string | null>(null);
  const [access, setAccess] = useState<BetaAccessResponse | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server refused the photo specifically (rejected at moderation,
  // expired, or a character already exists) — everything else about the form is
  // fine, so we offer a one-click "continue without the photo" instead of a
  // dead-end error.
  const [photoBlocked, setPhotoBlocked] = useState<string | null>(null);
  // Email gate (abuse controls): a 2nd+ preview needs a confirmed email.
  const [needsEmail, setNeedsEmail] = useState(false);
  const [gateEmail, setGateEmail] = useState('');
  const [gateEmailSent, setGateEmailSent] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** One key for this form session, so a retry replays rather than duplicates. */
  const idempotencyKey = useRef<string>('');
  if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
  // Consents and the uploaded photo are recorded once per form session and
  // reused across retries — a network hiccup on the books POST must not insert
  // a second consent row or burn another photo-upload rate-limit slot.
  const consentIdRef = useRef<string | null>(null);
  const photoConsentIdRef = useRef<string | null>(null);
  const photoUploadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // "Another book for the same child": prefill from an existing hero and reuse
    // its cached character sheet (book two stars the same Aarav).
    const from = new URLSearchParams(window.location.search).get('from');
    if (from) {
      void (async () => {
        try {
          const h = await api<{ heroId: string; nickname: string; ageBand: string; avatar: { skinTone?: string; gender?: string; personality?: string[]; hairLength?: string; hairTexture?: string; hairStyle?: string; hair?: string; glasses?: boolean }; interests: string[]; birthMonth: number | null }>(`/books/${from}/reuse`);
          setReuseHeroId(h.heroId);
          setNickname(h.nickname);
          setAgeBand(h.ageBand as AgeBand);
          if (h.avatar.skinTone) setSkinTone(h.avatar.skinTone);
          if (h.avatar.gender) setGender(h.avatar.gender);
          if (Array.isArray(h.avatar.personality)) setPersonality(h.avatar.personality.slice(0, MAX_TRAITS));
          if (h.avatar.hairLength) setHairLength(h.avatar.hairLength);
          if (h.avatar.hairTexture) setHairTexture(h.avatar.hairTexture);
          if (h.avatar.hairStyle) setHairStyle(h.avatar.hairStyle);
          // Pre-split hero: map the old single value onto its best facet.
          if (h.avatar.hair && !h.avatar.hairLength && !h.avatar.hairTexture) {
            const legacy = h.avatar.hair;
            if (legacy === 'short' || legacy === 'long') setHairLength(legacy);
            else if (legacy === 'curly') setHairTexture('curly');
            else if (legacy === 'braids') setHairStyle('braids');
          }
          if (typeof h.avatar.glasses === 'boolean') setGlasses(h.avatar.glasses);
          if (Array.isArray(h.interests)) setInterests(h.interests.slice(0, MAX_INTERESTS));
          if (h.birthMonth) setBirthMonth(h.birthMonth);
        } catch {
          /* fall back to a normal new book */
        }
      })();
    }

    // Occasion deep-link (?pack=): preselect a curated pack, so a reminder email
    // can open a prefilled book for e.g. Diwali or a birthday.
    const packParam = new URLSearchParams(window.location.search).get('pack');
    if (packParam && OCCASION_PACKS.some((p) => p.id === packParam)) {
      applyOccasionPack(packParam as OccasionPackId);
    }

    api<BetaAccessResponse>('/beta/access', { anon: true })
      .then((status) => {
        if (!cancelled) setAccess(status);
      })
      .catch(() => {
        if (!cancelled) {
          setAccess({ enabled: true, granted: false });
          setAccessError('Could not verify beta access. Please try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // Restore any saved draft once, on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.nickname === 'string') setNickname(d.nickname);
        if (typeof d.ageBand === 'string') setAgeBand(d.ageBand as AgeBand);
        if (typeof d.skinTone === 'string') setSkinTone(d.skinTone);
        if (typeof d.gender === 'string') setGender(d.gender);
        if (Array.isArray(d.personality)) setPersonality(d.personality.slice(0, MAX_TRAITS));
        if (typeof d.hairLength === 'string') setHairLength(d.hairLength);
        if (typeof d.hairTexture === 'string') setHairTexture(d.hairTexture);
        if (typeof d.hairStyle === 'string') setHairStyle(d.hairStyle);
        if (typeof d.glasses === 'boolean') setGlasses(d.glasses);
        if (typeof d.goal === 'string') setGoal(d.goal as Goal);
        if (d.occasionPack) setOccasionPack(d.occasionPack as OccasionPackId);
        if (typeof d.readingLevel === 'string') setReadingLevel(d.readingLevel as ReadingLevel);
        if (Array.isArray(d.interests)) setInterests(d.interests.filter((x): x is string => typeof x === 'string').slice(0, MAX_INTERESTS));
        if (typeof d.dedication === 'string') setDedication(d.dedication);
        if (typeof d.email === 'string') setEmail(d.email);
        if (typeof d.step === 'number') setStep(Math.min(3, Math.max(1, d.step)));
        if (typeof d.idempotencyKey === 'string') idempotencyKey.current = d.idempotencyKey;
      }
    } catch {
      /* ignore corrupt draft */
    }
    setLoaded(true);
  }, []);

  // Save the draft whenever a persisted field changes (after the initial load).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ nickname, ageBand, skinTone, gender, personality, hairLength, hairTexture, hairStyle, glasses, goal, occasionPack, readingLevel, interests, dedication, email, step, idempotencyKey: idempotencyKey.current }),
      );
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [loaded, nickname, ageBand, skinTone, gender, personality, hairLength, hairTexture, hairStyle, glasses, goal, occasionPack, readingLevel, interests, dedication, email, step]);

  if (sessionError) {
    return (
      <div className="web" style={{ minHeight: '100vh' }}>
        <Header minimal />
        <div className="container-narrow page-pad" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '36px', maxWidth: 460, textAlign: 'center' }}>
            <h1 className="display" style={{ fontSize: 24, marginBottom: 10 }}>Let’s get you started</h1>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
              We couldn’t open a guest session just now. You can sign in and pick up right where you left off.
            </p>
            <Link href={`/signin?next=${encodeURIComponent('/create')}`} className="btn btn-primary btn-block">
              Sign in to continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || !access) {
    return (
      <div className="web" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner spinner-brand" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const step1ok = nickname.trim() && ageBand && skinTone && hairLength && hairTexture;
  const step2ok = goal && readingLevel;
  // A printed order has to be reachable, so the email is required — but only as
  // a field, never as a "go and click the link in your inbox" detour.
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  // If they've attached a photo, the separate photo consent is required too.
  const canContinue =
    step === 1 ? step1ok : step === 2 ? step2ok : consent && emailOk && (!photoFile || photoConsent);

  function pickPhoto(file: File | null) {
    setPhotoError(null);
    // A different (or no) photo invalidates the cached upload, never the consent.
    photoUploadIdRef.current = null;
    if (!file) {
      setPhotoFile(null);
      setPhotoUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
      setPhotoConsent(false);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError('Please choose an image under 8 MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPhotoError('Please choose a JPEG, PNG, or WebP image.'); return; }
    setPhotoFile(file);
    setPhotoUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(file); });
  }

  async function uploadPhoto(file: File, consentId: string): Promise<string> {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('consentId', consentId);
    const res = await fetch('/api/v1/heroes/photo', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: fd });
    const json = (await res.json().catch(() => ({}))) as { photoUploadId?: string; error?: { code?: string; message?: string } };
    if (!res.ok) throw new ApiError(res.status, json.error?.code ?? 'error', json.error?.message ?? 'Could not upload the photo.');
    return json.photoUploadId as string;
  }

  async function unlockBetaAccess(e: React.FormEvent) {
    e.preventDefault();
    setAccessBusy(true);
    setAccessError(null);
    try {
      const status = await api<BetaAccessResponse>('/beta/access', {
        anon: true,
        method: 'POST',
        body: { code: inviteCode.trim() },
      });
      setAccess(status);
      setInviteCode('');
    } catch (err) {
      setAccessError(err instanceof ApiError ? err.message : 'Could not unlock beta access.');
    } finally {
      setAccessBusy(false);
    }
  }

  function addInterest() {
    const v = interestDraft.trim();
    if (v && interests.length < MAX_INTERESTS && !interests.includes(v)) setInterests([...interests, v]);
    setInterestDraft('');
  }

  function applyOccasionPack(id: OccasionPackId) {
    const pack = OCCASION_PACKS.find((p) => p.id === id);
    if (!pack) return;
    setOccasionPack(pack.id);
    setGoal(pack.goal);
    if (pack.readingLevel) setReadingLevel(pack.readingLevel);
    setInterests((current) => {
      const merged = [...current];
      for (const interest of pack.interests) {
        if (merged.length >= MAX_INTERESTS) break;
        if (!merged.includes(interest)) merged.push(interest);
      }
      return merged;
    });
  }

  async function submit(opts?: { withoutPhoto?: boolean }) {
    setSubmitting(true);
    setError(null);
    setPhotoBlocked(null);
    track('preview_start');
    try {
      // Attach the email to the (anonymous) account first, so we can reach a
      // parent about their order even if they never come back to this tab.
      // Deliberately not awaited for confirmation: Supabase sends a verify link,
      // and blocking generation on that click would cost us the preview.
      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        const { data } = await supabase().auth.getUser();
        if (data.user && data.user.email !== trimmedEmail) {
          await supabase().auth.updateUser({ email: trimmedEmail }).catch(() => undefined);
        }
      }

      if (trimmedEmail) track('email_captured');
      if (!consentIdRef.current) {
        const { consentId } = await api<CreateConsentResponse>('/consent', {
          method: 'POST',
          body: { consentVersion: CONSENT_VERSION, method: 'explicit_checkbox' },
        });
        consentIdRef.current = consentId;
        track('consent_given');
      }
      const consentId = consentIdRef.current;

      // Optional photo: record its own scoped consent, upload it (moderated
      // server-side before it's ever stored), and attach the id to the book.
      // `withoutPhoto` is the one-click fallback after a photo-specific refusal —
      // it must ignore the (stale-in-this-closure) photo state.
      let photoUploadId: string | undefined;
      if (PHOTO_ENABLED && photoFile && photoConsent && !opts?.withoutPhoto) {
        if (!photoConsentIdRef.current) {
          const photoConsentRes = await api<CreateConsentResponse>('/consent', {
            method: 'POST',
            body: { consentVersion: PHOTO_CONSENT_VERSION, method: 'explicit_checkbox', scope: 'photo_likeness' },
          });
          photoConsentIdRef.current = photoConsentRes.consentId;
        }
        if (!photoUploadIdRef.current) {
          photoUploadIdRef.current = await uploadPhoto(photoFile, photoConsentIdRef.current);
        }
        photoUploadId = photoUploadIdRef.current;
      }

      const { bookId } = await api<CreateBookResponse>('/books', {
        method: 'POST',
        // Stable for this form session. Minting a fresh key per attempt meant a
        // retry after a timeout looked like a brand-new book — the exact
        // double-submit the header exists to prevent.
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: {
          child: {
            nickname: nickname.trim(),
            ageBand,
            ...(gender ? { gender } : {}),
            ...(personality.length ? { personality } : {}),
            avatar: { skinTone, hairLength, hairTexture, ...(hairStyle ? { hairStyle } : {}), glasses },
            interests,
            birthMonth: birthMonth || null,
          },
          goal,
          occasionPack,
          dedication: dedication.trim() || undefined,
          language: 'en',
          readingLevel,
          consentId,
          marketingConsent,
          heroId: reuseHeroId ?? undefined,
          photoUploadId,
        },
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* non-fatal */
      }
      track('preview_complete');
      router.push(`/books/${bookId}`);
    } catch (e) {
      if (e instanceof ApiError) track('intake_error', { reason: e.code.slice(0, 40) });
      if (e instanceof ApiError && e.code === 'email_required') {
        // Email gate: show the add-your-email step instead of a bare error.
        setNeedsEmail(true);
        setError(null);
        setSubmitting(false);
        return;
      }
      if (e instanceof ApiError && ['photo_rejected', 'photo_unusable', 'likeness_exists'].includes(e.code)) {
        // Only the photo was refused — everything else the parent typed is fine.
        // Offer the attribute-only path instead of a dead end.
        if (e.code === 'photo_unusable') photoUploadIdRef.current = null; // expired/consumed: a retry must re-upload
        setPhotoBlocked(e.code);
        setError(e.message);
        setSubmitting(false);
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  // Email gate: attach + confirm an email on the anonymous account, then retry.
  async function sendGateEmail() {
    const email = gateEmail.trim();
    if (!email) return;
    setGateBusy(true);
    setError(null);
    try {
      const { error: upErr } = await supabase().auth.updateUser({ email });
      if (upErr) throw upErr;
      setGateEmailSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the confirmation email.');
    } finally {
      setGateBusy(false);
    }
  }

  function next() {
    if (step < 3) { track('intake_step', { step: step + 1 }); setStep(step + 1); }
    else void submit();
  }
  function back() {
    if (step > 1) setStep(step - 1);
    else router.push('/');
  }

  if (access.enabled && !access.granted) {
    return (
      <div className="web" style={{ minHeight: '100vh' }}>
        <Header minimal />
        <div className="container-narrow page-pad" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '40px 36px', maxWidth: 460, width: '100%' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--brand-tint)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
              <Icon name="lock" size={27} stroke="var(--brand)" />
            </div>
            <span className="eyebrow" style={{ color: 'var(--brand)', marginBottom: 8 }}>Private beta</span>
            <h1 className="display" style={{ fontSize: 30, marginBottom: 8 }}>Enter your invite code</h1>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 22 }}>
              Preview generation is open to invited families while we tune story quality and capacity.
            </p>
            <form onSubmit={unlockBetaAccess}>
              <label className="label" htmlFor="invite-code">Invite code</label>
              <input
                id="invite-code"
                className="input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                placeholder="Your beta code"
              />
              <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={accessBusy || !inviteCode.trim()}>
                {accessBusy ? <span className="spinner" /> : <><Icon name="check" size={18} stroke="var(--accent-ink)" /> Unlock preview builder</>}
              </button>
            </form>
            {accessError && <p style={{ color: '#C2410C', fontSize: 13.5, marginTop: 14 }}>{accessError}</p>}
            <p className="trust" style={{ marginTop: 18 }}>
              <Icon name="shield" size={15} stroke="var(--brand)" /> Children never sign in; parents stay in control.
            </p>

            <div style={{ borderTop: '1px solid var(--hairline)', margin: '22px 0 0', paddingTop: 20 }}>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>No code yet?</p>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
                Leave your email and we’ll send you an invite as soon as a spot opens.
              </p>
              <NewsletterForm source="beta-wall" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="web" style={{ minHeight: '100vh' }}>
      <Header minimal />
      <div className="container-narrow page-pad" style={{ maxWidth: 600 }}>
        {reuseHeroId && (
          <div className="card" style={{ padding: '14px 18px', marginBottom: 16, background: 'var(--brand-tint)', border: '1px solid var(--hairline)', fontSize: 13.5, lineHeight: 1.5 }}>
            <strong>✦ Same hero, new adventure.</strong> {nickname || 'Your child'}’s look stays exactly the same — just pick a new story below.
          </div>
        )}
        <Progress step={step} />
        <div className="card" style={{ padding: '36px 40px' }}>
          {step === 1 && (
            <div style={{ animation: 'fadeUp .3s ease both' }}>
              <h2 className="display" style={{ fontSize: 25, marginBottom: 6 }}>Tell us about your hero</h2>
              <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 22 }}>{PHOTO_ENABLED ? 'A nickname is perfect — no legal names needed.' : 'A nickname is perfect — no photos, no legal names.'}</p>

              <label className="label">Their nickname</label>
              <input className="input" value={nickname} maxLength={40} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Mia" />

              <label className="label" style={{ marginTop: 18 }}>Age</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {AGE_BANDS.map((a) => (
                  <button key={a} className={`chip ${ageBand === a ? 'sel' : ''}`} onClick={() => setAgeBand(a)}>{a}</button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>
                Gender <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {GENDER_OPTIONS.map((g) => (
                  <button key={g.id} className={`chip ${gender === g.id ? 'sel' : ''}`} onClick={() => setGender(gender === g.id ? '' : g.id)}>{g.label}</button>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 7, lineHeight: 1.5 }}>
                Sets the pronouns in the story. Leave it blank and we&apos;ll write with they/them.
              </p>

              <label className="label" style={{ marginTop: 18 }}>
                Personality <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(pick up to {MAX_TRAITS})</span>
              </label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {PERSONALITY_TRAITS.map((t) => {
                  const on = personality.includes(t);
                  const full = personality.length >= MAX_TRAITS && !on;
                  return (
                    <button
                      key={t}
                      className={`chip ${on ? 'sel' : ''}`}
                      disabled={full}
                      style={full ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                      onClick={() => setPersonality(on ? personality.filter((x) => x !== t) : [...personality, t])}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 7, lineHeight: 1.5 }}>
                We show these traits through what they do in the story, never by labelling them.
              </p>

              <label className="label" style={{ marginTop: 18 }}>Skin tone</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {SKIN_TONES.map((t) => (
                  <button key={t.id} className={`chip ${skinTone === t.id ? 'sel' : ''}`} onClick={() => setSkinTone(t.id)} style={{ padding: '7px 12px 7px 7px' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: t.c, border: '1px solid rgba(0,0,0,.08)' }} /> {t.id}
                  </button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>Hair length</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {HAIR_LENGTHS.map((h) => (
                  <button key={h} className={`chip ${hairLength === h ? 'sel' : ''}`} onClick={() => setHairLength(h)}>{h}</button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>Hair texture</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {HAIR_TEXTURES.map((h) => (
                  <button key={h} className={`chip ${hairTexture === h ? 'sel' : ''}`} onClick={() => setHairTexture(h)}>{h}</button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>
                How do they wear it? <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {HAIR_STYLES.map((h) => (
                  <button key={h} className={`chip ${hairStyle === h ? 'sel' : ''}`} onClick={() => setHairStyle(hairStyle === h ? '' : h)}>{h}</button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>Glasses?</label>
              <div style={{ display: 'flex', gap: 9 }}>
                <button className={`chip ${glasses ? 'sel' : ''}`} onClick={() => setGlasses(true)}>Yes</button>
                <button className={`chip ${!glasses ? 'sel' : ''}`} onClick={() => setGlasses(false)}>No</button>
              </div>

              {PHOTO_ENABLED && (
                <div style={{ marginTop: 18 }}>
                  <label className="label">Add a photo <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span></label>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8, lineHeight: 1.5 }}>
                    Used <strong>once</strong> to shape the illustrated character, then deleted — never printed, never shared. You can skip this and just use the options above.
                  </p>
                  {photoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="Selected preview" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--hairline)' }} />
                      <button className="btn btn-ghost btn-sm" onClick={() => pickPhoto(null)}>Remove photo</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} aria-label="Add a photo" />
                  )}
                  {photoError && <p style={{ color: 'var(--error)', fontSize: 12.5, marginTop: 6 }}>{photoError}</p>}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ animation: 'fadeUp .3s ease both' }}>
              <h2 className="display" style={{ fontSize: 25, marginBottom: 6 }}>Shape their story</h2>
              <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 22 }}>The goal and interests guide the whole adventure.</p>

              {OCCASION_PACKS_ENABLED && (<>
              <label className="label">Quick occasion packs</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
                {OCCASION_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    className={`chip ${occasionPack === pack.id ? 'sel' : ''}`}
                    onClick={() => applyOccasionPack(pack.id)}
                    style={{ borderRadius: 'var(--r)', justifyContent: 'flex-start', alignItems: 'flex-start', padding: '12px 13px', whiteSpace: 'normal', textAlign: 'left' }}
                    title={pack.note}
                  >
                    <Sparkle size={15} color={occasionPack === pack.id ? 'var(--brand)' : 'var(--gold)'} style={{ flex: 'none', marginTop: 2 }} />
                    <span>
                      <span style={{ display: 'block', fontWeight: 700 }}>{pack.label}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{pack.note}</span>
                    </span>
                  </button>
                ))}
              </div>
              </>)}

              <label className="label">Story goal</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <button key={g} className={`chip ${goal === g ? 'sel' : ''}`} onClick={() => { setGoal(g); setOccasionPack(null); }}>{GOAL_LABELS[g]}</button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>Reading level</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {READING_LEVELS.map((r) => (
                  <button key={r.id} className={`chip ${readingLevel === r.id ? 'sel' : ''}`} onClick={() => setReadingLevel(r.id)} title={r.note}>{r.label}</button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>Things they love <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional, up to {MAX_INTERESTS})</span></label>
              <div style={{ display: 'flex', gap: 9 }}>
                <input className="input" value={interestDraft} onChange={(e) => setInterestDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }} placeholder="dinosaurs, space…" />
                <button className="btn btn-ghost" onClick={addInterest} disabled={!interestDraft.trim() || interests.length >= MAX_INTERESTS}>Add</button>
              </div>
              {interests.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {interests.map((i) => (
                    <button key={i} className="pill" onClick={() => setInterests(interests.filter((x) => x !== i))}>{i} <Icon name="x" size={13} stroke="var(--ink-soft)" /></button>
                  ))}
                </div>
              )}
              <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
                A few favourites work better than a long list — they get woven into the adventure.
              </span>

            </div>
          )}

          {step === 3 && (
            <div style={{ animation: 'fadeUp .3s ease both' }}>
              <h2 className="display" style={{ fontSize: 25, marginBottom: 6 }}>Quick check</h2>
              <div style={{ background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 14, padding: '13px 15px', display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0 18px' }}>
                <Icon name="sun" size={20} stroke="var(--accent-ink)" />
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>Double-check the spelling of <u>{nickname || 'the name'}</u> — it’s printed on every page.</span>
              </div>
              <div className="card" style={{ padding: '4px 16px 8px' }}>
                {[
                  ['Nickname', nickname || '—'],
                  ['Age', ageBand || '—'],
                  ['Personality', personality.length ? personality.join(', ') : '—'],
                  ['Looks', [skinTone, [hairLength, hairTexture].filter(Boolean).join(' ') + ' hair', hairStyle || null, glasses ? 'glasses' : null].filter(Boolean).join(', ')],
                  ...(OCCASION_PACKS_ENABLED
                    ? [['Pack', occasionPack ? OCCASION_PACKS.find((p) => p.id === occasionPack)?.label ?? occasionPack : '—']]
                    : []),
                  ['Goal', goal ? GOAL_LABELS[goal] : '—'],
                  ['Reading level', readingLevel || '—'],
                  ['Interests', interests.length ? interests.join(', ') : '—'],
                  ['Dedication', dedication.trim() || '—'],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline)' }}>
                    <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{k}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--brand)' }} />
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>
                  I’m {nickname || 'this child'}’s parent or guardian and I consent to MoonBell creating a
                  personalized book using these details. I understand the story and illustrations are
                  AI-generated{PHOTO_ENABLED ? '' : ', that no photos are collected'}, and that I can delete everything anytime. I agree
                  to the{' '}
                  <Link href="/legal/terms" target="_blank" style={{ color: 'var(--brand)', fontWeight: 600 }}>Terms</Link>{' '}
                  and{' '}
                  <Link href="/legal/privacy" target="_blank" style={{ color: 'var(--brand)', fontWeight: 600 }}>Privacy Policy</Link>.
                </span>
              </label>

              {PHOTO_ENABLED && photoFile && (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--brand)' }} />
                  <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>
                    I consent to MoonBell using the photo I added <strong>once</strong> to create an illustrated character. The photo is deleted right after (within 24 hours at most), is never printed or shared, and I can withdraw this anytime.
                  </span>
                </label>
              )}

              <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                <label style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                  <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Where should we send your preview?</span>
                  <input
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Your email"
                  />
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 5 }}>
                    Yours, not your child’s — it’s how we send the preview and, if you order, your delivery updates.
                  </span>
                </label>
                <label style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                  <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                    Dedication <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span>
                  </span>
                  <input
                    className="input"
                    value={dedication}
                    maxLength={120}
                    onChange={(e) => setDedication(e.target.value)}
                    placeholder="For Mia, who is braver than she knows."
                    aria-label="Dedication"
                  />
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 5 }}>
                    Printed on its own page at the front of the book. {dedication.length}/120
                  </span>
                </label>
                <label style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                  <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                    {nickname || 'Their'}’s birthday month <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span>
                  </span>
                  <select className="input" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Prefer not to say</option>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 5 }}>The month only — never a full birthdate — for a little nudge near their big day.</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--brand)' }} />
                  <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>Email me occasional MoonBell updates, new story themes and offers. Optional — unsubscribe anytime.</span>
                </label>
              </div>

              <div style={{ marginTop: 18, padding: '16px 0 0', borderTop: '2px solid var(--hairline)', display: 'grid', gap: 11 }}>
                {[
                  PHOTO_ENABLED
                    ? ['Photos optional', 'If you add one, it’s used once to shape the character, then deleted — never printed or shared.']
                    : ['No photos', 'Only attributes and a nickname are used to make the character.'],
                  ['One free tweak', 'After the preview, you can ask for one small adjustment before checkout opens.'],
                  ['You stay in control', 'You can export or delete account data from the account page.'],
                ].map(([title, text]) => (
                  <p key={title} className="trust" style={{ alignItems: 'flex-start' }}>
                    <Icon name="shield" size={15} stroke="var(--brand)" style={{ flex: 'none', marginTop: 1 }} />
                    <span><strong style={{ color: 'var(--ink)' }}>{title}.</strong> {text}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {needsEmail && (
            <div className="card" style={{ padding: '18px 20px', marginTop: 16, background: 'var(--brand-tint)', border: '1px solid var(--hairline)' }}>
              <p style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>One quick step for your next book</p>
              {gateEmailSent ? (
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                  Check your inbox and tap the confirmation link — then come back here and press{' '}
                  <strong style={{ color: 'var(--ink)' }}>See my free preview</strong> again.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
                    Your first preview was free with no sign-up. To make another, add and confirm your email —
                    it keeps your stories safe and stops misuse of the free preview.
                  </p>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <input
                      className="input"
                      type="email"
                      value={gateEmail}
                      onChange={(e) => setGateEmail(e.target.value)}
                      placeholder="you@example.com"
                      aria-label="Your email"
                    />
                    <button className="btn btn-brand" onClick={() => void sendGateEmail()} disabled={gateBusy || !gateEmail.trim()}>
                      {gateBusy ? <span className="spinner" /> : 'Confirm email'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {error && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 16 }}>{error}</p>}
          {photoBlocked && (
            <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost"
                disabled={submitting}
                onClick={() => { pickPhoto(null); void submit({ withoutPhoto: true }); }}
              >
                Continue without the photo
              </button>
              {photoBlocked === 'likeness_exists' && (
                <Link href="/account" style={{ fontSize: 13.5, color: 'var(--brand)', fontWeight: 600 }}>
                  Manage the illustrated character
                </Link>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
          <button className="btn btn-ghost" onClick={back} disabled={submitting}>
            <Icon name="arrowL" size={18} stroke="var(--brand)" /> Back
          </button>
          <button className="btn btn-primary btn-block" disabled={!canContinue || submitting} onClick={next}>
            {submitting ? <span className="spinner" /> : step === 3 ? <><Sparkle size={17} color="var(--accent-ink)" /> See my free preview</> : <>Continue <Icon name="arrow" size={18} stroke="var(--accent-ink)" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
