import { CONCEPT_THEME } from './theme.js';

export const SHIFT_HOURS = { DS1: 6, DS2: 6, NS: 12 };
export const SHIFT_ORDER = ['DS1', 'DS2', 'NS'];
export const SHIFT_LABELS = {
  DS1: 'DS1 (9am-3pm)',
  DS2: 'DS2 (3pm-9pm)',
  NS: 'NS (9pm-9am)',
};
export const SHIFT_TIME_LABELS = {
  DS1: 'Morning (9:00 AM - 3:00 PM)',
  DS2: 'Afternoon (3:00 PM - 9:00 PM)',
  NS: 'Night (9:00 PM - 9:00 AM)',
};
export const MEMBER_PORTAL_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'availability', label: 'Availability' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'shiftChanges', label: 'Shift Change' },
  { id: 'comments', label: 'Comments' },
  { id: 'profile', label: 'Profile' },
];
export const ADMIN_PORTAL_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'members', label: 'Member Info' },
  { id: 'cycle', label: 'Availability Calendar' },
  { id: 'engine', label: 'Schedule' },
  { id: 'fairness', label: 'Member Satisfaction Score' },
  { id: 'shiftChanges', label: 'Shift Changes' },
  { id: 'comments', label: 'Comments' },
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
export const ASSIGNMENT_REASON_LABELS = {
  choice1: '1st Choice',
  choice1_no_conflict: '1st Choice',
  choice2: '2nd Choice',
  fallback_proximity: 'Proximity',
  fallback_any: 'Backfill',
  auto_assigned: 'Auto',
  fractional_packed: 'Packed',
  manual_override: 'Manual',
};
export const CALENDAR_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
