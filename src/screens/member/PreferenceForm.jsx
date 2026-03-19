import React, { useEffect, useMemo, useState } from 'react';
import ConceptProgressRing from '../../components/ConceptProgressRing';
import ConceptShiftBadge from '../../components/ConceptShiftBadge';
import { SHIFT_PLAIN_LABELS, WHOLE_SLOT_LABELS, WHOLE_SLOT_ORDER } from '../../lib/constants';
import { addDays, formatCalendarDate, fromDateStr, generateDateRange } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { computeEntitlements } from '../../engine/engine';
import { normalizeMemberPreferences } from '../../lib/normalizers';
import { useMockApp } from '../../lib/mock-state';

function buildPreferenceWizardSteps(entitlement, myPrefs) {
  const wholeSlots = [];
  for (let shareIndex = 1; shareIndex <= entitlement.wholeShares; shareIndex += 1) {
    WHOLE_SLOT_ORDER.forEach((slotKey) => {
      const pref = myPrefs.wholeShare.find((entry) => entry.shareIndex === shareIndex && entry.slotKey === slotKey) || {};
      const shiftType = slotKey === 'NS' ? 'NS' : (pref.shiftType || 'DS1');
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
    const shiftType = pref.shiftType || 'DS1';
    return {
      kind: 'fractional',
      fracIndex: idx,
      shiftType,
      firstChoiceDate: pref.firstChoiceDate || '',
      secondChoiceDate: pref.secondChoiceDate || '',
      label: `Fractional Block ${idx + 1} - ${SHIFT_PLAIN_LABELS[shiftType] || shiftType}`,
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
  const totalChoices = wizardSteps.length * 2;
  const madeChoices = wizardSteps.reduce(
    (count, step) => count + (step.firstChoiceDate ? 1 : 0) + (step.secondChoiceDate ? 1 : 0),
    0,
  );
  const allComplete = wizardSteps.every((step) => step.firstChoiceDate && step.secondChoiceDate);
  const activeStep = wizardSteps[currentStep] || null;
  const calendarMonths = useMemo(() => buildWizardCalendarMonths(cycle.startDate, cycle.endDate), [cycle.startDate, cycle.endDate]);
  const blockedDateSet = useMemo(() => new Set(cycle.blockedDates || []), [cycle.blockedDates]);
  const blockedSlotSet = useMemo(() => new Set(cycle.blockedSlots || []), [cycle.blockedSlots]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const preferenceDeadline = cycle.preferenceDeadline || addDays(cycle.startDate, -7);
  const defaultWholeShift = (slotKey) => (slotKey === 'NS' ? 'NS' : 'DS1');

  useEffect(() => {
    if (currentStep <= wizardSteps.length - 1) return;
    setCurrentStep(Math.max(0, wizardSteps.length - 1));
  }, [wizardSteps.length, currentStep]);

  useEffect(() => {
    setPickingChoice(1);
  }, [currentStep]);

  const upsertWholePref = (shareIndex, slotKey, patch) => {
    const updated = { ...myPrefs, wholeShare: [...myPrefs.wholeShare] };
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
      ...(updated.fractional[fracIndex] || { shiftType: 'DS1', firstChoiceDate: '', secondChoiceDate: '' }),
      ...patch,
    };
    updated.fractional[fracIndex] = existing;
    return updated;
  };

  const setStepShiftType = (step, shiftType) => {
    if (!step || shiftType === step.shiftType) return;
    if (step.kind === 'whole') {
      if (step.slotKey === 'NS') return;
      const updated = upsertWholePref(step.shareIndex, step.slotKey, { shiftType, firstChoiceDate: '', secondChoiceDate: '' });
      updatePreference(member.id, updated);
      return;
    }
    const updated = updateFractionalPref(step.fracIndex, { shiftType, firstChoiceDate: '', secondChoiceDate: '' });
    updatePreference(member.id, updated);
  };

  const setStepDate = (step, choice, date) => {
    if (!step) return;
    const key = choice === 1 ? 'firstChoiceDate' : 'secondChoiceDate';
    if (step.kind === 'whole') {
      const updated = upsertWholePref(step.shareIndex, step.slotKey, { [key]: date });
      updatePreference(member.id, updated);
      return;
    }
    const updated = updateFractionalPref(step.fracIndex, { [key]: date });
    updatePreference(member.id, updated);
  };

  const handleDatePick = (date) => {
    if (!activeStep) return;
    const otherDate = pickingChoice === 1 ? activeStep.secondChoiceDate : activeStep.firstChoiceDate;
    if (otherDate === date) return;
    const slotBlocked = blockedDateSet.has(date) || blockedSlotSet.has(`${date}:${activeStep.shiftType}`);
    if (slotBlocked) return;

    setStepDate(activeStep, pickingChoice, date);
    setJustPicked(date);
    window.setTimeout(() => setJustPicked(''), 520);

    if (pickingChoice === 1) {
      window.setTimeout(() => setPickingChoice(2), 220);
      return;
    }
    if (currentStep < wizardSteps.length - 1 && (activeStep.firstChoiceDate || pickingChoice === 2)) {
      window.setTimeout(() => setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1)), 460);
    }
  };

  const handleSubmit = () => {
    if (!allComplete) return;
    updatePreference(member.id, { ...myPrefs, submitted: true });
  };

  const handleNotesChange = (value) => {
    updatePreference(member.id, { ...myPrefs, notes: value });
  };

  const goToStep = (idx) => {
    setCurrentStep(idx);
    const step = wizardSteps[idx];
    if (!step) {
      setPickingChoice(1);
      return;
    }
    setPickingChoice(step.firstChoiceDate && !step.secondChoiceDate ? 2 : 1);
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
          <p className="text-sm mt-2" style={{ color: CONCEPT_THEME.muted }}>
            Your {wizardSteps.length} slot preferences are saved for cycle {cycle.id}.
          </p>
          <button
            type="button"
            onClick={() => updatePreference(member.id, { ...myPrefs, submitted: false })}
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
            <h3 className="concept-font-display text-xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Preference Selection Sheet</h3>
            <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
              Cycle {cycle.id} - deadline {formatCalendarDate(preferenceDeadline)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>Choices completed</div>
            <ConceptProgressRing current={madeChoices} total={totalChoices} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-3 bg-white" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {wizardSteps.map((step, idx) => {
            const done = step.firstChoiceDate && step.secondChoiceDate;
            const half = step.firstChoiceDate && !step.secondChoiceDate;
            const active = idx === currentStep;
            return (
              <button
                key={`${step.kind}-${step.shareIndex || step.fracIndex}-${step.slotKey || 'frac'}`}
                type="button"
                onClick={() => goToStep(idx)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-all"
                style={{
                  background: active ? CONCEPT_THEME.navy : done ? CONCEPT_THEME.emeraldLight : half ? CONCEPT_THEME.amberLight : CONCEPT_THEME.sand,
                  color: active ? 'white' : done ? CONCEPT_THEME.emerald : half ? CONCEPT_THEME.amber : CONCEPT_THEME.muted,
                  borderColor: active ? CONCEPT_THEME.navy : 'transparent',
                }}
              >
                Step {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden bg-white concept-anim-scale" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>
                {activeStep.label}
              </div>
              <div className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
                Step {currentStep + 1} of {wizardSteps.length}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ConceptShiftBadge shiftType={activeStep.shiftType} />
          </div>

          <div className="mt-3 flex gap-2 flex-wrap justify-start">
            {activeStep.slotKey !== 'NS' ? (
              ['DS1', 'DS2'].map((shiftType) => (
                <button
                  key={shiftType}
                  type="button"
                  onClick={() => setStepShiftType(activeStep, shiftType)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={{
                    background: activeStep.shiftType === shiftType
                      ? (shiftType === 'DS1' ? CONCEPT_THEME.morningBg : CONCEPT_THEME.afternoonBg)
                      : CONCEPT_THEME.warmWhite,
                    color: activeStep.shiftType === shiftType
                      ? (shiftType === 'DS1' ? CONCEPT_THEME.morning : CONCEPT_THEME.afternoon)
                      : CONCEPT_THEME.muted,
                    borderColor: CONCEPT_THEME.border,
                  }}
                >
                  {SHIFT_PLAIN_LABELS[shiftType]}
                </button>
              ))
            ) : (
              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: CONCEPT_THEME.nightBg, color: CONCEPT_THEME.night }}>
                Night Shift (fixed)
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPickingChoice(1)}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-sm"
              style={{
                background: pickingChoice === 1 ? CONCEPT_THEME.skyLight : CONCEPT_THEME.sand,
                borderColor: pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.border,
                color: pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.text,
              }}
            >
              <span className="font-semibold">1st Choice: {formatWizardDate(activeStep.firstChoiceDate)}</span>
              {activeStep.firstChoiceDate ? <span style={{ color: CONCEPT_THEME.emerald }}>Done</span> : null}
            </button>
            <button
              type="button"
              onClick={() => setPickingChoice(2)}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-sm"
              style={{
                background: pickingChoice === 2 ? CONCEPT_THEME.amberLight : CONCEPT_THEME.sand,
                borderColor: pickingChoice === 2 ? CONCEPT_THEME.amber : CONCEPT_THEME.border,
                color: pickingChoice === 2 ? CONCEPT_THEME.amber : CONCEPT_THEME.text,
              }}
            >
              <span className="font-semibold">2nd Choice: {formatWizardDate(activeStep.secondChoiceDate)}</span>
              {activeStep.secondChoiceDate ? <span style={{ color: CONCEPT_THEME.emerald }}>Done</span> : null}
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="text-xs font-semibold mb-3" style={{ color: pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.amber }}>
            Pick your {pickingChoice === 1 ? '1st' : '2nd'} choice date
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
                  <div className="text-center concept-font-display text-sm font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>
                    {monthNames[month]} {year}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {dayHeaders.map((header, idx) => (
                      <div key={`${key}-h-${idx}`} className="text-center text-[10px] font-bold py-1" style={{ color: CONCEPT_THEME.subtle }}>
                        {header}
                      </div>
                    ))}

                    {cells.map((day, idx) => {
                      if (!day) return <div key={`${key}-empty-${idx}`} />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const inRange = dateStr >= cycle.startDate && dateStr <= cycle.endDate;
                      if (!inRange) {
                        return (
                          <div key={`${key}-out-${day}`} className="text-center py-2 text-xs" style={{ color: CONCEPT_THEME.borderLight }}>
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
                      if (blocked) {
                        background = CONCEPT_THEME.sandDark;
                        textColor = CONCEPT_THEME.subtle;
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
                        textColor = CONCEPT_THEME.subtle;
                        borderColor = CONCEPT_THEME.border;
                      }

                      return (
                        <button
                          key={`${key}-${day}`}
                          type="button"
                          onClick={() => handleDatePick(dateStr)}
                          disabled={blocked}
                          className="relative py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background,
                            color: textColor,
                            border: `1.5px solid ${borderColor}`,
                            transform: isPicked ? 'scale(1.12)' : (isFirst || isSecond) ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: isPicked ? `0 0 14px ${pickingChoice === 1 ? CONCEPT_THEME.sky : CONCEPT_THEME.amber}88` : 'none',
                            cursor: blocked ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {day}
                          {blocked ? <span className="absolute inset-0 flex items-center justify-center text-[9px]">X</span> : null}
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
          <label htmlFor={`pref-notes-${member.id}`} className="block text-xs font-bold mb-1.5" style={{ color: CONCEPT_THEME.text }}>
            Notes for admin (optional)
          </label>
          <textarea
            id={`pref-notes-${member.id}`}
            rows={2}
            value={myPrefs.notes || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Example: unavailable March 15-17 due to travel"
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.border}` }}
          />

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
            >
              Previous
            </button>

            <span className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>
              {madeChoices} / {totalChoices} choices made
            </span>

            {currentStep < wizardSteps.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1))}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${activeStep.firstChoiceDate && activeStep.secondChoiceDate ? 'concept-anim-pulse' : ''}`}
                style={{
                  background: activeStep.firstChoiceDate && activeStep.secondChoiceDate ? CONCEPT_THEME.navy : CONCEPT_THEME.sandDark,
                  color: activeStep.firstChoiceDate && activeStep.secondChoiceDate ? 'white' : CONCEPT_THEME.muted,
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
  );
}
