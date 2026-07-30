// Two async helpers with deliberately different failure semantics.
//
// safe(fn):       for READS. Any error becomes null. Fine for
//                 background data-hydration where a missing row shouldn't
//                 blank the screen. NEVER use around mutations — see the
//                 postmortem below.
//
// mustSucceed(fn, label): for WRITES. Re-throws with a labelled prefix so
//                 the caller's own try/catch can toast the real reason.
//                 Prevents the "success toast fires but nothing saved"
//                 class of bug that plagued the app: ShopDashboard used
//                 safe() around addProduct/placeOrder/addStaff/etc, then
//                 fell straight through to toast.success — a lie whenever
//                 the write failed (RLS, plan limit, network, dupe key).
//
// If you find yourself reaching for safe() around a mutation, that is
// almost certainly a bug. Use mustSucceed().

export const safe = async (fn) => {
  try { return await fn(); }
  catch { return null; }
};

export const mustSucceed = async (fn, label = 'operation') => {
  try { return await fn(); }
  catch (e) {
    const msg = e?.message || e?.error_description || e?.error || String(e);
    throw new Error(`${label} failed: ${msg}`, { cause: e });
  }
};
