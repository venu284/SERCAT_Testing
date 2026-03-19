import { CONCEPT_THEME } from './theme';

export const SHIFT_HOURS = { DS1: 6, DS2: 6, NS: 12 };
export const SHIFT_ORDER = ['DS1', 'DS2', 'NS'];
export const WHOLE_SLOT_ORDER = ['DAY1', 'DAY2', 'NS'];
export const WHOLE_SLOT_LABELS = {
  DAY1: 'Day Slot 1',
  DAY2: 'Day Slot 2',
  NS: 'Night Slot',
};
export const SHIFT_LABELS = {
  DS1: 'DS1 (9am-3pm)',
  DS2: 'DS2 (3pm-9pm)',
  NS: 'NS (9pm-9am)',
};
export const MEMBER_PORTAL_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'availability', label: 'Availability Calendar' },
  { id: 'preferences', label: 'Submit Preferences' },
  { id: 'schedule', label: 'My Schedule' },
  { id: 'shiftChanges', label: 'Shift Changes' },
];
export const ADMIN_PORTAL_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'members', label: 'Members & Shares' },
  { id: 'cycle', label: 'Run Cycles' },
  { id: 'engine', label: 'Engine & Schedule' },
  { id: 'fairness', label: 'Fairness' },
  { id: 'shiftChanges', label: 'Shift Changes' },
  { id: 'conflicts', label: 'Conflict Log' },
];
export const SHIFT_PLAIN_LABELS = {
  DS1: 'Morning Shift',
  DS2: 'Afternoon Shift',
  NS: 'Night Shift',
};
export const SHIFT_BADGE_META = {
  DS1: { label: 'Morning', sub: '9am-3pm', color: CONCEPT_THEME.morning, bg: CONCEPT_THEME.morningBg, icon: 'Sun' },
  DS2: { label: 'Afternoon', sub: '3pm-9pm', color: CONCEPT_THEME.afternoon, bg: CONCEPT_THEME.afternoonBg, icon: 'Day' },
  NS: { label: 'Night', sub: '9pm-9am', color: CONCEPT_THEME.night, bg: CONCEPT_THEME.nightBg, icon: 'Night' },
};
export const SHIFT_UI_META = {
  DS1: { label: 'Morning', sub: '9am - 3pm', color: CONCEPT_THEME.morning, bg: CONCEPT_THEME.morningBg },
  DS2: { label: 'Afternoon', sub: '3pm - 9pm', color: CONCEPT_THEME.afternoon, bg: CONCEPT_THEME.afternoonBg },
  NS: { label: 'Night', sub: '9pm - 9am', color: CONCEPT_THEME.night, bg: CONCEPT_THEME.nightBg },
};
export const CALENDAR_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
