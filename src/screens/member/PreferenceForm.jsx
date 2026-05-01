import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConceptProgressRing from '../../components/ConceptProgressRing.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { SHIFT_ORDER, SHIFT_PLAIN_LABELS, SHIFT_UI_META, WHOLE_SLOT_LABELS } from '../../lib/constants.js';
import { addDays, formatCalendarDate, fromDateStr, generateDateRange, localTodayDateStr } from '../../lib/dates.js';
import { computeEntitlements } from '../../lib/entitlements.js';
import { buildMember, normalizeMemberPreferences } from '../../lib/normalizers.js';
import { CONCEPT_THEME } from '../../lib/theme.js';
import { getActiveWholeSlotKeysForShare } from '../../lib/whole-share.js';
import { useActiveCycle } from '../../hooks/useActiveCycle.js';
import {
  useAvailableDates,
  useMasterShares,
  usePreferences,
  useSubmitPreferences,
} from '../../hooks/useApiData.js';
import { extractRows } from '../../lib/api.js';

function shiftToSlotKey(shift) {
  if (shift === 'NS') return 'NS';
  if (shift === 'DS2') return 'DAY2';
  return 'DAY1';
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
        slotKey: shiftToSlotKey(entry.shift),
        shiftType: entry.shift || '',
        firstChoiceDate: entry.choice1Date || '',
        secondChoiceDate: entry.choice2Date || '',
      })),
    fractional: serverFractional
      .filter((entry) => !piId || !entry?.piId || entry.piId === piId)
      .map((entry) => ({
        blockIndex: entry.blockIndex,
        fractionalHours: Number(entry.fractionalHours) || 0,
        shiftType: entry.shiftType || '',
        firstChoiceDate: entry.choice1Date || '',
        secondChoiceDate: entry.choice2Date || '',
      })),
    submitted: Boolean(data.submittedAt),
    notes: '',
  };
}

function buildSubmitPayload(prefs) {
  return {
    preferences: (prefs?.wholeShare || [])
      .filter((entry) => entry.shiftType && (entry.firstChoiceDate || entry.secondChoiceDate))
      .map((entry) => ({
        shareIndex: entry.shareIndex,
        shift: entry.shiftType,
        choice1Date: entry.firstChoiceDate || null,
        choice2Date: entry.secondChoiceDate || null,
      })),
    fractionalPreferences: (prefs?.fractional || [])
      .filter((entry) => entry.firstChoiceDate || entry.secondChoiceDate)
      .map((entry) => ({
        blockIndex: entry.blockIndex,
        fractionalHours: entry.fractionalHours,
        choice1Date: entry.firstChoiceDate || null,
        choice2Date: entry.secondChoiceDate || null,
      })),
  };
}

function hasShiftSelected(step) {
  if (!step) return false;
  if (step.kind === 'fractional') return true;
  return step.slotKey === 'NS' || Boolean(step.shiftType);
}

function getShiftSelectorLabel(shiftType) {
  const meta = SHIFT_UI_META[shiftType];
  if (!meta) return shiftType;
  return `${meta.label} Shift (${meta.sub.replace(/\s+/g, '')})`;
}

