export interface Task {
  id: string | number;

  categoryId?: string;
  categoryName: string;
  title: string;
  description: string;
  deliveryCriteria: string;

  estimatedDurationMinutes: number;
  wageBudgetAmount: number;
  itemCostCapAmount: number | null;
  currencyCode?: string;

  goodsPurchaseRequired: boolean;
  invoiceRequired: boolean;

  executionStartTime: string;
  executionWindowEndAt: string;
  proposalDeadlineAt: string;

  urgency?: "normal" | "urgent";
  locationMode: "fixed" | "route";

  locationCity?: string;
  locationRegion?: string;
  locationAddress?: string;

  originCity?: string;
  originRegion?: string;
  originAddress?: string;

  destinationCity?: string;
  destinationRegion?: string;
  destinationAddress?: string;

  icon?: "router" | "broom" | "boxes" | "pin" | "spark" | "search";
}
