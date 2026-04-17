import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConceptProgressRing from '../../components/ConceptProgressRing';
import { useAuth } from '../../contexts/AuthContext';
import { SHIFT_ORDER, SHIFT_PLAIN_LABELS, SHIFT_UI_META } from '../../lib/constants';
import { addDays, formatCalendarDate, fromDateStr, generateDateRange } from '../../lib/dates';
import { computeEntitlements } from '../../lib/entitlements.js';
import { normalizeMemberPreferences } from '../../lib/normalizers';
import { CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import {
  useAvailableDates,
  useMasterShares,
  usePreferences,
  useSubmitPreferences,
} from '../../hooks/useApiData';

function extractRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function buildMember(user, share) {
  if (!share) {
    return null;
  }

  const wholeShares = Number(share?.wholeShares) || 0;
  const fractionalShares = Number(share?.fractionalShares) || 0;

  return {
    id: share?.institutionAbbreviation || user?.institutionAbbreviation || 'PI',
    name: share?.institutionName || user?.institutionName || user?.name || 'Member',
    shares: Number((wholeShares + fractionalShares).toFixed(2)),
    status: 'ACTIVE',
    _piUserId: share?.piId || user?.id || null,
    _institutionUuid: share?.institutionId || user?.institutionId || null,
  };
}

function buildCycle(activeCycle, dateRows) {
  if (!activeCycle) {
    return {
      id: '',
      startDate: '',
      endDate: '',
      preferenceDeadline: '',
      blockedDates: [],
      blockedSlots: [],
    };
  }

  const blockedDates = [];
  const blockedSlots = [];

  dateRows.forEach((entry) => {
    if (!entry?.date) return;
    if (entry.isAvailable === false) {
      blockedDates.push(entry.date);
    } else {
      if (entry.ds1Available === false) blockedSlots.push(`${entry.date}:DS1`);
      if (entry.ds2Available === false) blockedSlots.push(`${entry.date}:DS2`);
      if (entry.nsAvailable === false) blockedSlots.push(`${entry.date}:NS`);
    }
  });

  const preferenceDeadline = activeCycle.preferenceDeadline
    ? (activeCycle.preferenceDeadline.includes('T')
      ? activeCycle.preferenceDeadline.split('T')[0]
      : activeCycle.preferenceDeadline)
    : (activeCycle.startDate ? addDays(activeCycle.startDate, -7) : '');

  return {
    id: activeCycle.name || activeCycle.id,
    startDate: activeCycle.startDate || '',
    endDate: activeCycle.endDate || '',
    preferenceDeadline,
    blockedDates: blockedDates.sort(),
    blockedSlots: blockedSlots.sort(),
  };
}

function mapServerPreferences(payload, piId) {
  const data = payload?.data || payload || {};
  const serverWhole = Array.isArray(data.preferences) ? data.preferences : [];
  const serverFractional = Array.isArray(data.fractionalPreferences) ? data.fractionalPreferences : [];

  return {
    wholeShare: serverWhole
      .filter((entry) => !piId || !entry?.piId || entry.piId === piId)
      .map((entry) => ({
        shareIndex: entry.shareIndex,
        shift: entry.shift,
        choice1Date: entry.choice1Date || '',
        choice2Date: entry.choice2Date || '',
      })),
    fractionalPreferences: serverFractional
      .filter((entry) => !piId || !entry?.piId || entry.piId === piId)
      .map((entry) => ({
        blockIndex: entry.blockIndex,
        fractionalHours: Number(entry.fractionalHours) || 0,
        choice1Date: entry.choice1Date || '',
        choice2Date: entry.choice2Date || '',
      })),
    submitted: Boolean(data.submittedAt),
    notes: '',
  };
}

function buildSubmitPayload(prefs) {
  return {
    preferences: (prefs?.wholeShare || [])
      .filter((entry) => entry.choice1Date || entry.choice2Date)
      .map((entry) => ({
        shareIndex: entry.shareIndex,
        shift: entry.shift,
        choice1Date: entry.choice1Date || null,
        choice2Date: entry.choice2Date || null,
      })),
    fractionalPreferences: (prefs?.fractionalPreferences || [])
      .filter((entry) => entry.choice1Date || entry.choice2Date)
      .map((entry) => ({
        blockIndex: entry.blockIndex,
        fractionalHours: entry.fractionalHours,
        choice1Date: entry.choice1Date || null,
        choice2Date: entry.choice2Date || null,
      })),
  };
}

function buildPreferenceWizardSteps(entitlement, myPrefs) {
  const wholeSlots = [];
  for (let shareIndex = 1; shareIndex <= entitlement.wholeShares; shareIndex += 1) {
    SHIFT_ORDER.forEach((shift) => {
      const pref = myPrefs.wholeShare.find((entry) => entry.shareIndex === shareIndex && entry.shift === shift) || {};
      wholeSlots.push({
        kind: 'whole',
        shareIndex,
        shift,
        choice1Date: pref.choice1Date || '',
        choice2Date: pref.choice2Date || '',
        label: `Share ${shareIndex} - ${SHIFT_PLAIN_LABELS[shift] || shift}`,
      });
    });
  }

  const fractionalSlots = (myPrefs.fractionalPreferences || []).map((pref, index) => ({
    kind: 'fractional',
    blockIndex: pref.blockIndex || index + 1,
    fractionalHours: pref.fractionalHours || 0,
    choice1Date: pref.choice1Date || '',
    choice2Date: pref.choice2Date || '',
    label: `Fractional Block ${pref.blockIndex || index + 1} - ${Number(pref.fractionalHours || 0).toFixed(2).replace(/\.00$/, '')}h`,
  }));

  return [...wholeSlots, ...fractionalSlots];
}

function buildWizardCalendarMonths(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) return [];
  const monthMap = new Map();
  generateDateRange(startDate, endDate).forEach((dateStr) => {
    const date = fromDateStr(dateStr);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { key, year: date.getFullYear(), month: date.getMonth() });
    }
  });
  return [...monthMap.values()];
}

