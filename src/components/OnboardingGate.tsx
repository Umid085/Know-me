import React, { useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, HeartHandshake, LogOut, Sparkles } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import { createCoupleSpace, joinCoupleSpace } from '../services/spaceService';
import { LIMITS } from '../types/knowme';

const WELCOME_IMAGE = '/src/assets/images/welcome_linen_journal_1795258969500.jpg';

export function OnboardingGate() {
  const { user, signInWithGoogle, signOut, showToast } = useSpace();
  const [imageFailed, setImageFailed] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [spaceName, setSpaceName] = useState('');
  const [partnerAName, setPartnerAName] = useState(user?.displayName?.split(' ')[0] || '');
  const [partnerBName, setPartnerBName] = useState('');
  const [relationshipStartDate, setRelationshipStartDate] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState(user?.displayName?.split(' ')[0] || '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleGoogleSignIn() {
    setAuthError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in right now.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setFormError('');

    const myName = partnerAName.trim() || user.displayName?.split(' ')[0] || 'Partner A';
    const otherName = partnerBName.trim() || 'My Partner';
    const finalSpaceName = spaceName.trim() || `${myName} & ${otherName}`;

    setSubmitting(true);
    try {
      const { inviteCode: generatedCode } = await createCoupleSpace({
        user,
        spaceName: finalSpaceName,
        partnerAName: myName,
        partnerBName: otherName,
        relationshipStartDate,
      });
      showToast(`Space created. Invite code: ${generatedCode}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create your space.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setFormError('');

    const cleanCode = inviteCode.trim().toUpperCase();
    if (cleanCode.length < 6) {
      setFormError('Enter the 6-character invite code shared by your partner.');
      return;
    }

    setSubmitting(true);
    try {
      await joinCoupleSpace({
        user,
        inviteCode: cleanCode,
        partnerBName: joinDisplayName.trim() || user.displayName?.split(' ')[0] || 'Partner',
      });
      showToast('Connected to your shared couple space.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not join space with that code.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#231F1D] flex flex-col">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="w-full max-w-[1200px] mx-auto px-6 sm:px-10 h-20 flex items-center justify-between gap-8 border-b border-[#E5DDD1]">
        <span className="font-serif text-xl font-semibold tracking-tight text-[#231F1D] whitespace-nowrap shrink-0">
          Know Me
        </span>

        <nav className="hidden md:flex items-center gap-7 text-sm text-[#6D645D]">
          <span className="whitespace-nowrap shrink-0">Partner Dossiers</span>
          <span className="whitespace-nowrap shrink-0">Shared Planner</span>
          <span className="whitespace-nowrap shrink-0">Notable Dates</span>
          <span className="whitespace-nowrap shrink-0">Busyness Calendar</span>
          <span className="whitespace-nowrap shrink-0">Cycle Calendar</span>
        </nav>

        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#231F1D] border border-[#E5DDD1] bg-white hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={signingIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          )}
        </div>
      </header>

      {/* Main Split Editorial Frame */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 sm:px-10 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
        {/* Left Column: Editorial Introduction or Pairing Form */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
          {!user ? (
            <>
              <div className="space-y-6">
                <p className="text-xs font-mono text-[#6D645D]">
                  Private shared almanac for two
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-[1.12] tracking-tight text-[#231F1D]">
                  Keep the details that make loving each other feel effortless.
                </h1>
                <p className="text-base text-[#6D645D] leading-relaxed max-w-xl">
                  Know Me is a quiet, cloud-synced journal for couples — bringing together partner
                  preferences, care notes, shared plans, milestone timelines, and a monthly view of
                  how busy you both are alongside everyday wins.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => void handleGoogleSignIn()}
                    disabled={signingIn}
                    className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{signingIn ? 'Connecting Google account...' : 'Continue with Google'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-[#6D645D]">
                    Synced live across both partners&apos; devices
                  </span>
                </div>

                {authError && (
                  <p className="text-sm text-[#8C2F39] bg-[#8C2F39]/10 border border-[#8C2F39]/25 rounded-lg px-4 py-3">
                    {authError}
                  </p>
                )}
              </div>

              {/* Clean editorial summary strip separated by hairlines */}
              <div className="pt-8 border-t border-[#E5DDD1] grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
                    <BookOpen className="w-4 h-4 text-[#2C4C3B]" />
                    <span>Living Dossiers</span>
                  </div>
                  <p className="text-xs text-[#6D645D] leading-relaxed">
                    Sizes, allergies, comfort habits, routines, travel notes, and gift ideas.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
                    <CalendarDays className="w-4 h-4 text-[#2C4C3B]" />
                    <span>Busyness &amp; Wins</span>
                  </div>
                  <p className="text-xs text-[#6D645D] leading-relaxed">
                    See each other&apos;s bandwidth across the month and celebrate daily accomplishments.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
                    <HeartHandshake className="w-4 h-4 text-[#7B3E52]" />
                    <span>Dates &amp; Plans</span>
                  </div>
                  <p className="text-xs text-[#6D645D] leading-relaxed">
                    Track recurring anniversaries on a timeline and coordinate date nights and goals.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-[#E5DDD1] rounded-xl p-7 sm:p-9 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-mono text-[#6D645D]">
                  Signed in as {user.email}
                </p>
                <h1 className="font-serif text-3xl font-normal text-[#231F1D]">
                  Set up your shared space
                </h1>
                <p className="text-sm text-[#6D645D] leading-relaxed">
                  Create a new private space and share its 6-character code with your partner, or join
                  a space your partner already opened.
                </p>
              </div>

              {/* Segmented mode switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F2EDE4] rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode('create');
                    setFormError('');
                  }}
                  className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'create'
                      ? 'bg-white text-[#231F1D] shadow-xs'
                      : 'text-[#6D645D] hover:text-[#231F1D]'
                  }`}
                >
                  Create Our Space
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('join');
                    setFormError('');
                  }}
                  className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'join'
                      ? 'bg-white text-[#231F1D] shadow-xs'
                      : 'text-[#6D645D] hover:text-[#231F1D]'
                  }`}
                >
                  Join With Invite Code
                </button>
              </div>

              {mode === 'create' ? (
                <form onSubmit={handleCreateSpace} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#231F1D]">Your name</span>
                      <input
                        type="text"
                        required
                        maxLength={LIMITS.partnerName}
                        value={partnerAName}
                        onChange={(e) => setPartnerAName(e.target.value)}
                        placeholder="e.g. Alex"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#231F1D]">Partner&apos;s name</span>
                      <input
                        type="text"
                        required
                        maxLength={LIMITS.partnerName}
                        value={partnerBName}
                        onChange={(e) => setPartnerBName(e.target.value)}
                        placeholder="e.g. Sam"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#231F1D]">
                      Space title <span className="text-[#6D645D] font-normal">(optional)</span>
                    </span>
                    <input
                      type="text"
                      maxLength={LIMITS.spaceName}
                      value={spaceName}
                      onChange={(e) => setSpaceName(e.target.value)}
                      placeholder={
                        partnerAName && partnerBName
                          ? `${partnerAName} & ${partnerBName}`
                          : 'e.g. Alex & Sam'
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#231F1D]">
                      Relationship start date{' '}
                      <span className="text-[#6D645D] font-normal">(optional)</span>
                    </span>
                    <input
                      type="date"
                      value={relationshipStartDate}
                      onChange={(e) => setRelationshipStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                    />
                  </label>

                  {formError && (
                    <p className="text-sm text-[#8C2F39] bg-[#8C2F39]/10 border border-[#8C2F39]/25 rounded-lg px-3.5 py-2.5">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
                  >
                    <span>{submitting ? 'Creating space...' : 'Create Shared Space'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinSpace} className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#231F1D]">6-character invite code</span>
                    <input
                      type="text"
                      required
                      maxLength={12}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="e.g. K7M4QX"
                      className="w-full px-3.5 py-2.5 text-base font-mono tracking-widest uppercase bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#231F1D]">How your name appears</span>
                    <input
                      type="text"
                      required
                      maxLength={LIMITS.partnerName}
                      value={joinDisplayName}
                      onChange={(e) => setJoinDisplayName(e.target.value)}
                      placeholder="e.g. Sam"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
                    />
                  </label>

                  {formError && (
                    <p className="text-sm text-[#8C2F39] bg-[#8C2F39]/10 border border-[#8C2F39]/25 rounded-lg px-3.5 py-2.5">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
                  >
                    <span>{submitting ? 'Joining space...' : 'Join Partner Space'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Editorial Linen Photography */}
        <div className="lg:col-span-6 flex">
          <div className="relative w-full min-h-[340px] lg:h-full rounded-xl overflow-hidden border border-[#E5DDD1] bg-[#F2EDE4]">
            {!imageFailed ? (
              <img
                src={WELCOME_IMAGE}
                alt="Open cream linen journal resting on an oak table beside two stoneware espresso cups and an olive sprig in morning light"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center bg-gradient-to-br from-[#F2EDE4] via-[#FAF7F2] to-[#EBE3D6]">
                <Sparkles className="w-8 h-8 text-[#2C4C3B] mb-3" />
                <p className="font-serif text-2xl text-[#231F1D]">Know Me</p>
                <p className="text-xs text-[#6D645D] mt-1">Shared Couples Almanac</p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1B1715]/80 via-[#1B1715]/35 to-transparent p-6 sm:p-8">
              <p className="font-serif text-lg sm:text-xl text-[#FAF7F2] leading-snug max-w-md">
                One quiet place for everything worth remembering — from coffee orders and busy weeks
                to milestones worth celebrating.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
