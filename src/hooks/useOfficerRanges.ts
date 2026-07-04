import useStore from '../store/useStore';

// Which ranges the signed-in user holds, and which one they're actively
// working in. Officers in charge of a single range never see a difference;
// an officer holding several (via officer_ranges) gets `isMultiRange` and a
// setter the pages use to render a range switcher. The selection lives in
// the zustand store so Dashboard, Task List, and Incident Log stay on the
// same range as the officer navigates.
export function useOfficerRanges() {
  const currentUser = useStore((s) => s.currentUser);
  const storedActiveRangeId = useStore((s) => s.activeRangeId);
  const setActiveRangeId = useStore((s) => s.setActiveRangeId);

  const rangeIds = currentUser?.rangeIds?.length
    ? currentUser.rangeIds
    : currentUser?.rangeId
      ? [currentUser.rangeId]
      : [];

  // Ignore a stored selection that no longer belongs to this user (e.g.
  // after a re-login as someone else, or the director reassigned ranges).
  const activeRangeId =
    storedActiveRangeId && rangeIds.includes(storedActiveRangeId)
      ? storedActiveRangeId
      : rangeIds[0] ?? '';

  return {
    rangeIds,
    activeRangeId,
    setActiveRangeId,
    isMultiRange: rangeIds.length > 1,
  };
}
