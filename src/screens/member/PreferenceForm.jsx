import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConceptProgressRing from '../../components/ConceptProgressRing.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { SHIFT_ORDER, SHIFT_PLAIN_LABELS, SHIFT_UI_META } from '../../lib/constants.js';
import { addDays, formatCalendarDate, fromDateStr, generateDateRange, localTodayDateStr } from '../../lib/dates.js';
import { computeEntitlements } from '../../lib/entitlements.js';
import { buildMember, normalizeMemberPreferences } from '../../lib/normalizers.js';
import { CONCEPT_THEME } from '../../lib/theme.js';
import { useActiveCycle } from '../../hooks/useActiveCycle.js';
import {
  useAvailableDates,
  useMasterShares,
  usePreferences,
  useSubmitPreferences,
} from '../../hooks/useApiData.js';
import { extractRows } from '../../lib/api.js';

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

const CHOICE_SWITCH_DELAY_MS = 220;
const STEP_HOLD_MS = 180;
const STEP_SLIDE_MS = 340;
const STEP_ENTER_DELAY_MS = 36;
const STEP_TOAST_MS = 1350;

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
  const [editingSubmitted, setEditingSubmitted] = useState(false);

  const timeoutIdsRef = useRef([]);
  const choiceSwitchPendingRef = useRef(false);
  const choiceSwitchTokenRef = useRef(0);

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
  const isPreferenceDeadlinePassed = Boolean(preferenceDeadline && localTodayDateStr() > preferenceDeadline);
  const canEditPreferences = !isPreferenceDeadlinePassed;
  const shouldShowSubmittedReview = Boolean(submitPrefs.isSuccess || (normalizedServerPrefs.submitted && !editingSubmitted));

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

  const cancelChoiceSwitch = () => {
    choiceSwitchPendingRef.current = false;
    choiceSwitchTokenRef.current += 1;
  };

  const commitPreferences = useCallback((nextPrefs) => {
    if (!member) return;
    const normalized = normalizeMemberPreferences(member, nextPrefs);
    setLocalPrefs(normalized);
  }, [member]);

  useEffect(() => {
    setLocalPrefs(null);
    setEditingSubmitted(false);
    cancelChoiceSwitch();
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
    if (choiceSwitchPendingRef.current) return;
    setPickingChoice(resolvePickingChoice(wizardSteps[currentStep]));
  }, [currentStep, wizardSteps]);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

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
    cancelChoiceSwitch();
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
    if (!activeStep || stepMotion !== 'idle' || isPreferenceDeadlinePassed) return;
    if (isDateBlockedForStep(date, activeStep)) return;
    const choice = pickingChoice;
    const otherDate = choice === 1 ? activeStep.choice2Date : activeStep.choice1Date;
    if (otherDate === date) return;

    setStepDate(activeStep, choice, date);
    setJustPicked(date);
    queueTimeout(() => setJustPicked(''), 520);

    if (choice === 1) {
      choiceSwitchPendingRef.current = true;
      const choiceSwitchToken = choiceSwitchTokenRef.current + 1;
      choiceSwitchTokenRef.current = choiceSwitchToken;
      queueTimeout(() => {
        if (choiceSwitchTokenRef.current !== choiceSwitchToken) return;
        choiceSwitchPendingRef.current = false;
        setPickingChoice(2);
      }, CHOICE_SWITCH_DELAY_MS);
      return;
    }

    const nextIndex = currentStep + 1;
    if (nextIndex < wizardSteps.length) {
      animateToStep(nextIndex, 'forward', 'Step Complete');
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

  const submitPreferences = () => {
    if (!cycleQuery.activeCycleId || !allComplete || submitPrefs.isPending || isPreferenceDeadlinePassed) return;
    submitPrefs.mutate({
      cycleId: cycleQuery.activeCycleId,
      ...buildSubmitPayload(effectivePrefs),
    });
  };

  const getChoiceAccent = (choice) => (choice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.amber);
  const getChoiceAccentLight = (choice) => (choice === 1 ? CONCEPT_THEME.skyLight : CONCEPT_THEME.amberLight);
  const formatWizardDate = (dateStr) => (dateStr ? formatCalendarDate(dateStr) : 'Not selected');

  const startEditingSubmitted = () => {
    if (!canEditPreferences) return;
    setLocalPrefs(effectivePrefs);
    setEditingSubmitted(true);
    setCurrentStep(0);
    setPickingChoice(resolvePickingChoice(wizardSteps[0]));
    cancelChoiceSwitch();
    submitPrefs.reset?.();
  };

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

  if (shouldShowSubmittedReview) {
    return (
      <div className="space-y-4 concept-font-body concept-anim-fade">
        <div
          className="rounded-2xl border px-6 py-6 text-center concept-anim-scale"
          style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}40` }}
        >
          <h3 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>
            Preferences Submitted
          </h3>
          <p className="mt-2 text-sm" style={{ color: CONCEPT_THEME.text }}>
            Your {wizardSteps.length} slot preferences are saved for cycle {cycle.id}.
          </p>
          <p className="mt-2 text-sm" style={{ color: isPreferenceDeadlinePassed ? CONCEPT_THEME.error : CONCEPT_THEME.text }}>
            {isPreferenceDeadlinePassed
              ? `The preference deadline has passed (${formatCalendarDate(preferenceDeadline)}). Choices can no longer be edited.`
              : `You can edit the preferences until the deadline (${formatCalendarDate(preferenceDeadline)}).`}
          </p>
          {canEditPreferences ? (
            <button
              type="button"
              onClick={startEditingSubmitted}
              className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
              style={{ background: CONCEPT_THEME.navy, color: 'white' }}
            >
              Edit Choices
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border bg-white p-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h4 className="concept-font-display text-base font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>
            Submission Summary
          </h4>
          <div className="space-y-2 text-xs">
            {wizardSteps.map((step, index) => (
              <div
                key={`${step.kind}-${step.shareIndex || step.blockIndex}-${step.shift || 'fractional'}-summary`}
                className="rounded-lg p-2.5"
                style={{ background: CONCEPT_THEME.sand }}
              >
                <span className="font-semibold text-gray-700">
                  Step {index + 1}: {step.label}
                </span>
                <span className="block mt-0.5 text-gray-600">
                  1st: {formatWizardDate(step.choice1Date)}
                  {' '}|{' '}
                  2nd: {formatWizardDate(step.choice2Date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 concept-font-body concept-anim-fade">
      <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="concept-font-display text-xl font-bold leading-snug" style={{ color: CONCEPT_THEME.navy }}>
              Preference Selection Sheet
            </h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>Choices completed</div>
            <ConceptProgressRing current={madeChoices} total={totalChoices} />
            {submitPrefs.isPending ? (
              <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>Submitting...</div>
            ) : null}
            {submitPrefs.isSuccess ? (
              <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.emerald }}>Preferences submitted</div>
            ) : null}
            {submitPrefs.isError ? (
              <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.error }}>
                Submit failed - {submitPrefs.error?.message || 'try again'}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <div
            className="rounded-full px-4 py-2 text-base font-bold text-center"
            style={{
              background: CONCEPT_THEME.amberLight,
              color: CONCEPT_THEME.accentOnAccent,
              border: `1px solid ${CONCEPT_THEME.amber}33`,
            }}
          >
            Cycle {cycle.id} - deadline {formatCalendarDate(preferenceDeadline)}
          </div>
        </div>
      </div>

      {isPreferenceDeadlinePassed ? (
        <div className="rounded-2xl border px-5 py-4" style={{ borderColor: `${CONCEPT_THEME.error}33`, background: CONCEPT_THEME.errorLight }}>
          <div className="text-sm font-bold" style={{ color: CONCEPT_THEME.error }}>
            The preference deadline has passed. Preferences can no longer be edited or submitted.
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white px-4 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex w-full items-stretch gap-1 sm:gap-1.5">
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
                title={step.label}
                className="min-w-0 flex-1 rounded-xl px-1 py-2 text-center transition-all sm:px-1.5 sm:py-2.5"
                style={{
                  background: isActive
                    ? `${CONCEPT_THEME.navy}08`
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
                    ? CONCEPT_THEME.navy
                    : isComplete
                      ? CONCEPT_THEME.emerald
                      : isPartial
                        ? CONCEPT_THEME.accentOnAccent
                        : CONCEPT_THEME.text,
                }}
              >
                <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all sm:h-8 sm:w-8"
                    style={{
                      background: isActive
                        ? CONCEPT_THEME.navy
                        : isComplete
                          ? CONCEPT_THEME.emeraldLight
                          : isPartial
                            ? CONCEPT_THEME.amberLight
                            : CONCEPT_THEME.sand,
                      color: isActive
                        ? 'white'
                        : isComplete
                          ? CONCEPT_THEME.emerald
                          : isPartial
                            ? CONCEPT_THEME.accentOnAccent
                            : CONCEPT_THEME.muted,
                      borderColor: isActive
                        ? CONCEPT_THEME.navy
                        : isComplete
                          ? `${CONCEPT_THEME.emerald}55`
                          : isPartial
                            ? `${CONCEPT_THEME.amber}55`
                            : CONCEPT_THEME.border,
                      transform: isActive && stepToast ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {isComplete ? '✓' : index + 1}
                  </div>
                  <div className="min-w-0 w-full">
                    <div
                      className="truncate text-[11px] font-bold uppercase tracking-[0.08em] leading-tight sm:text-xs"
                      style={{ color: isActive ? CONCEPT_THEME.navy : CONCEPT_THEME.muted }}
                    >
                      Step {index + 1}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeStep ? (
        <div
          className="relative overflow-hidden rounded-2xl border bg-white concept-anim-scale"
          style={{ borderColor: CONCEPT_THEME.borderLight }}
        >
          {stepToast ? (
            <div
              className="pointer-events-none absolute right-5 top-4 z-10 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald, border: `1px solid ${CONCEPT_THEME.emerald}33` }}
            >
              {stepToast}
            </div>
          ) : null}
          <div
            className="transition-all"
            style={{
              ...getMotionStyle(),
              transition: 'transform 220ms ease, opacity 220ms ease',
              pointerEvents: stepMotion === 'idle' ? 'auto' : 'none',
            }}
          >
          <div className="px-5 py-4 border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
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
            {[
              { choice: 1, label: '1st Choice', date: activeStep.choice1Date },
              { choice: 2, label: '2nd Choice', date: activeStep.choice2Date },
            ].map((item) => {
              const isActiveChoice = pickingChoice === item.choice;
              const accent = getChoiceAccent(item.choice);
              const accentLight = getChoiceAccentLight(item.choice);
              return (
                <button
                  key={item.choice}
                  type="button"
                  aria-pressed={isActiveChoice}
                  onClick={() => setPickingChoice(item.choice)}
                  disabled={stepMotion !== 'idle' || isPreferenceDeadlinePassed}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all disabled:cursor-not-allowed"
                  style={{
                    borderColor: isActiveChoice ? accent : CONCEPT_THEME.border,
                    background: isActiveChoice ? accent : 'white',
                    color: isActiveChoice ? 'white' : CONCEPT_THEME.text,
                    boxShadow: isActiveChoice ? `0 0 0 3px ${accentLight}` : 'none',
                  }}
                >
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'currentColor' }}>
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: 'currentColor' }}>
                      {formatWizardDate(item.date)}
                    </div>
                  </div>
                  {item.date ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{
                        background: isActiveChoice ? 'rgba(255,255,255,0.18)' : CONCEPT_THEME.emeraldLight,
                        color: isActiveChoice ? 'white' : CONCEPT_THEME.emerald,
                      }}
                    >
                      Done
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          </div>

          <div className="px-5 pt-3 flex items-center justify-between gap-3 flex-wrap">
            <div
              className="text-sm font-semibold"
              style={{ color: pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.accentOnAccent }}
            >
              Pick your {pickingChoice === 1 ? '1st' : '2nd'} choice date
            </div>
            {justPicked ? (
              <div className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }}>
                Selected: {formatWizardDate(justPicked)}
              </div>
            ) : null}
          </div>

          <div className="px-4 py-4 flex flex-wrap gap-4">
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
                      const blocked = isPreferenceDeadlinePassed || !inRange || isDateBlockedForStep(dateStr, activeStep);
                      const isFirst = activeStep.choice1Date === dateStr;
                      const isSecond = activeStep.choice2Date === dateStr;
                      const usedByOtherStep = wizardSteps.some((step, stepIndex) => (
                        stepIndex !== currentStep && (step.choice1Date === dateStr || step.choice2Date === dateStr)
                      ));
                      const isPicked = justPicked === dateStr;

                      if (!inRange) {
                        return <div key={dateStr} className="py-2 text-center text-sm" style={{ color: CONCEPT_THEME.subtle }}> {day} </div>;
                      }

                      let background = CONCEPT_THEME.warmWhite;
                      let textColor = CONCEPT_THEME.text;
                      let borderColor = 'transparent';
                      if (blocked) {
                        background = CONCEPT_THEME.sandDark;
                        textColor = CONCEPT_THEME.muted;
                      } else if (isFirst) {
                        background = CONCEPT_THEME.sky;
                        textColor = 'white';
                        borderColor = CONCEPT_THEME.sky;
                      } else if (isSecond) {
                        background = CONCEPT_THEME.amber;
                        textColor = 'white';
                        borderColor = CONCEPT_THEME.amber;
                      } else if (usedByOtherStep) {
                        background = CONCEPT_THEME.warmWhite;
                        textColor = CONCEPT_THEME.muted;
                        borderColor = CONCEPT_THEME.border;
                      }

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={blocked}
                          onClick={() => handleDatePick(dateStr)}
                          className="relative rounded-lg py-2.5 text-sm font-semibold transition-all"
                          style={{
                            background,
                            color: textColor,
                            border: `1.5px solid ${borderColor}`,
                            transform: isPicked ? 'scale(1.12)' : (isFirst || isSecond) ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: isPicked ? `0 0 14px ${getChoiceAccent(pickingChoice)}88` : 'none',
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

          <div className="px-5 py-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: CONCEPT_THEME.borderLight, background: CONCEPT_THEME.sand }}>
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
            {currentStep >= wizardSteps.length - 1 ? (
              <button
                type="button"
                onClick={submitPreferences}
                disabled={!allComplete || submitPrefs.isPending || stepMotion !== 'idle' || isPreferenceDeadlinePassed}
                className="rounded-xl px-5 py-2.5 text-base font-bold disabled:cursor-not-allowed"
                style={{
                  background: !allComplete || submitPrefs.isPending || stepMotion !== 'idle' || isPreferenceDeadlinePassed
                    ? CONCEPT_THEME.sandDark
                    : CONCEPT_THEME.navy,
                  color: !allComplete || submitPrefs.isPending || stepMotion !== 'idle' || isPreferenceDeadlinePassed
                    ? CONCEPT_THEME.muted
                    : 'white',
                }}
              >
                {submitPrefs.isPending ? 'Submitting...' : 'Submit Preferences'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={stepMotion !== 'idle'}
                className="rounded-xl px-5 py-2.5 text-base font-bold disabled:cursor-not-allowed"
                style={{
                  background: stepMotion !== 'idle' ? CONCEPT_THEME.sandDark : CONCEPT_THEME.navy,
                  color: stepMotion !== 'idle' ? CONCEPT_THEME.muted : 'white',
                }}
              >
                Next
              </button>
            )}
          </div>
          </div>
        </div>
      ) : null}

      {allComplete ? (
        <div className="rounded-2xl border px-5 py-4" style={{ borderColor: `${CONCEPT_THEME.emerald}33`, background: CONCEPT_THEME.emeraldLight }}>
          <div className="text-sm font-bold" style={{ color: CONCEPT_THEME.emerald }}>
            {submitPrefs.isSuccess ? 'Preferences submitted successfully.' : 'All preference choices completed. Submit preferences when ready.'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
