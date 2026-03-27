import React, { useEffect, useMemo, useRef, useState } from 'react';
import ConceptProgressRing from '../../components/ConceptProgressRing';
import { SHIFT_PLAIN_LABELS, SHIFT_UI_META, WHOLE_SLOT_LABELS } from '../../lib/constants';
import { addDays, formatCalendarDate, fromDateStr, generateDateRange } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { computeEntitlements } from '../../engine/engine';
import { normalizeMemberPreferences } from '../../lib/normalizers';
import { getActiveWholeSlotKeysForShare } from '../../lib/whole-share';
import { useMockApp } from '../../lib/mock-state';

function buildPreferenceWizardSteps(entitlement, myPrefs) {
  const wholeSlots = [];
  for (let shareIndex = 1; shareIndex <= entitlement.wholeShares; shareIndex += 1) {
    getActiveWholeSlotKeysForShare(myPrefs.wholeShare, shareIndex).forEach((slotKey) => {
      const pref = myPrefs.wholeShare.find((entry) => entry.shareIndex === shareIndex && entry.slotKey === slotKey) || {};
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

  const fractionalBlocks = Math.ceil(entitlement.fractionalHours / 6);
  const fractionalSlots = Array.from({ length: fractionalBlocks }, (_, idx) => {
    const pref = myPrefs.fractional[idx] || {};
    const shiftType = typeof pref.shiftType === 'string' ? pref.shiftType : '';
    return {
      kind: 'fractional',
      fracIndex: idx,
      shiftType,
      firstChoiceDate: pref.firstChoiceDate || '',
      secondChoiceDate: pref.secondChoiceDate || '',
      label: `Fractional Block ${idx + 1} - ${SHIFT_PLAIN_LABELS[shiftType] || 'Choose Session'}`,
    };
  });

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

export default function PreferenceFormScreen() {
  const { activeMember: member, cycle, preferences, updatePreference } = useMockApp();

  if (!member) return null;

  const entitlement = computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 };
  const myPrefs = preferences[member.id] || normalizeMemberPreferences(member, {});
  const wizardSteps = useMemo(() => buildPreferenceWizardSteps(entitlement, myPrefs), [
    entitlement.wholeShares,
    entitlement.fractionalHours,
    myPrefs.wholeShare,
    myPrefs.fractional,
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [pickingChoice, setPickingChoice] = useState(1);
  const [justPicked, setJustPicked] = useState('');
  const [stepToast, setStepToast] = useState('');
  const [stepMotion, setStepMotion] = useState('idle');
  const timeoutIdsRef = useRef([]);
  const totalChoices = wizardSteps.length * 2;
  const madeChoices = wizardSteps.reduce(
    (count, step) => count + (step.firstChoiceDate ? 1 : 0) + (step.secondChoiceDate ? 1 : 0),
    0,
  );
  const activeStep = wizardSteps[currentStep] || null;
  const calendarMonths = useMemo(() => buildWizardCalendarMonths(cycle.startDate, cycle.endDate), [cycle.startDate, cycle.endDate]);
  const blockedDateSet = useMemo(() => new Set(cycle.blockedDates || []), [cycle.blockedDates]);
  const blockedSlotSet = useMemo(() => new Set(cycle.blockedSlots || []), [cycle.blockedSlots]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const preferenceDeadline = cycle.preferenceDeadline || addDays(cycle.startDate, -7);
  const defaultWholeShift = (slotKey) => (slotKey === 'NS' ? 'NS' : '');
  const commitPreferences = (nextPrefs) => {
    updatePreference(member.id, normalizeMemberPreferences(member, nextPrefs));
  };
  const queueTimeout = (callback, delay) => {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  };
  const resolvePickingChoice = (step) => (step?.firstChoiceDate && !step?.secondChoiceDate ? 2 : 1);
  const hasShiftSelected = (step) => Boolean(step && (step.slotKey === 'NS' || step.shiftType));
  const selectedShiftRequired = hasShiftSelected(activeStep);
  const allComplete = wizardSteps.every((step) => hasShiftSelected(step) && step.firstChoiceDate && step.secondChoiceDate);
  const getShiftSelectorLabel = (shiftType) => {
    const meta = SHIFT_UI_META[shiftType];
    if (!meta) return shiftType;
    return `${meta.label} Shift (${meta.sub.replace(/\s+/g, '')})`;
  };
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

  useEffect(() => {
    if (currentStep <= wizardSteps.length - 1) return;
    setCurrentStep(Math.max(0, wizardSteps.length - 1));
  }, [wizardSteps.length, currentStep]);

  useEffect(() => {
    setPickingChoice(resolvePickingChoice(wizardSteps[currentStep]));
  }, [currentStep, wizardSteps]);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

  const upsertWholePref = (sourcePrefs, shareIndex, slotKey, patch) => {
    const updated = { ...sourcePrefs, wholeShare: [...sourcePrefs.wholeShare] };
    const idx = updated.wholeShare.findIndex((entry) => entry.shareIndex === shareIndex && entry.slotKey === slotKey);
    const existing = idx >= 0 ? { ...updated.wholeShare[idx] } : {
      shareIndex,
      slotKey,
      shiftType: defaultWholeShift(slotKey),
      firstChoiceDate: '',
      secondChoiceDate: '',
    };
    Object.assign(existing, patch);
    if (existing.slotKey === 'NS') existing.shiftType = 'NS';
    if (!existing.shiftType) existing.shiftType = defaultWholeShift(slotKey);
    if (idx >= 0) updated.wholeShare[idx] = existing;
    else updated.wholeShare.push(existing);
    return updated;
  };

  const updateFractionalPref = (fracIndex, patch) => {
    const updated = { ...myPrefs, fractional: [...myPrefs.fractional] };
    const existing = {
      ...(updated.fractional[fracIndex] || { shiftType: '', firstChoiceDate: '', secondChoiceDate: '' }),
      ...patch,
    };
    updated.fractional[fracIndex] = existing;
    return updated;
  };

  const setStepShiftType = (step, shiftType) => {
    if (!step || shiftType === step.shiftType) return;
    if (step.kind === 'whole') {
      if (step.slotKey === 'NS') return;
      let updated = upsertWholePref(myPrefs, step.shareIndex, step.slotKey, { shiftType, firstChoiceDate: '', secondChoiceDate: '' });
      if (step.slotKey === 'DAY1' && (shiftType === 'NS' || step.shiftType === 'NS')) {
        updated = upsertWholePref(updated, step.shareIndex, 'DAY2', { shiftType: '', firstChoiceDate: '', secondChoiceDate: '' });
      }
      commitPreferences(updated);
      return;
    }
    const updated = updateFractionalPref(step.fracIndex, { shiftType, firstChoiceDate: '', secondChoiceDate: '' });
    commitPreferences(updated);
  };

  const setStepDate = (step, choice, date) => {
    if (!step) return;
    const key = choice === 1 ? 'firstChoiceDate' : 'secondChoiceDate';
    if (step.kind === 'whole') {
      const updated = upsertWholePref(myPrefs, step.shareIndex, step.slotKey, { [key]: date });
      commitPreferences(updated);
      return;
    }
    const updated = updateFractionalPref(step.fracIndex, { [key]: date });
    commitPreferences(updated);
  };

  const handleDatePick = (date) => {
    if (!activeStep || stepMotion !== 'idle') return;
    if (!hasShiftSelected(activeStep)) return;
    const otherDate = pickingChoice === 1 ? activeStep.secondChoiceDate : activeStep.firstChoiceDate;
    if (otherDate === date) return;
    const slotBlocked = blockedDateSet.has(date) || blockedSlotSet.has(`${date}:${activeStep.shiftType}`);
    if (slotBlocked) return;

    setStepDate(activeStep, pickingChoice, date);
    setJustPicked(date);
    queueTimeout(() => setJustPicked(''), 520);

    if (pickingChoice === 1) {
      queueTimeout(() => setPickingChoice(2), 220);
      return;
    }
    if (currentStep < wizardSteps.length - 1 && (activeStep.firstChoiceDate || pickingChoice === 2)) {
      queueTimeout(() => animateToStep(Math.min(currentStep + 1, wizardSteps.length - 1), 'forward', 'Step Complete'), 300);
    }
  };

  const handleSubmit = () => {
    if (!allComplete) return;
    commitPreferences({ ...myPrefs, submitted: true });
  };

  const goToStep = (idx) => {
    const step = wizardSteps[idx];
    if (!step) {
      setPickingChoice(1);
      return;
    }
    if (idx === currentStep) {
      setPickingChoice(resolvePickingChoice(step));
      return;
    }
    animateToStep(idx, idx > currentStep ? 'forward' : 'back');
  };

  const formatWizardDate = (dateStr) => {
    if (!dateStr) return 'Pick date';
    return fromDateStr(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (!activeStep) {
    return (
      <div className="rounded-xl border p-4 bg-amber-50 border-amber-200 text-amber-800 concept-font-body text-sm">
        No preference slots are available for this member yet.
      </div>
    );
  }

  if (myPrefs.submitted) {
    return (
      <div className="space-y-4 concept-font-body">
        <div className="rounded-2xl border p-6 text-center concept-anim-scale" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}40` }}>
          <h3 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Preferences Submitted</h3>
          <p className="text-sm mt-2" style={{ color: CONCEPT_THEME.text }}>
            Your {wizardSteps.length} slot preferences are saved for cycle {cycle.id}.
          </p>
          <p className="text-sm mt-2" style={{ color: CONCEPT_THEME.text }}>
            You can edit the preferences until the deadline({formatCalendarDate(preferenceDeadline)}).
          </p>
          <button
            type="button"
            onClick={() => commitPreferences({ ...myPrefs, submitted: false })}
            className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: CONCEPT_THEME.navy, color: 'white' }}
          >
            Edit Choices
          </button>
        </div>
        <div className="rounded-xl border p-4 bg-white" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h4 className="concept-font-display text-base font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>Submission Summary</h4>
          <div className="space-y-2 text-xs">
            {wizardSteps.map((step, idx) => (
              <div key={`${step.kind}-${step.shareIndex || step.fracIndex}-${step.slotKey || 'frac'}`} className="rounded-lg p-2.5" style={{ background: CONCEPT_THEME.sand }}>
                <div className="font-semibold text-gray-700">Step {idx + 1}: {step.label}</div>
                <div className="text-gray-600 mt-0.5">1st: {formatWizardDate(step.firstChoiceDate)} | 2nd: {formatWizardDate(step.secondChoiceDate)}</div>
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
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>Choices completed</div>
            <ConceptProgressRing current={madeChoices} total={totalChoices} />
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <div
            className="rounded-full px-4 py-2 text-base font-bold text-center"
            style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent, border: `1px solid ${CONCEPT_THEME.amber}33` }}
          >
            Cycle {cycle.id} - deadline {formatCalendarDate(preferenceDeadline)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white px-4 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex w-full items-stretch gap-1 sm:gap-1.5">
          {wizardSteps.map((step, idx) => {
            const done = hasShiftSelected(step) && step.firstChoiceDate && step.secondChoiceDate;
            const half = hasShiftSelected(step) && step.firstChoiceDate && !step.secondChoiceDate;
            const active = idx === currentStep;
            return (
              <button
                key={`${step.kind}-${step.shareIndex || step.fracIndex}-${step.slotKey || 'frac'}`}
                type="button"
                onClick={() => goToStep(idx)}
                className="min-w-0 flex-1 rounded-xl px-1 py-2 text-center transition-all sm:px-1.5 sm:py-2.5"
                title={step.label}
                style={{
                  background: active ? `${CONCEPT_THEME.navy}08` : CONCEPT_THEME.warmWhite,
                  color: CONCEPT_THEME.text,
                  border: `1px solid ${active ? CONCEPT_THEME.navy : done ? `${CONCEPT_THEME.emerald}33` : CONCEPT_THEME.borderLight}`,
                }}
              >
                <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all sm:h-8 sm:w-8"
                    style={{
                      background: active ? CONCEPT_THEME.navy : done ? CONCEPT_THEME.emeraldLight : half ? CONCEPT_THEME.amberLight : CONCEPT_THEME.sand,
                      color: active ? 'white' : done ? CONCEPT_THEME.emerald : half ? CONCEPT_THEME.accentOnAccent : CONCEPT_THEME.muted,
                      borderColor: active ? CONCEPT_THEME.navy : done ? `${CONCEPT_THEME.emerald}55` : half ? `${CONCEPT_THEME.amber}55` : CONCEPT_THEME.border,
                      transform: active && stepToast ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.08em] leading-tight sm:text-xs" style={{ color: active ? CONCEPT_THEME.navy : CONCEPT_THEME.muted }}>
                      Step {idx + 1}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-white concept-anim-scale" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        {stepToast ? (
          <div
            className="pointer-events-none absolute right-5 top-4 z-10 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
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
              <div className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>
                {activeStep.label}
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2 flex-wrap justify-start">
            {activeStep.slotKey !== 'NS' ? (
              (activeStep.slotKey === 'DAY1' ? ['DS1', 'DS2', 'NS'] : ['DS1', 'DS2']).map((shiftType) => (
                <button
                  key={shiftType}
                  type="button"
                  onClick={() => setStepShiftType(activeStep, shiftType)}
                  className="rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
                  style={{
                    background: activeStep.shiftType === shiftType
                      ? (shiftType === 'DS1'
                        ? CONCEPT_THEME.morningBg
                        : shiftType === 'DS2'
                          ? CONCEPT_THEME.afternoonBg
                          : CONCEPT_THEME.nightBg)
                      : CONCEPT_THEME.warmWhite,
                    color: activeStep.shiftType === shiftType
                      ? (shiftType === 'DS1'
                        ? CONCEPT_THEME.morning
                        : shiftType === 'DS2'
                          ? CONCEPT_THEME.afternoon
                          : CONCEPT_THEME.night)
                      : CONCEPT_THEME.muted,
                    borderColor: CONCEPT_THEME.border,
                  }}
                >
                  {getShiftSelectorLabel(shiftType)}
                </button>
              ))
            ) : (
              <span className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: CONCEPT_THEME.nightBg, color: CONCEPT_THEME.night }}>
                {getShiftSelectorLabel('NS')}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (!selectedShiftRequired) return;
                setPickingChoice(1);
              }}
              disabled={!selectedShiftRequired}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-sm"
              style={{
                background: !selectedShiftRequired
                  ? CONCEPT_THEME.sand
                  : pickingChoice === 1
                    ? CONCEPT_THEME.skyLight
                    : CONCEPT_THEME.sand,
                borderColor: !selectedShiftRequired
                  ? CONCEPT_THEME.border
                  : pickingChoice === 1
                    ? CONCEPT_THEME.sky
                    : CONCEPT_THEME.border,
                color: !selectedShiftRequired
                  ? CONCEPT_THEME.muted
                  : pickingChoice === 1
                    ? CONCEPT_THEME.sky
                    : CONCEPT_THEME.text,
                cursor: !selectedShiftRequired ? 'not-allowed' : 'pointer',
              }}
            >
              <span className="font-semibold">
                {activeStep.slotKey === 'DAY1' && activeStep.shiftType === 'NS' ? '1st Night Choice' : '1st Choice'}: {selectedShiftRequired ? formatWizardDate(activeStep.firstChoiceDate) : 'Choose session first'}
              </span>
              {activeStep.firstChoiceDate ? <span style={{ color: CONCEPT_THEME.emerald }}>Done</span> : null}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedShiftRequired) return;
                setPickingChoice(2);
              }}
              disabled={!selectedShiftRequired}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-sm"
              style={{
                background: !selectedShiftRequired
                  ? CONCEPT_THEME.sand
                  : pickingChoice === 2
                    ? CONCEPT_THEME.amberLight
                    : CONCEPT_THEME.sand,
                borderColor: !selectedShiftRequired
                  ? CONCEPT_THEME.border
                  : pickingChoice === 2
                    ? CONCEPT_THEME.amber
                    : CONCEPT_THEME.border,
                color: !selectedShiftRequired
                  ? CONCEPT_THEME.muted
                  : pickingChoice === 2
                    ? CONCEPT_THEME.accentOnAccent
                    : CONCEPT_THEME.text,
                cursor: !selectedShiftRequired ? 'not-allowed' : 'pointer',
              }}
            >
              <span className="font-semibold">
                {activeStep.slotKey === 'DAY1' && activeStep.shiftType === 'NS' ? '2nd Night Choice' : '2nd Choice'}: {selectedShiftRequired ? formatWizardDate(activeStep.secondChoiceDate) : 'Choose session first'}
              </span>
              {activeStep.secondChoiceDate ? <span style={{ color: CONCEPT_THEME.emerald }}>Done</span> : null}
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="mb-3 text-sm font-semibold" style={{ color: !selectedShiftRequired ? CONCEPT_THEME.muted : pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.accentText }}>
            {selectedShiftRequired
              ? `Pick your ${pickingChoice === 1 ? '1st' : '2nd'} ${activeStep.slotKey === 'DAY1' && activeStep.shiftType === 'NS' ? 'night ' : ''}choice date`
              : 'Choose a session to start selecting dates'}
          </div>

          <div className="flex flex-wrap gap-4">
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
                    {dayHeaders.map((header, idx) => (
                      <div key={`${key}-h-${idx}`} className="py-1 text-center text-xs font-bold" style={{ color: CONCEPT_THEME.text }}>
                        {header}
                      </div>
                    ))}

                    {cells.map((day, idx) => {
                      if (!day) return <div key={`${key}-empty-${idx}`} />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const inRange = dateStr >= cycle.startDate && dateStr <= cycle.endDate;
                      if (!inRange) {
                        return (
                          <div key={`${key}-out-${day}`} className="py-2 text-center text-sm" style={{ color: CONCEPT_THEME.subtle }}>
                            {day}
                          </div>
                        );
                      }
                      const blocked = blockedDateSet.has(dateStr) || blockedSlotSet.has(`${dateStr}:${activeStep.shiftType}`);
                      const isFirst = activeStep.firstChoiceDate === dateStr;
                      const isSecond = activeStep.secondChoiceDate === dateStr;
                      const usedByOtherStep = wizardSteps.some((step, stepIdx) => stepIdx !== currentStep && (step.firstChoiceDate === dateStr || step.secondChoiceDate === dateStr));
                      const isPicked = justPicked === dateStr;

                      let background = CONCEPT_THEME.warmWhite;
                      let textColor = CONCEPT_THEME.text;
                      let borderColor = 'transparent';
                      if (!selectedShiftRequired) {
                        background = CONCEPT_THEME.sand;
                        textColor = CONCEPT_THEME.muted;
                        borderColor = CONCEPT_THEME.borderLight;
                      } else if (blocked) {
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
                          key={`${key}-${day}`}
                          type="button"
                          onClick={() => handleDatePick(dateStr)}
                          disabled={!selectedShiftRequired || blocked}
                          className="relative rounded-lg py-2.5 text-sm font-semibold transition-all"
                          style={{
                            background,
                            color: textColor,
                            border: `1.5px solid ${borderColor}`,
                            transform: isPicked ? 'scale(1.12)' : (isFirst || isSecond) ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: isPicked ? `0 0 14px ${pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.amber}88` : 'none',
                            cursor: !selectedShiftRequired || blocked ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {day}
                          {blocked ? <span className="absolute inset-0 flex items-center justify-center text-xs">X</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t" style={{ borderColor: CONCEPT_THEME.borderLight, background: CONCEPT_THEME.sand }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => animateToStep(Math.max(0, currentStep - 1), 'back')}
              disabled={currentStep === 0 || stepMotion !== 'idle'}
              className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
            >
              Previous
            </button>

            <span className="text-sm font-semibold" style={{ color: CONCEPT_THEME.muted }}>
              {madeChoices} / {totalChoices} choices made
            </span>

            {currentStep < wizardSteps.length - 1 ? (
              <button
                type="button"
                onClick={() => animateToStep(Math.min(currentStep + 1, wizardSteps.length - 1), 'forward')}
                disabled={stepMotion !== 'idle'}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${activeStep.firstChoiceDate && activeStep.secondChoiceDate ? 'concept-anim-pulse' : ''}`}
                style={{
                  background: activeStep.firstChoiceDate && activeStep.secondChoiceDate ? CONCEPT_THEME.navy : CONCEPT_THEME.sandDark,
                  color: activeStep.firstChoiceDate && activeStep.secondChoiceDate ? 'white' : CONCEPT_THEME.muted,
                  opacity: stepMotion === 'idle' ? 1 : 0.65,
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allComplete}
                className="px-4 py-2 rounded-lg text-sm font-bold disabled:cursor-not-allowed"
                style={{ background: allComplete ? CONCEPT_THEME.emerald : CONCEPT_THEME.sandDark, color: allComplete ? 'white' : CONCEPT_THEME.muted }}
              >
                {allComplete ? 'Submit Preferences' : `${totalChoices - madeChoices} choices left`}
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
