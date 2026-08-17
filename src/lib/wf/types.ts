export type Role =
  | "Admin"
  | "Warehouse Manager"
  | "Inventory Manager"
  | "Picking Manager"
  | "Packing Manager"
  | "QC Manager"
  | "Dispatcher"
  | "Picker"
  | "Packer"
  | "QC Operator";

export type Priority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type OrderStage =
  | "Created"
  | "Prioritized"
  | "Allocated"
  | "Picking"
  | "Packed"
  | "QC"
  | "Dispatched";

export type AllocationState = "Unallocated" | "Partial" | "Allocated" | "Backorder";

export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  zone: string;
  supplier: string;
  available: number;
  reserved: number;
  damaged: number;
  reorderPoint: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
}

export interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  allocated: number;
  picked: number;
}

export interface Order {
  id: string;
  customer: string;
  city: string;
  items: OrderItem[];
  value: number;
  createdAt: string;
  promisedAt: string;
  shipping: "Express" | "Standard" | "Economy";
  customerTier: "Prime" | "Business" | "Standard";
  stage: OrderStage;
  allocation: AllocationState;
  priority: Priority;
  score: number;
  reasons: string[];
  carrier: string;
  tracking?: string | undefined;
  atRisk: boolean;
  assignee?: string | undefined;
  qc?: "Passed" | "Failed" | "Needs Review" | undefined;
  packing?: undefined | { type: string; weight: number; station: string; checklist: string[] };
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  zone: string;
  shift: "Morning" | "Evening" | "Night";
  tasksCompleted: number;
  avgTaskMin: number;
  efficiency: number;
  status: "Active" | "On Break" | "Inactive";
  email: string;
}

export interface PickTask {
  id: string;
  orderId: string;
  picker: string;
  zone: string;
  route: string[];
  priority: Priority;
  etaMin: number;
  status: "Pending" | "Picking" | "Completed" | "Blocked";
  items: { sku: string; name: string; qty: number; picked: boolean; location: string }[];
}

export interface Txn {
  id: string;
  ts: string;
  sku: string;
  action: "Received" | "Allocated" | "Picked" | "Damaged" | "Restocked" | "Adjusted" | "Released";
  qty: number;
  reference: string;
  employee: string;
}

export type ExceptionType =
  | "Missing Item"
  | "Damaged Item"
  | "Stock Mismatch"
  | "Allocation Conflict"
  | "Delayed Order"
  | "Picking Issue"
  | "QC Failure"
  | "Dispatch Delay";

export interface WfException {
  id: string;
  type: ExceptionType;
  orderId?: string | undefined;
  sku?: string | undefined;
  problem: string;
  impact: string;
  recommendation: string;
  owner: string;
  slaMin: number;
  severity: "Critical" | "High" | "Normal";
  status: "Open" | "In Review" | "Resolved";
  createdAt: string;
  resolution?: string | undefined;
}

export interface Replenishment {
  id: string;
  sku: string;
  qty: number;
  status: "Requested" | "Approved" | "Received";
  createdAt: string;
  requestedBy: string;
}

export interface AuditLog {
  id: string;
  ts: string;
  user: string;
  action: string;
  entity: string;
  from?: string | undefined;
  to?: string | undefined;
}

export interface Notification {
  id: string;
  ts: string;
  kind: "critical" | "warning" | "info";
  title: string;
  body: string;
  read: boolean;
}

export interface WfState {
  products: Product[];
  orders: Order[];
  employees: Employee[];
  pickTasks: PickTask[];
  txns: Txn[];
  exceptions: WfException[];
  replenishments: Replenishment[];
  audit: AuditLog[];
  notifications: Notification[];
  currentUserId: string | null;
  updatedAt: string;
}
