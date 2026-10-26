/**
 * vbu7Wr3o — tarix yozuvlari (prod E2E Surxondaryo, TEST buyurtma 133 kabi): HQ → filial jo'natish (`metadata.branch_name`
 * «… filiali»), filial menejeri pochtani qabul qildi (`action: "post_received"`), bekor pochta qabuli metadata'si
 * (`from_holder_type`, `received_by`, `source_type` — xom ko'rinmasin).
 */
const at = (minute: number) => `2026-10-26T1${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}:00.000Z`;

export const RECEIVE_TRACKING = [
  {
    id: "r1",
    order_id: "96",
    action: "sent",
    created_at: at(10),
    changed_by: "7",
    changed_by_role: "registrator",
    actor: { id: "7", name: "Bobur Xolmatov", role: "registrator" },
    old_value: { status: "received" },
    new_value: { status: "on the road" },
    note: "Post #35 HQ'dan branch #12 ga dispatch qilindi",
    metadata: { post_id: "35", branch_name: "TEST Claude Surxondaryo filiali" },
  },
  {
    id: "r2",
    order_id: "96",
    action: "post_received",
    created_at: at(40),
    changed_by: "25",
    changed_by_role: "manager",
    actor: { id: "25", name: "Ravshan Ortiqov", role: "manager" },
    old_value: { status: "on the road" },
    new_value: { status: "waiting" },
    note: "Post received by branch",
    description: "TEST Claude Surxondaryo filiali pochtani qabul qildi",
    metadata: { post_id: "35", branch_name: "TEST Claude Surxondaryo filiali" },
  },
  {
    id: "r3",
    order_id: "96",
    action: "status_change",
    created_at: at(70),
    changed_by: "7",
    changed_by_role: "registrator",
    actor: { id: "7", name: "Bobur Xolmatov", role: "registrator" },
    old_value: { status: "waiting" },
    new_value: { status: "waiting" },
    metadata: { from_holder_type: "HQ", received_by: "101", source_type: "BRANCH", source_user_role: "manager" },
  },
];
