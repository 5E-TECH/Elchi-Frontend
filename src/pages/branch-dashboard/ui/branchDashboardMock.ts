export type BranchOrderSummary = {
  total: number;
  new: number;
  onTheRoad: number;
  delivered: number;
  returned: number;
};

export type BranchMarketSummary = {
  id: string;
  name: string;
  orders: number;
  amount: number;
};

export type BranchPackageSummary = {
  onTheWay: number;
  waiting: number;
};

export type BranchCourierSummary = {
  total: number;
  active: number;
};

export type BranchDashboardSnapshot = {
  branchName: string;
  orderSummary: BranchOrderSummary;
  markets: BranchMarketSummary[];
  packages: BranchPackageSummary;
  couriers: BranchCourierSummary;
};

export const branchDashboardMock: BranchDashboardSnapshot = {
  branchName: "Surxondaryo filiali",
  orderSummary: {
    total: 24,
    new: 5,
    onTheRoad: 12,
    delivered: 7,
    returned: 0,
  },
  markets: [
    { id: "1", name: "Premium", orders: 8, amount: 2150000 },
    { id: "2", name: "Baraka", orders: 6, amount: 1640000 },
    { id: "3", name: "Super", orders: 5, amount: 1390000 },
    { id: "4", name: "Fresh", orders: 3, amount: 820000 },
    { id: "5", name: "Express", orders: 2, amount: 470000 },
  ],
  packages: {
    onTheWay: 3,
    waiting: 1,
  },
  couriers: {
    total: 9,
    active: 6,
  },
};