const STEP_HOLD_MS = 180;
const STEP_SLIDE_MS = 340;
const STEP_ENTER_DELAY_MS = 36;
const STEP_TOAST_MS = 1350;
const SAVE_DEBOUNCE_MS = 800;

export default function PreferenceFormScreen() {
  const auth = useAuth();
  const cycleQuery = useActiveCycle();
  const sharesQuery = useMasterShares();
  const datesQuery = useAvailableDates(cycleQuery.activeCycleId);
  const prefsQuery = usePreferences(cycleQuery.activeCycleId);
  const submitPrefs = useSubmitPreferences();

  const [localPrefs, setLocalPrefs] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [pickingChoice, setPickingChoice] = useState(1);
  const [justPicked, setJustPicked] = useState('');
  const [stepToast, setStepToast] = useState('');
  const [stepMotion, setStepMotion] = useState('idle');

  const timeoutIdsRef = useRef([]);
  const pendingPrefsRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const shareRows = useMemo(() => extractRows(sharesQuery.data), [sharesQuery.data]);
  const dateRows = useMemo(() => extractRows(datesQuery.data), [datesQuery.data]);

  const member = useMemo(() => {
    const activeShare = shareRows.find((row) => row?.piId === auth.user?.id)
      || shareRows.find((row) => row?.institutionId === auth.user?.institutionId)
      || null;

    return buildMember(auth.user, activeShare);
  }, [auth.user, shareRows]);

  const cycle = useMemo(
    () => buildCycle(cycleQuery.activeCycle, dateRows),
    [cycleQuery.activeCycle, dateRows],
  );

  const serverPrefs = useMemo(
    () => mapServerPreferences(prefsQuery.data, auth.user?.id),
    [prefsQuery.data, auth.user?.id],
  );

  const normalizedServerPrefs = useMemo(
    () => (member ? normalizeMemberPreferences(member, serverPrefs) : { wholeShare: [], fractionalPreferences: [] }),
    [member, serverPrefs],
  );

  const effectivePrefs = useMemo(
    () => (member
      ? normalizeMemberPreferences(member, localPrefs || normalizedServerPrefs)
      : { wholeShare: [], fractionalPreferences: [] }),
    [localPrefs, member, normalizedServerPrefs],
  );

  const entitlement = useMemo(() => {
    if (!member) {
      return { wholeShares: 0, fractionalHours: 0 };
    }

    return computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 };
  }, [member]);

  const wizardSteps = useMemo(() => buildPreferenceWizardSteps(entitlement, effectivePrefs), [
    entitlement.wholeShares,
    entitlement.fractionalHours,
    effectivePrefs.wholeShare,
    effectivePrefs.fractionalPreferences,
  ]);

  const totalChoices = wizardSteps.length * 2;
  const madeChoices = wizardSteps.reduce(
    (count, step) => count + (step.choice1Date ? 1 : 0) + (step.choice2Date ? 1 : 0),
    0,
  );
  const activeStep = wizardSteps[currentStep] || null;
  const calendarMonths = useMemo(
    () => buildWizardCalendarMonths(cycle.startDate, cycle.endDate),
    [cycle.endDate, cycle.startDate],
  );
  const blockedDateSet = useMemo(() => new Set(cycle.blockedDates || []), [cycle.blockedDates]);
  const blockedSlotSet = useMemo(() => new Set(cycle.blockedSlots || []), [cycle.blockedSlots]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const preferenceDeadline = cycle.preferenceDeadline || (cycle.startDate ? addDays(cycle.startDate, -7) : '');
  const allComplete = wizardSteps.every((step) => step.choice1Date && step.choice2Date);

  const isLoading = Boolean(
    auth.loading
      || sharesQuery.isLoading
      || cycleQuery.isLoading
      || prefsQuery.isLoading
      || datesQuery.isLoading,
  );
  const loadError = auth.error
    || sharesQuery.error
    || cycleQuery.error
    || prefsQuery.error
    || datesQuery.error
    || null;

  const queueTimeout = (callback, delay) => {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  };

  const resolvePickingChoice = (step) => (step?.choice1Date && !step?.choice2Date ? 2 : 1);

  const flushPendingSave = useCallback(() => {
    if (!pendingPrefsRef.current || !cycleQuery.activeCycleId) return;
    submitPrefs.mutate({
      cycleId: cycleQuery.activeCycleId,
      ...buildSubmitPayload(pendingPrefsRef.current),
    });
    pendingPrefsRef.current = null;
  }, [cycleQuery.activeCycleId, submitPrefs]);

  const commitPreferences = useCallback((nextPrefs) => {
    if (!member || !cycleQuery.activeCycleId) return;
    const normalized = normalizeMemberPreferences(member, nextPrefs);
    setLocalPrefs(normalized);
    pendingPrefsRef.current = normalized;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      flushPendingSave();
    }, SAVE_DEBOUNCE_MS);
  }, [cycleQuery.activeCycleId, flushPendingSave, member]);

  useEffect(() => {
    setLocalPrefs(null);
    pendingPrefsRef.current = null;
  }, [prefsQuery.data]);

  useEffect(() => {
    if (wizardSteps.length === 0) {
      setCurrentStep(0);
      return;
    }

    const firstIncomplete = wizardSteps.findIndex((step) => !step.choice1Date || !step.choice2Date);
    const targetStep = firstIncomplete >= 0 ? firstIncomplete : Math.max(0, wizardSteps.length - 1);

    setCurrentStep((prev) => {
      if (prev >= wizardSteps.length) return targetStep;
      if (localPrefs == null && prev === 0) return targetStep;
      return prev;
    });
  }, [localPrefs, wizardSteps]);

  useEffect(() => {
    setPickingChoice(resolvePickingChoice(wizardSteps[currentStep]));
  }, [currentStep, wizardSteps]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      flushPendingSave();
    }

    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, [flushPendingSave]);

  const getMotionStyle = () => {
    if (stepMotion === 'hold-forward' || stepMotion === 'hold-back') {
      return { opacity: 1, transform: 'translateX(0) scale(1.01)' };
    }
    if (stepMotion === 'exit-left' || stepMotion === 'enter-right') {
      return { opacity: 0, transform: 'translateX(-34px)' };
    }
    if (stepMotion === 'exit-right' || stepMotion === 'enter-left') {
      return { opacity: 0, transform: 'translateX(34px)' };
    }
    return { opacity: 1, transform: 'translateX(0)' };
  };

  const animateToStep = (targetIndex, direction = 'forward', flashLabel = '') => {
    const nextStep = wizardSteps[targetIndex];
    if (!nextStep || targetIndex === currentStep || stepMotion !== 'idle') return;
    if (flashLabel) {
      setStepToast(flashLabel);
      queueTimeout(() => setStepToast(''), STEP_TOAST_MS);
    }
    setStepMotion(direction === 'forward' ? 'hold-forward' : 'hold-back');
    queueTimeout(() => {
      setStepMotion(direction === 'forward' ? 'exit-left' : 'exit-right');
    }, STEP_HOLD_MS);
    queueTimeout(() => {
      setCurrentStep(targetIndex);
      setPickingChoice(resolvePickingChoice(nextStep));
      setStepMotion(direction === 'forward' ? 'enter-left' : 'enter-right');
      queueTimeout(() => setStepMotion('idle'), STEP_ENTER_DELAY_MS);
    }, STEP_HOLD_MS + STEP_SLIDE_MS);
  };

  const upsertWholePref = (sourcePrefs, shareIndex, shift, patch) => {
    const updated = { ...sourcePrefs, wholeShare: [...(sourcePrefs.wholeShare || [])] };
    const idx = updated.wholeShare.findIndex((entry) => entry.shareIndex === shareIndex && entry.shift === shift);
    const existing = idx >= 0 ? { ...updated.wholeShare[idx] } : {
      shareIndex,
      shift,
      choice1Date: '',
      choice2Date: '',
    };
    Object.assign(existing, patch);
    if (idx >= 0) updated.wholeShare[idx] = existing;
    else updated.wholeShare.push(existing);
    return updated;
  };

  const updateFractionalPref = (sourcePrefs, blockIndex, patch) => {
    const updated = { ...sourcePrefs, fractionalPreferences: [...(sourcePrefs.fractionalPreferences || [])] };
    const idx = updated.fractionalPreferences.findIndex((entry) => entry.blockIndex === blockIndex);
    const existing = {
      ...(idx >= 0 ? updated.fractionalPreferences[idx] : { blockIndex, fractionalHours: 0, choice1Date: '', choice2Date: '' }),
      ...patch,
    };
    if (idx >= 0) updated.fractionalPreferences[idx] = existing;
    else updated.fractionalPreferences.push(existing);
    return updated;
  };

  const setStepDate = (step, choice, date) => {
    if (!step) return;
    const key = choice === 1 ? 'choice1Date' : 'choice2Date';
    if (step.kind === 'whole') {
      const updated = upsertWholePref(effectivePrefs, step.shareIndex, step.shift, { [key]: date });
      commitPreferences(updated);
      return;
    }
    const updated = updateFractionalPref(effectivePrefs, step.blockIndex, {
      fractionalHours: step.fractionalHours,
      [key]: date,
    });
    commitPreferences(updated);
  };

  const isDateBlockedForStep = (date, step) => {
    if (!step) return true;
    if (blockedDateSet.has(date)) return true;
    if (step.kind === 'whole') {
      return blockedSlotSet.has(`${date}:${step.shift}`);
    }
    return SHIFT_ORDER.every((shift) => blockedSlotSet.has(`${date}:${shift}`));
  };

  const handleDatePick = (date) => {
    if (!activeStep || stepMotion !== 'idle') return;
    if (isDateBlockedForStep(date, activeStep)) return;
    const choice = pickingChoice;
    const stepLabel = `${activeStep.label} ${choice === 1 ? '1st' : '2nd'}`;
    setStepDate(activeStep, choice, date);
    setJustPicked(stepLabel);
    queueTimeout(() => setJustPicked(''), 1200);

    if (choice === 1) {
      setPickingChoice(2);
      return;
    }

    const nextIndex = currentStep + 1;
    if (nextIndex < wizardSteps.length) {
      animateToStep(nextIndex, 'forward', `${activeStep.label} complete`);
    } else {
      setStepToast('Step complete');
      queueTimeout(() => setStepToast(''), STEP_TOAST_MS);
    }
  };

  const jumpToStep = (idx) => {
    if (idx === currentStep || stepMotion !== 'idle') return;
    animateToStep(idx, idx > currentStep ? 'forward' : 'back');
  };

  const goPrev = () => {
    if (currentStep > 0) animateToStep(currentStep - 1, 'back');
  };

  const goNext = () => {
    if (currentStep < wizardSteps.length - 1) animateToStep(currentStep + 1, 'forward');
  };

  const formatWizardDate = (dateStr) => (dateStr ? formatCalendarDate(dateStr) : 'Not selected');

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
        Loading preferences...
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-2xl border px-4 py-4 text-sm"
        style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}
      >
        Unable to load preferences. {loadError?.message || 'Please try again.'}
      </div>
    );
  }

  if (!cycleQuery.activeCycleId || !cycleQuery.activeCycle) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
        No active cycle. Check back when a new cycle is created.
      </div>
    );
  }

  if (!member) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
        No active share found for your account.
      </div>
    );
  }

  return (
    <div className="space-y-4 concept-font-body concept-anim-fade">
      <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="concept-font-display text-xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Preference Selection Sheet</h3>
            <p className="text-sm mt-1" style={{ color: CONCEPT_THEME.text }}>
              <span className="font-semibold">Cycle {cycle.id}</span>
              {' '}|{' '}
              <span className="font-semibold">Deadline {formatCalendarDate(preferenceDeadline)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>Choices completed</div>
            <ConceptProgressRing current={madeChoices} total={totalChoices} />
            {submitPrefs.isPending ? (
              <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>Saving...</div>
            ) : null}
            {submitPrefs.isError ? (
              <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.error }}>
                Save failed — {submitPrefs.error?.message || 'try again'}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex gap-1.5 flex-nowrap overflow-hidden">
          {wizardSteps.map((step, index) => {
            const isActive = index === currentStep;
            const doneCount = Number(Boolean(step.choice1Date)) + Number(Boolean(step.choice2Date));
            const isComplete = doneCount === 2;
            const isPartial = doneCount === 1;
            return (
              <button
                key={`${step.kind}-${step.shareIndex || step.blockIndex}-${step.shift || 'fractional'}`}
                type="button"
                onClick={() => jumpToStep(index)}
                className="min-w-0 flex-1 rounded-xl border px-1.5 py-2 text-center transition-all"
                style={{
                  background: isActive
                    ? CONCEPT_THEME.navy
                    : isComplete
                      ? CONCEPT_THEME.emeraldLight
                      : isPartial
                        ? CONCEPT_THEME.amberLight
                        : CONCEPT_THEME.warmWhite,
                  borderColor: isActive
                    ? CONCEPT_THEME.navy
                    : isComplete
                      ? `${CONCEPT_THEME.emerald}66`
                      : isPartial
                        ? `${CONCEPT_THEME.accentOnAccent}55`
                        : CONCEPT_THEME.border,
                  color: isActive
                    ? 'white'
                    : isComplete
                      ? CONCEPT_THEME.emerald
                      : isPartial
                        ? CONCEPT_THEME.accentOnAccent
                        : CONCEPT_THEME.text,
                }}
              >
                <div className="mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold" style={{
                  borderColor: 'currentColor',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                }}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <div className="truncate text-[11px] font-semibold uppercase tracking-wide">Step {index + 1}</div>
              </button>
            );
          })}
        </div>
      </div>

      {activeStep ? (
        <div
          className="rounded-2xl border bg-white px-5 py-4 shadow-sm transition-all"
          style={{ borderColor: CONCEPT_THEME.borderLight, ...getMotionStyle() }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>
                {activeStep.kind === 'whole' ? `Share ${activeStep.shareIndex}` : `Fractional Block ${activeStep.blockIndex}`}
              </div>
              <h4 className="mt-1 concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>
                {activeStep.label}
              </h4>
            </div>
            {activeStep.kind === 'whole' ? (
              <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: SHIFT_UI_META[activeStep.shift]?.bg || CONCEPT_THEME.sand, color: SHIFT_UI_META[activeStep.shift]?.color || CONCEPT_THEME.text }}>
                {SHIFT_UI_META[activeStep.shift]?.label || activeStep.shift} ({SHIFT_UI_META[activeStep.shift]?.sub || ''})
              </div>
            ) : (
              <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
                {Number(activeStep.fractionalHours || 0).toFixed(2).replace(/\.00$/, '')}h block
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: `${CONCEPT_THEME.sky}33`, background: `${CONCEPT_THEME.sky}08` }}>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.sky }}>1st Choice</div>
              <div className="mt-1 text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>{formatWizardDate(activeStep.choice1Date)}</div>
            </div>
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: `${CONCEPT_THEME.emerald}33`, background: `${CONCEPT_THEME.emerald}08` }}>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.emerald }}>2nd Choice</div>
              <div className="mt-1 text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>{formatWizardDate(activeStep.choice2Date)}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium" style={{ color: CONCEPT_THEME.muted }}>
              Pick your {pickingChoice === 1 ? '1st' : '2nd'} choice date
            </div>
            {justPicked ? (
              <div className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }}>
                Selected: {justPicked}
              </div>
            ) : null}
            {stepToast ? (
              <div className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}>
                {stepToast}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            {calendarMonths.map(({ key, year, month }) => {
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells = [];
              for (let i = 0; i < firstDay; i += 1) cells.push(null);
              for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

              return (
                <div key={key} className="rounded-xl p-3" style={{ background: CONCEPT_THEME.sand, minWidth: 250, flex: '1 1 250px' }}>
                  <div className="text-center concept-font-display text-base sm:text-lg font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>
                    {monthNames[month]} {year}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {dayHeaders.map((day, dayIndex) => (
                      <div key={`${key}-${day}-${dayIndex}`} className="py-1 text-center text-xs font-bold" style={{ color: CONCEPT_THEME.text }}>
                        {day}
                      </div>
                    ))}
                    {cells.map((day, idx) => {
                      if (!day) return <div key={`${key}-blank-${idx}`} />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const inRange = dateStr >= cycle.startDate && dateStr <= cycle.endDate;
                      const blocked = !inRange || isDateBlockedForStep(dateStr, activeStep);
                      const selected = activeStep.choice1Date === dateStr || activeStep.choice2Date === dateStr;

                      if (!inRange) {
                        return <div key={dateStr} className="py-2 text-center text-sm" style={{ color: CONCEPT_THEME.border }}> {day} </div>;
                      }

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={blocked}
                          onClick={() => handleDatePick(dateStr)}
                          className="relative rounded-lg py-2.5 text-sm font-semibold transition-all"
                          style={{
                            background: blocked
                              ? CONCEPT_THEME.sandDark
                              : selected
                                ? CONCEPT_THEME.navy
                                : 'white',
                            color: blocked
                              ? CONCEPT_THEME.muted
                              : selected
                                ? 'white'
                                : CONCEPT_THEME.text,
                            border: `1.5px solid ${selected ? CONCEPT_THEME.navy : blocked ? 'transparent' : CONCEPT_THEME.border}`,
                            cursor: blocked ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {day}
                          {blocked ? <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-xs">X</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentStep === 0 || stepMotion !== 'idle'}
              className="rounded-xl px-5 py-2.5 text-base font-bold disabled:cursor-not-allowed"
              style={{
                background: currentStep === 0 ? CONCEPT_THEME.sandDark : CONCEPT_THEME.sand,
                color: currentStep === 0 ? CONCEPT_THEME.muted : CONCEPT_THEME.text,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentStep >= wizardSteps.length - 1 || stepMotion !== 'idle'}
              className="rounded-xl px-5 py-2.5 text-base font-bold disabled:cursor-not-allowed"
              style={{
                background: currentStep >= wizardSteps.length - 1 ? CONCEPT_THEME.sandDark : CONCEPT_THEME.navy,
                color: currentStep >= wizardSteps.length - 1 ? CONCEPT_THEME.muted : 'white',
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {allComplete ? (
        <div className="rounded-2xl border px-5 py-4" style={{ borderColor: `${CONCEPT_THEME.emerald}33`, background: CONCEPT_THEME.emeraldLight }}>
          <div className="text-sm font-bold" style={{ color: CONCEPT_THEME.emerald }}>All preference choices completed.</div>
        </div>
      ) : null}
    </div>
  );
}
