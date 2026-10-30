import { describe, expect, test } from "bun:test";
import type { Schemas } from "@/lib/api/types";
import * as orders from "./orders";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute)).toISOString();
const rider = { id: "r1", user: { id: "u1", name: "Ter", phone: "+2341" } };
const row = (overrides: object = {}) => ({
  id: "o1", code: "KG-1", status: "READY", placedAt: at(0), acceptedAt: at(0),
  customerId: "c1", customer: { id: "c1", name: "Ada", phone: "+2342" },
  kitchenOrders: [], payments: [], totalNaira: 1000,
  riderId: null, rider: null, currentRiderAcceptedAt: null,
  assignmentCount: 0, reassignmentCount: 0,
  riderWait: { initialWaitSeconds: 1200, totalWaitSeconds: 1200, currentWaitSeconds: 1200, currentWaitStartedAt: at(0), measuredAt: at(20) },
  ...overrides,
}) as unknown as Schemas["AdminOrderListItemDto"];

describe("admin rider operations mapping", () => {
  test("preserves acceptance time and displays acceptance age", () => {
    const order = orders.liveOrder(row({ riderId: "r1", rider, currentRiderAcceptedAt: at(2), assignmentCount: 1 }), new Date(at(20)));
    expect(order.currentRiderAcceptedAt).toBe(at(2));
    expect(orders.riderOperationsView(order, new Date(at(20)))).toMatchObject({ name: "Ter", timing: "Accepted 18 min ago" });
  });

  test("advances live wait and accumulated wait without increasing the completed initial wait", () => {
    const order = orders.liveOrder(row({ assignmentCount: 2, reassignmentCount: 1,
      riderWait: { initialWaitSeconds: 120, totalWaitSeconds: 900, currentWaitSeconds: 600, currentWaitStartedAt: at(10), measuredAt: at(20) },
    }));
    expect(orders.riderOperationsView(order, new Date(at(21)))).toMatchObject({ name: "Waiting for rider", timing: "11 min", initialWaitLabel: "2 min", totalWaitLabel: "16 min", currentWaitLabel: "11 min", reassignmentLabel: "Reassigned 1×" });
  });

  test("keeps legacy rider fallback and never invents acceptance time or wait", () => {
    const order = orders.liveOrder(row({ riderId: "r1", rider: { ...rider, user: { ...rider.user, name: null } },
      riderWait: { initialWaitSeconds: null, totalWaitSeconds: 0, currentWaitSeconds: 0, currentWaitStartedAt: null, measuredAt: at(20) },
    }));
    expect(orders.riderOperationsView(order)).toMatchObject({ name: "+2341", timing: "Acceptance time unknown", initialWaitLabel: "Unknown", totalWaitLabel: "Unknown", reassignmentLabel: null });
  });

  test("marks recorded gaps as a lower bound when initial legacy wait is unknown", () => {
    const order = orders.liveOrder(row({ assignmentCount: 1,
      riderWait: { initialWaitSeconds: null, totalWaitSeconds: 180, currentWaitSeconds: 0, currentWaitStartedAt: null, measuredAt: at(20) },
    }));
    expect(orders.riderOperationsView(order).totalWaitLabel).toBe("At least 3 min");
  });

  test("does not advance a terminal wait", () => {
    const order = orders.liveOrder(row({ status: "CANCELLED", riderWait: { initialWaitSeconds: 120, totalWaitSeconds: 540, currentWaitSeconds: 0, currentWaitStartedAt: null, measuredAt: at(20) } }));
    expect(orders.riderOperationsView(order, new Date(at(30)))).toMatchObject({ name: "No rider assigned", totalWaitLabel: "9 min", currentWaitLabel: "—" });
  });

  test("filters pointer state independently of recorded reassignments", () => {
    const assigned = orders.liveOrder(row({ riderId: "r1", rider }));
    const waiting = orders.liveOrder(row({ assignmentCount: 2, reassignmentCount: 1 }));
    expect(orders.matchesRiderState(assigned, "ASSIGNED")).toBe(true);
    expect(orders.matchesRiderState(assigned, "UNASSIGNED")).toBe(false);
    expect(orders.matchesRiderState(assigned, "REASSIGNED")).toBe(false);
    expect(orders.matchesRiderState(waiting, "UNASSIGNED")).toBe(true);
    expect(orders.matchesRiderState(waiting, "ASSIGNED")).toBe(false);
    expect(orders.matchesRiderState(waiting, "REASSIGNED")).toBe(true);
    expect(orders.matchesRiderState(waiting, "ALL")).toBe(true);
  });

  test("retains every assignment, unknown legacy acceptance, reasons and notes in detail", () => {
    const detail = { ...row(), address: { line1: "12 Main", area: "Makurdi", instructions: null }, timeline: [], supportTickets: [],
      riderAssignments: [
        { id: "a", rider, status: "ABANDONED", acceptedAt: null, endedAt: at(5), abandonReason: "VEHICLE_PROBLEM", abandonNote: "Flat tyre" },
        { id: "b", rider, status: "ACTIVE", acceptedAt: at(8), endedAt: null, abandonReason: null, abandonNote: null },
      ],
    } as unknown as Schemas["AdminOrderDetailDto"];
    expect(orders.orderDetailView(detail).riderAssignments).toEqual([
      { id: "a", riderName: "Ter", status: "ABANDONED", acceptedAt: null, endedAt: at(5), reason: "Vehicle problem", note: "Flat tyre" },
      { id: "b", riderName: "Ter", status: "ACTIVE", acceptedAt: at(8), endedAt: null, reason: null, note: null },
    ]);
  });
});
