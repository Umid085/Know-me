import React, { useState } from 'react';
import { Bell, Check, Copy, LogOut, Sparkles, Users } from 'lucide-react';
import { useSpace } from '../context/SpaceContext';
import { seedStarterPrompts, updateCoupleSpaceSettings } from '../services/spaceService';
import { LIMITS } from '../types/knowme';
import { NotificationPreferencesForm } from './NotificationPreferencesForm';

export function SpaceSettingsView() {
  const { user, space, signOut, showToast } = useSpace();

  const [spaceName, setSpaceName] = useState(space?.spaceName || '');
  const [partnerAName, setPartnerAName] = useState(space?.partnerAName || '');
  const [partnerBName, setPartnerBName] = useState(space?.partnerBName || '');
  const [relationshipStartDate, setRelationshipStartDate] = useState(
    space?.relationshipStartDate || ''
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seeding, setSeeding] = useState(false);

  React.useEffect(() => {
    if (!space) return;
    setSpaceName(space.spaceName);
    setPartnerAName(space.partnerAName);
    setPartnerBName(space.partnerBName);
    setRelationshipStartDate(space.relationshipStartDate);
  }, [space]);

  if (!space || !user) return null;

  const isPaired = Boolean(space.partnerBUid);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    setSaving(true);
    try {
      await updateCoupleSpaceSettings(space.id, {
        spaceName,
        partnerAName,
        partnerBName,
        relationshipStartDate,
      });
      showToast('Space settings saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update settings.');
    } finally {
      setSaving(false);
    }
  }

  function handleCopyCode() {
    if (!space) return;
    void navigator.clipboard.writeText(space.inviteCode).then(() => {
      setCopied(true);
      showToast('Invite code copied.');
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleLoadStarter() {
    if (!space || !user) return;
    setSeeding(true);
    try {
      await seedStarterPrompts(space.id, user.uid);
      showToast('Added editable starter prompts to your space.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add starter prompts.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Partner Pairing Card */}
      <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EFE9DF]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
              <Users className="w-4 h-4 text-[#2C4C3B]" />
              <span>Partner Connection</span>
            </div>
            <p className="text-xs text-[#6D645D]">
              {isPaired
                ? 'Both partner accounts are linked and syncing in real time.'
                : 'Share this single-use invite code with your partner so they can sign in and link to your space.'}
            </p>
          </div>
          <span className="text-xs font-mono text-[#2C4C3B] whitespace-nowrap">
            {isPaired ? '2 of 2 linked' : '1 of 2 linked'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg">
          <div>
            <p className="text-xs text-[#6D645D]">Space Invite Code</p>
            <p className="font-mono text-2xl font-medium tracking-widest text-[#231F1D] tabular-nums mt-0.5">
              {space.inviteCode}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-[#231F1D] bg-white border border-[#E5DDD1] hover:bg-[#F2EDE4] rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#2C4C3B]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Code' : 'Copy Invite Code'}</span>
          </button>
        </div>
      </section>

      {/* Space Details Form */}
      <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="pb-4 border-b border-[#EFE9DF]">
          <h2 className="font-serif text-2xl font-normal text-[#231F1D]">Space &amp; Partner Names</h2>
          <p className="text-xs text-[#6D645D] mt-1">
            Customize how your space title and partner labels appear across dossiers, plans, and the calendar.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#231F1D]">Space title</span>
            <input
              type="text"
              required
              maxLength={LIMITS.spaceName}
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#231F1D]">Partner A name</span>
              <input
                type="text"
                required
                maxLength={LIMITS.partnerName}
                value={partnerAName}
                onChange={(e) => setPartnerAName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#231F1D]">Partner B name</span>
              <input
                type="text"
                required
                maxLength={LIMITS.partnerName}
                value={partnerBName}
                onChange={(e) => setPartnerBName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#231F1D]">Relationship start date</span>
            <input
              type="date"
              value={relationshipStartDate}
              onChange={(e) => setRelationshipStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FAF7F2] border border-[#E5DDD1] rounded-lg focus:outline-none focus:border-[#2C4C3B]"
            />
          </label>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] disabled:opacity-60 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </section>

      {/* Notifications by Module */}
      <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-8 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
            <Bell className="w-4 h-4 text-[#2C4C3B]" />
            <span>Notifications by Module</span>
          </div>
          <p className="text-xs text-[#6D645D]">
            Control which modules alert you, how early reminders appear, and whether to mirror them
            as browser desktop alerts. Preferences are saved privately per partner.
          </p>
        </div>
        <NotificationPreferencesForm />
      </section>

      {/* Starter Prompts & Account */}
      <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#231F1D]">
            <Sparkles className="w-4 h-4 text-[#2C4C3B]" />
            <span>Need writing prompts?</span>
          </div>
          <p className="text-xs text-[#6D645D]">
            Add editable starter templates across dossiers, planner, timeline, and wins.
          </p>
        </div>
        <button
          type="button"
          disabled={seeding}
          onClick={() => void handleLoadStarter()}
          className="px-4 py-2 text-xs font-medium text-[#2C4C3B] border border-[#E5DDD1] hover:bg-[#FAF7F2] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          {seeding ? 'Adding...' : 'Add Starter Prompts'}
        </button>
      </section>

      <section className="bg-white border border-[#E5DDD1] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[#231F1D]">{user.displayName || 'Signed-in account'}</p>
          <p className="text-xs text-[#6D645D]">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-[#8C2F39] border border-[#E5DDD1] hover:bg-[#8C2F39]/10 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </section>
    </div>
  );
}
