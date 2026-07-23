'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/chrome';
import { Icon, Sparkle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useEnsureSession } from '@/lib/auth';
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

const CONSENT_VERSION = '2026-01-policy-v1';
// Optional photo likeness — separate, versioned consent + a build-time switch.
const PHOTO_CONSENT_VERSION = '2026-08-photo-v1';
const PHOTO_ENABLED = process.env.NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED === 'true';
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
const HAIRS = ['short', 'curly', 'long', 'braids', 'none'];

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
  const [hair, setHair] = useState('');
  const [glasses, setGlasses] = useState(false);
  const [goal, setGoal] = useState<Goal | ''>('');
  const [occasionPack, setOccasionPack] = useState<OccasionPackId | null>(null);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel | ''>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestDraft, setInterestDraft] = useState('');
  const [customTheme, setCustomTheme] = useState('');
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
  const [loaded, setLoaded] = useState(false);
  /** One key for this form session, so a retry replays rather than duplicates. */
  const idempotencyKey = useRef<string>('');
  if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // "Another book for the same child": prefill from an existing hero and reuse
    // its cached character sheet (book two stars the same Aarav).
    const from = new URLSearchParams(window.location.search).get('from');
    if (from) {
      void (async () => {
        try {
          const h = await api<{ heroId: string; nickname: string; ageBand: string; avatar: { skinTone?: string; hair?: string; glasses?: boolean }; interests: string[]; birthMonth: number | null }>(`/books/${from}/reuse`);
          setReuseHeroId(h.heroId);
          setNickname(h.nickname);
          setAgeBand(h.ageBand as AgeBand);
          if (h.avatar.skinTone) setSkinTone(h.avatar.skinTone);
          if (h.avatar.hair) setHair(h.avatar.hair);
          if (typeof h.avatar.glasses === 'boolean') setGlasses(h.avatar.glasses);
          if (Array.isArray(h.interests)) setInterests(h.interests);
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
        if (typeof d.hair === 'string') setHair(d.hair);
        if (typeof d.glasses === 'boolean') setGlasses(d.glasses);
        if (typeof d.goal === 'string') setGoal(d.goal as Goal);
        if (d.occasionPack) setOccasionPack(d.occasionPack as OccasionPackId);
        if (typeof d.readingLevel === 'string') setReadingLevel(d.readingLevel as ReadingLevel);
        if (Array.isArray(d.interests)) setInterests(d.interests.filter((x): x is string => typeof x === 'string'));
        if (typeof d.customTheme === 'string') setCustomTheme(d.customTheme);
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
        JSON.stringify({ nickname, ageBand, skinTone, hair, glasses, goal, occasionPack, readingLevel, interests, customTheme, step, idempotencyKey: idempotencyKey.current }),
      );
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [loaded, nickname, ageBand, skinTone, hair, glasses, goal, occasionPack, readingLevel, interests, customTheme, step]);

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

  const step1ok = nickname.trim() && ageBand && skinTone && hair;
  const step2ok = goal && readingLevel;
  // If they've attached a photo, the separate photo consent is required too.
  const canContinue = step === 1 ? step1ok : step === 2 ? step2ok : consent && (!photoFile || photoConsent);

  function pickPhoto(file: File | null) {
    setPhotoError(null);
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
    if (v && interests.length < 10 && !interests.includes(v)) setInterests([...interests, v]);
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
        if (merged.length >= 10) break;
        if (!merged.includes(interest)) merged.push(interest);
      }
      return merged;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { consentId } = await api<CreateConsentResponse>('/consent', {
        method: 'POST',
        body: { consentVersion: CONSENT_VERSION, method: 'explicit_checkbox' },
      });

      // Optional photo: record its own scoped consent, upload it (moderated
      // server-side before it's ever stored), and attach the id to the book.
      let photoUploadId: string | undefined;
      if (PHOTO_ENABLED && photoFile && photoConsent) {
        const photoConsentRes = await api<CreateConsentResponse>('/consent', {
          method: 'POST',
          body: { consentVersion: PHOTO_CONSENT_VERSION, method: 'explicit_checkbox', scope: 'photo_likeness' },
        });
        photoUploadId = await uploadPhoto(photoFile, photoConsentRes.consentId);
      }

      const { bookId } = await api<CreateBookResponse>('/books', {
        method: 'POST',
        // Stable for this form session. Minting a fresh key per attempt meant a
        // retry after a timeout looked like a brand-new book — the exact
        // double-submit the header exists to prevent.
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: {
          child: { nickname: nickname.trim(), ageBand, avatar: { skinTone, hair, glasses }, interests, birthMonth: birthMonth || null },
          goal,
          occasionPack,
          customTheme: customTheme.trim() || undefined,
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
      router.push(`/books/${bookId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  function next() {
    if (step < 3) setStep(step + 1);
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
            {accessError && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 14 }}>{accessError}</p>}
            <p className="trust" style={{ marginTop: 18 }}>
              <Icon name="shield" size={15} stroke="var(--brand)" /> Children never sign in; parents stay in control.
            </p>
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

              <label className="label" style={{ marginTop: 18 }}>Skin tone</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {SKIN_TONES.map((t) => (
                  <button key={t.id} className={`chip ${skinTone === t.id ? 'sel' : ''}`} onClick={() => setSkinTone(t.id)} style={{ padding: '7px 12px 7px 7px' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: t.c, border: '1px solid rgba(0,0,0,.08)' }} /> {t.id}
                  </button>
                ))}
              </div>

              <label className="label" style={{ marginTop: 18 }}>Hair</label>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {HAIRS.map((h) => (
                  <button key={h} className={`chip ${hair === h ? 'sel' : ''}`} onClick={() => setHair(h)}>{h}</button>
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

              <label className="label" style={{ marginTop: 18 }}>Things they love <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional, up to 10)</span></label>
              <div style={{ display: 'flex', gap: 9 }}>
                <input className="input" value={interestDraft} onChange={(e) => setInterestDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }} placeholder="dinosaurs, space…" />
                <button className="btn btn-ghost" onClick={addInterest} disabled={!interestDraft.trim() || interests.length >= 10}>Add</button>
              </div>
              {interests.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {interests.map((i) => (
                    <button key={i} className="pill" onClick={() => setInterests(interests.filter((x) => x !== i))}>{i} <Icon name="x" size={13} stroke="var(--ink-soft)" /></button>
                  ))}
                </div>
              )}

              <label className="label" style={{ marginTop: 18 }}>Your own theme <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="input"
                value={customTheme}
                maxLength={200}
                rows={3}
                onChange={(e) => setCustomTheme(e.target.value)}
                placeholder="e.g. a gentle story about moving to a new city and making one good friend"
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
              <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 5 }}>
                Anything special you’d like the story to be about — we’ll weave it in. {customTheme.length}/200
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
                  ['Looks', [skinTone, `${hair} hair`, glasses ? 'glasses' : null].filter(Boolean).join(', ')],
                  ['Pack', occasionPack ? OCCASION_PACKS.find((p) => p.id === occasionPack)?.label ?? occasionPack : '—'],
                  ['Goal', goal ? GOAL_LABELS[goal] : '—'],
                  ['Reading level', readingLevel || '—'],
                  ['Interests', interests.length ? interests.join(', ') : '—'],
                  ['Your theme', customTheme.trim() || '—'],
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

          {error && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 16 }}>{error}</p>}
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