function buildPreferenceWizardSteps(entitlement, myPrefs) {
  const wholeSlots = [];
  for (let shareIndex = 1; shareIndex <= entitlement.wholeShares; shareIndex += 1) {
    getActiveWholeSlotKeysForShare(myPrefs.wholeShare, shareIndex).forEach((slotKey) => {
      const pref = myPrefs.wholeShare.find(
        (entry) => entry.shareIndex === shareIndex && entry.slotKey === slotKey,
      ) || {};
      const shiftType = slotKey === 'NS' ? 'NS' : (typeof pref.shiftType === 'string' ? pref.shiftType : '');
      wholeSlots.push({
        kind: 'whole',
        shareIndex,
        slotKey,
        shiftType,
        firstChoiceDate: pref.firstChoiceDate || '',
        secondChoiceDate: pref.secondChoiceDate || '',
        label: `Share ${shareIndex} - ${WHOLE_SLOT_LABELS[slotKey] || slotKey}`,
      });
    });
  }

  const fractionalSlots = (myPrefs.fractional || []).map((pref, idx) => ({
    kind: 'fractional',
    blockIndex: pref.blockIndex || idx + 1,
    fractionalHours: pref.fractionalHours || 0,
    shiftType: typeof pref.shiftType === 'string' ? pref.shiftType : '',
    firstChoiceDate: pref.firstChoiceDate || '',
    secondChoiceDate: pref.secondChoiceDate || '',
    label: `Fractional Block ${pref.blockIndex || idx + 1} - ${SHIFT_PLAIN_LABELS[pref.shiftType] || 'Choose Session'}`,
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
    () => (member ? normalizeMemberPreferences(member, serverPrefs) : { wholeShare: [], fractional: [] }),
    [member, serverPrefs],
  );

  const effectivePrefs = useMemo(
    () => (member
      ? normalizeMemberPreferences(member, localPrefs || normalizedServerPrefs)
      : { wholeShare: [], fractional: [] }),
    [localPrefs, member, normalizedServerPrefs],
  );

  const entitlement = useMemo(() => {
    if (!member) return { wholeShares: 0, fractionalHours: 0 };
    return computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 };
  }, [member]);

  const wizardSteps = useMemo(() => buildPreferenceWizardSteps(entitlement, effectivePrefs), [
    entitlement.wholeShares,
    entitlement.fractionalHours,
    effectivePrefs.wholeShare,
    effectivePrefs.fractional,
  ]);

  const totalChoices = wizardSteps.length * 2;
  const madeChoices = wizardSteps.reduce(
    (count, step) => count + (step.firstChoiceDate ? 1 : 0) + (step.secondChoiceDate ? 1 : 0),
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
  const allComplete = wizardSteps.every((step) => hasShiftSelected(step) && step.firstChoiceDate && step.secondChoiceDate);
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

  const resolvePickingChoice = (step) => (step?.firstChoiceDate && !step?.secondChoiceDate ? 2 : 1);

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
    const firstIncomplete = wizardSteps.findIndex(
      (step) => !hasShiftSelected(step) || !step.firstChoiceDate || !step.secondChoiceDate,
    );
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

  const upsertWholePref = (sourcePrefs, shareIndex, slotKey, patch) => {
    const updated = { ...sourcePrefs, wholeShare: [...(sourcePrefs.wholeShare || [])] };
    const idx = updated.wholeShare.findIndex(
      (entry) => entry.shareIndex === shareIndex && entry.slotKey === slotKey,
    );
    const existing = idx >= 0 ? { ...updated.wholeShare[idx] } : {
      shareIndex,
      slotKey,
      shiftType: slotKey === 'NS' ? 'NS' : '',
      firstChoiceDate: '',
      secondChoiceDate: '',
    };
    Object.assign(existing, patch);
    if (existing.slotKey === 'NS') existing.shiftType = 'NS';
    if (idx >= 0) updated.wholeShare[idx] = existing;
    else updated.wholeShare.push(existing);
    return updated;
  };

  const updateFractionalPref = (sourcePrefs, blockIndex, patch) => {
    const updated = { ...sourcePrefs, fractional: [...(sourcePrefs.fractional || [])] };
    const idx = updated.fractional.findIndex((entry) => entry.blockIndex === blockIndex);
    const existing = {
      ...(idx >= 0 ? updated.fractional[idx] : {
        blockIndex,
        fractionalHours: 0,
        shiftType: '',
        firstChoiceDate: '',
        secondChoiceDate: '',
      }),
      ...patch,
    };
    if (idx >= 0) updated.fractional[idx] = existing;
    else updated.fractional.push(existing);
    return updated;
  };

  const setStepShiftType = (step, shiftType) => {
    if (!step || shiftType === step.shiftType) return;
    if (step.kind === 'whole') {
      if (step.slotKey === 'NS') return;
      let updated = upsertWholePref(effectivePrefs, step.shareIndex, step.slotKey, {
        shiftType,
        firstChoiceDate: '',
        secondChoiceDate: '',
      });
      if (step.slotKey === 'DAY1' && (shiftType === 'NS' || step.shiftType === 'NS')) {
        updated = upsertWholePref(updated, step.shareIndex, 'DAY2', {
          shiftType: '',
          firstChoiceDate: '',
          secondChoiceDate: '',
        });
      }
      commitPreferences(updated);
      return;
    }
    const updated = updateFractionalPref(effectivePrefs, step.blockIndex, {
      shiftType,
      firstChoiceDate: '',
      secondChoiceDate: '',
    });
    commitPreferences(updated);
  };

  const setStepDate = (step, choice, date) => {
    if (!step) return;
    const key = choice === 1 ? 'firstChoiceDate' : 'secondChoiceDate';
    if (step.kind === 'whole') {
      const updated = upsertWholePref(effectivePrefs, step.shareIndex, step.slotKey, { [key]: date });
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
      if (!step.shiftType) return false;
      return blockedSlotSet.has(`${date}:${step.shiftType}`);
    }
    if (!step.shiftType) return SHIFT_ORDER.every((shift) => blockedSlotSet.has(`${date}:${shift}`));
    return blockedSlotSet.has(`${date}:${step.shiftType}`);
  };

  const handleDatePick = (date) => {
    if (!activeStep || stepMotion !== 'idle' || isPreferenceDeadlinePassed) return;
    if (!hasShiftSelected(activeStep)) return;
    if (isDateBlockedForStep(date, activeStep)) return;
    const choice = pickingChoice;
    const otherDate = choice === 1 ? activeStep.secondChoiceDate : activeStep.firstChoiceDate;
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
    if (stepMotion !== 'idle') return;
    if (idx === currentStep) {
      setPickingChoice(resolvePickingChoice(wizardSteps[currentStep]));
      return;
    }
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

  const isNightChoiceStep = activeStep?.slotKey === 'DAY1' && activeStep?.shiftType === 'NS';
  const stepIsComplete = activeStep && hasShiftSelected(activeStep) && activeStep.firstChoiceDate && activeStep.secondChoiceDate;

  if (isLoading) {
    return (
      <div className="py-12 text-center text-base" style={{ color: CONCEPT_THEME.muted }}>
        Loading preferences...
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-2xl border px-4 py-4 text-base"
        style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}
      >
        Unable to load preferences. {loadError?.message || 'Please try again.'}
      </div>
    );
  }

  if (!cycleQuery.activeCycleId || !cycleQuery.activeCycle) {
    return (
      <div className="py-12 text-center text-base" style={{ color: CONCEPT_THEME.muted }}>
        No active cycle. Check back when a new cycle is created.
      </div>
    );
  }

  if (!member) {
    return (
      <div className="py-12 text-center text-base" style={{ color: CONCEPT_THEME.muted }}>
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
          <p className="mt-2 text-base" style={{ color: CONCEPT_THEME.text }}>
            Your {wizardSteps.length} slot preferences are saved for cycle {cycle.id}.
          </p>
          <p className="mt-2 text-base" style={{ color: isPreferenceDeadlinePassed ? CONCEPT_THEME.error : CONCEPT_THEME.text }}>
            {isPreferenceDeadlinePassed
              ? `The preference deadline has passed (${formatCalendarDate(preferenceDeadline)}). Choices can no longer be edited.`
              : `You can edit the preferences until the deadline (${formatCalendarDate(preferenceDeadline)}).`}
          </p>
          {canEditPreferences ? (
            <button
              type="button"
              onClick={startEditingSubmitted}
              className="mt-4 rounded-xl px-5 py-2.5 text-base font-semibold transition-all"
              style={{ background: CONCEPT_THEME.navy, color: 'white' }}
            >
              Edit Choices
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border bg-white p-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h4 className="concept-font-display text-lg font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>
            Submission Summary
          </h4>
          <div className="space-y-2 text-base">
            {wizardSteps.map((step, index) => (
              <div
                key={`${step.kind}-${step.shareIndex || step.blockIndex}-${step.slotKey || 'frac'}-summary`}
                className="rounded-lg p-2.5"
                style={{ background: CONCEPT_THEME.sand }}
              >
                <span className="font-semibold text">
                  Step {index + 1}: {step.label}
                </span>
                <span className="block mt-0.5 text">
                  1st: {formatWizardDate(step.firstChoiceDate)}
                  {' '}|{' '}
                  2nd: {formatWizardDate(step.secondChoiceDate)}
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
            <div className="text-base font-semibold" style={{ color: CONCEPT_THEME.text }}>Choices completed</div>
            <ConceptProgressRing current={madeChoices} total={totalChoices} />
            {submitPrefs.isPending ? (
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.muted }}>Submitting...</div>
            ) : null}
            {submitPrefs.isSuccess ? (
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.emerald }}>Preferences submitted</div>
            ) : null}
            {submitPrefs.isError ? (
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.error }}>
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
          <div className="text-base font-bold" style={{ color: CONCEPT_THEME.error }}>
            The preference deadline has passed. Preferences can no longer be edited or submitted.
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white px-4 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex w-full items-stretch gap-1 sm:gap-1.5">
          {wizardSteps.map((step, index) => {
            const isActive = index === currentStep;
            const isComplete = hasShiftSelected(step) && step.firstChoiceDate && step.secondChoiceDate;
            const isPartial = hasShiftSelected(step) && step.firstChoiceDate && !step.secondChoiceDate;
            return (
              <button
                key={`${step.kind}-${step.shareIndex || step.blockIndex}-${step.slotKey || 'frac'}`}
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
                  border: `1px solid ${isActive
                    ? CONCEPT_THEME.navy
                    : isComplete
                      ? `${CONCEPT_THEME.emerald}66`
                      : isPartial
                        ? `${CONCEPT_THEME.accentOnAccent}55`
                        : CONCEPT_THEME.border}`,
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
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-all sm:h-8 sm:w-8"
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
                      className="truncate text-[11px] font-bold uppercase tracking-[0.08em] leading-tight sm:text-sm"
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
              className="pointer-events-none absolute right-5 top-4 z-10 rounded-full px-3 py-1.5 text-sm font-bold uppercase tracking-[0.18em]"
              style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald, border: `1px solid ${CONCEPT_THEME.emerald}33` }}
            >
              {stepToast}
            </div>
          ) : null}
          <div
            style={{
              ...getMotionStyle(),
              transition: 'transform 220ms ease, opacity 220ms ease',
              pointerEvents: stepMotion === 'idle' ? 'auto' : 'none',
            }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>
                    {activeStep.kind === 'whole' ? `Share ${activeStep.shareIndex}` : `Fractional Block ${activeStep.blockIndex}`}
                  </div>
                  <h4 className="mt-1 concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>
                    {activeStep.label}
                  </h4>
                </div>
              </div>

              <div className="mt-3 flex gap-2 flex-wrap">
                {activeStep.kind === 'whole' && activeStep.slotKey !== 'NS' ? (
                  (activeStep.slotKey === 'DAY1' ? ['DS1', 'DS2', 'NS'] : ['DS1', 'DS2']).map((shiftType) => (
                    <button
                      key={shiftType}
                      type="button"
                      onClick={() => setStepShiftType(activeStep, shiftType)}
                      disabled={isPreferenceDeadlinePassed}
                      className="rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
                      style={{
                        background: activeStep.shiftType === shiftType
                          ? (SHIFT_UI_META[shiftType]?.bg || CONCEPT_THEME.sand)
                          : CONCEPT_THEME.warmWhite,
                        color: activeStep.shiftType === shiftType
                          ? (SHIFT_UI_META[shiftType]?.color || CONCEPT_THEME.text)
                          : CONCEPT_THEME.muted,
                        borderColor: activeStep.shiftType === shiftType
                          ? (SHIFT_UI_META[shiftType]?.color || CONCEPT_THEME.border)
                          : CONCEPT_THEME.border,
                      }}
                    >
                      {getShiftSelectorLabel(shiftType)}
                    </button>
                  ))
                ) : activeStep.kind === 'whole' && activeStep.slotKey === 'NS' ? (
                  <span
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                    style={{ background: SHIFT_UI_META.NS?.bg || CONCEPT_THEME.nightBg, color: SHIFT_UI_META.NS?.color || CONCEPT_THEME.night }}
                  >
                    {getShiftSelectorLabel('NS')}
                  </span>
                ) : (
                  SHIFT_ORDER.map((shiftType) => (
                    <button
                      key={shiftType}
                      type="button"
                      onClick={() => setStepShiftType(activeStep, shiftType)}
                      disabled={isPreferenceDeadlinePassed}
                      className="rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
                      style={{
                        background: activeStep.shiftType === shiftType
                          ? (SHIFT_UI_META[shiftType]?.bg || CONCEPT_THEME.sand)
                          : CONCEPT_THEME.warmWhite,
                        color: activeStep.shiftType === shiftType
                          ? (SHIFT_UI_META[shiftType]?.color || CONCEPT_THEME.text)
                          : CONCEPT_THEME.muted,
                        borderColor: activeStep.shiftType === shiftType
                          ? (SHIFT_UI_META[shiftType]?.color || CONCEPT_THEME.border)
                          : CONCEPT_THEME.border,
                      }}
                    >
                      {getShiftSelectorLabel(shiftType)}
                    </button>
                  ))
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  { choice: 1, label: isNightChoiceStep ? '1st Night Choice' : '1st Choice', date: activeStep.firstChoiceDate },
                  { choice: 2, label: isNightChoiceStep ? '2nd Night Choice' : '2nd Choice', date: activeStep.secondChoiceDate },
                ].map((item) => {
                  const isActiveChoice = pickingChoice === item.choice;
                  const accent = getChoiceAccent(item.choice);
                  const accentLight = getChoiceAccentLight(item.choice);
                  const shiftGated = !hasShiftSelected(activeStep);
                  return (
                    <button
                      key={item.choice}
                      type="button"
                      aria-pressed={isActiveChoice}
                      onClick={() => { if (!shiftGated) setPickingChoice(item.choice); }}
                      disabled={stepMotion !== 'idle' || isPreferenceDeadlinePassed || shiftGated}
                      className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all disabled:cursor-not-allowed"
                      style={{
                        borderColor: shiftGated ? CONCEPT_THEME.border : isActiveChoice ? accent : CONCEPT_THEME.border,
                        background: shiftGated ? CONCEPT_THEME.sand : isActiveChoice ? accent : 'white',
                        color: shiftGated ? CONCEPT_THEME.muted : isActiveChoice ? 'white' : CONCEPT_THEME.text,
                        boxShadow: !shiftGated && isActiveChoice ? `0 0 0 3px ${accentLight}` : 'none',
                      }}
                    >
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider">
                          {item.label}
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {shiftGated ? 'Choose session first' : formatWizardDate(item.date)}
                        </div>
                      </div>
                      {!shiftGated && item.date ? (
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
                style={{ color: !hasShiftSelected(activeStep) ? CONCEPT_THEME.muted : pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.accentOnAccent }}
              >
                {hasShiftSelected(activeStep)
                  ? `Pick your ${pickingChoice === 1 ? '1st' : '2nd'} ${isNightChoiceStep ? 'night ' : ''}choice date`
                  : 'Choose a session to start selecting dates'}
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
                        <div key={`${key}-${day}-${dayIndex}`} className="py-1 text-center text-sm font-bold" style={{ color: CONCEPT_THEME.text }}>
                          {day}
                        </div>
                      ))}
                      {cells.map((day, idx) => {
                        if (!day) return <div key={`${key}-blank-${idx}`} />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const inRange = dateStr >= cycle.startDate && dateStr <= cycle.endDate;
                        if (!inRange) {
                          return <div key={dateStr} className="py-2 text-center text-sm" style={{ color: CONCEPT_THEME.subtle }}>{day}</div>;
                        }
                        const blocked = isPreferenceDeadlinePassed || isDateBlockedForStep(dateStr, activeStep);
                        const isFirst = activeStep.firstChoiceDate === dateStr;
                        const isSecond = activeStep.secondChoiceDate === dateStr;
                        const usedByOtherStep = wizardSteps.some((step, stepIndex) => (
                          stepIndex !== currentStep && (step.firstChoiceDate === dateStr || step.secondChoiceDate === dateStr)
                        ));
                        const isPicked = justPicked === dateStr;

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
                            className="relative rounded-lg py-2.5 text-base font-semibold transition-all"
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
                            {blocked ? <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-lg">X</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="px-5 py-4 border-t flex items-center justify-between gap-3 flex-wrap"
              style={{ borderColor: CONCEPT_THEME.borderLight, background: CONCEPT_THEME.sand }}
            >
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
                    background: allComplete && !submitPrefs.isPending && stepMotion === 'idle' && !isPreferenceDeadlinePassed
                      ? CONCEPT_THEME.navy
                      : CONCEPT_THEME.sandDark,
                    color: allComplete && !submitPrefs.isPending && stepMotion === 'idle' && !isPreferenceDeadlinePassed
                      ? 'white'
                      : CONCEPT_THEME.muted,
                  }}
                >
                  {submitPrefs.isPending ? 'Submitting...' : 'Submit Preferences'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={stepMotion !== 'idle'}
                  className={`rounded-xl px-5 py-2.5 text-base font-bold disabled:cursor-not-allowed${stepIsComplete ? ' concept-anim-pulse' : ''}`}
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
