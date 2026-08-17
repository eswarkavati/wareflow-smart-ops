import type {
  Employee,
  Order,
  PickTask,
  Product,
  Txn,
  WfException,
  WfState,
  AuditLog,
  Notification,
} from "./types";
import type { GateEvent, InboundShipment } from "./types";
import { scoreOrder } from "./engine";

function buildInbound(now: number, products: Product[]): InboundShipment[] {
  const iso = (m: number) => new Date(now + m * 60000).toISOString();
  const line = (sku: string, expectedQty: number, receivedQty = 0, damagedQty = 0) => {
    const p = products.find((x) => x.sku === sku);
    return { sku, name: p?.name ?? sku, expectedQty, receivedQty, damagedQty };
  };
  return [
    {
      id: "INB-5001",
      po: "PO-88231",
      supplier: "Nexa Distributors",
      vehicleNo: "KA-01-AB-4412",
      driver: "Ravi Shetty",
      driverPhone: "+91 98450 11223",
      gate: "NORTH GATE",
      dock: "DOCK-IN-1",
      expectedAt: iso(-45),
      arrivedAt: iso(-38),
      status: "At Dock",
      lines: [line("WH-HEAD-001", 120), line("WH-CHG-004", 200), line("WH-CBLE-013", 400)],
      notes: "Priority inbound — replenishes critical headphone stock.",
    },
    {
      id: "INB-5002",
      po: "PO-88245",
      supplier: "Orbit Supply Co",
      vehicleNo: "MH-12-XY-7781",
      driver: "Suresh Pawar",
      driverPhone: "+91 99870 55410",
      gate: "SOUTH GATE",
      dock: "DOCK-IN-2",
      expectedAt: iso(30),
      status: "Scheduled",
      lines: [line("WH-MOUS-012", 150), line("WH-KEYB-003", 80)],
    },
    {
      id: "INB-5003",
      po: "PO-88250",
      supplier: "Aster Traders",
      vehicleNo: "TN-09-KL-2298",
      driver: "Ilango Murugan",
      driverPhone: "+91 90031 77812",
      gate: "NORTH GATE",
      dock: "DOCK-IN-3",
      expectedAt: iso(120),
      status: "Scheduled",
      lines: [line("WH-BOTL-029", 300), line("WH-YOGA-027", 120), line("WH-TSRT-022", 500)],
    },
    {
      id: "INB-5004",
      po: "PO-88198",
      supplier: "Vertex Industries",
      vehicleNo: "KA-05-MN-6633",
      driver: "Prakash Naik",
      driverPhone: "+91 97400 33221",
      gate: "SOUTH GATE",
      dock: "DOCK-IN-1",
      expectedAt: iso(-260),
      arrivedAt: iso(-250),
      receivedAt: iso(-205),
      status: "Received",
      lines: [line("WH-LAMP-016", 90, 90), line("WH-KETL-018", 60, 60)],
    },
    {
      id: "INB-5005",
      po: "PO-88203",
      supplier: "Nexa Distributors",
      vehicleNo: "AP-16-CD-9012",
      driver: "Vamsi Reddy",
      driverPhone: "+91 91000 22114",
      gate: "NORTH GATE",
      dock: "DOCK-IN-2",
      expectedAt: iso(-320),
      arrivedAt: iso(-310),
      receivedAt: iso(-268),
      status: "Discrepancy",
      lines: [line("WH-SPKR-007", 100, 94, 3), line("WH-PWRB-011", 150, 150)],
      notes: "Short receipt of 6 units logged against supplier claim.",
    },
  ];
}

function buildGateEvents(now: number): GateEvent[] {
  const iso = (m: number) => new Date(now + m * 60000).toISOString();
  return [
    {
      id: "GT-9001",
      gate: "NORTH GATE",
      vehicleNo: "KA-01-AB-4412",
      driver: "Ravi Shetty",
      transporter: "Nexa Logistics",
      purpose: "Inbound",
      shipmentId: "INB-5001",
      entryAt: iso(-38),
      status: "Inside",
      guard: "Balwinder Singh",
    },
    {
      id: "GT-9002",
      gate: "SOUTH GATE",
      vehicleNo: "KA-53-TR-1180",
      driver: "Anand Kumar",
      transporter: "Delhivery",
      purpose: "Outbound",
      entryAt: iso(-22),
      status: "Inside",
      guard: "Meera Krishnan",
    },
    {
      id: "GT-9003",
      gate: "NORTH GATE",
      vehicleNo: "KA-41-BD-7712",
      driver: "Farhan Ali",
      transporter: "Blue Dart",
      purpose: "Outbound",
      entryAt: iso(-140),
      exitAt: iso(-96),
      status: "Exited",
      guard: "Balwinder Singh",
    },
    {
      id: "GT-9004",
      gate: "SOUTH GATE",
      vehicleNo: "KA-05-MN-6633",
      driver: "Prakash Naik",
      transporter: "Vertex Transport",
      purpose: "Inbound",
      shipmentId: "INB-5004",
      entryAt: iso(-250),
      exitAt: iso(-190),
      status: "Exited",
      guard: "Meera Krishnan",
    },
    {
      id: "GT-9005",
      gate: "NORTH GATE",
      vehicleNo: "KA-02-SV-3390",
      driver: "Mahesh Gowda",
      transporter: "Facilities",
      purpose: "Service",
      entryAt: iso(-64),
      status: "Inside",
      guard: "Balwinder Singh",
    },
    {
      id: "GT-9006",
      gate: "SOUTH GATE",
      vehicleNo: "AP-16-CD-9012",
      driver: "Vamsi Reddy",
      transporter: "Nexa Logistics",
      purpose: "Inbound",
      shipmentId: "INB-5005",
      entryAt: iso(-310),
      exitAt: iso(-255),
      status: "Exited",
      guard: "Meera Krishnan",
    },
  ];
}

// Deterministic pseudo-random so seeded data is stable and realistic.
let s = 20250817;
const rnd = () => {
  s = (s * 1664525 + 1013904223) % 4294967296;
  return s / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]!;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const CATALOG: [string, string, string, number][] = [
  ["WH-HEAD-001", "Wireless Headphones", "Electronics", 4499],
  ["WH-HEAD-002", "Noise Cancelling Headphones", "Electronics", 8999],
  ["WH-KEYB-003", "Mechanical Keyboard", "Electronics", 5299],
  ["WH-CHG-004", "USB-C Fast Charger 65W", "Accessories", 1899],
  ["WH-WTCH-005", "Smart Watch Series 6", "Electronics", 11999],
  ["WH-STND-006", "Aluminium Laptop Stand", "Office", 2299],
  ["WH-SPKR-007", "Bluetooth Speaker", "Electronics", 3499],
  ["WH-SHOE-008", "Running Shoes", "Sports", 3999],
  ["WH-BAGS-009", "Office Backpack", "Fashion", 2499],
  ["WH-MNTR-010", "27\" 4K Monitor", "Electronics", 24999],
  ["WH-PWRB-011", "Power Bank 20000mAh", "Accessories", 2199],
  ["WH-MOUS-012", "Wireless Ergonomic Mouse", "Electronics", 1799],
  ["WH-CBLE-013", "Braided USB-C Cable 2m", "Accessories", 499],
  ["WH-DESK-014", "Standing Desk Converter", "Office", 8499],
  ["WH-CHR-015", "Ergonomic Office Chair", "Office", 13999],
  ["WH-LAMP-016", "LED Desk Lamp", "Home & Kitchen", 1499],
  ["WH-BLND-017", "Personal Blender", "Home & Kitchen", 2799],
  ["WH-KETL-018", "Electric Kettle 1.7L", "Home & Kitchen", 1699],
  ["WH-COOK-019", "Non-Stick Cookware Set", "Home & Kitchen", 4599],
  ["WH-AIRF-020", "Air Fryer 4L", "Home & Kitchen", 6499],
  ["WH-VACM-021", "Cordless Vacuum Cleaner", "Home & Kitchen", 15999],
  ["WH-TSRT-022", "Cotton Crew T-Shirt", "Fashion", 799],
  ["WH-JCKT-023", "Windbreaker Jacket", "Fashion", 2999],
  ["WH-JEAN-024", "Slim Fit Jeans", "Fashion", 1999],
  ["WH-WLLT-025", "Leather Wallet", "Fashion", 1299],
  ["WH-SUNG-026", "Polarized Sunglasses", "Fashion", 1599],
  ["WH-YOGA-027", "Yoga Mat 6mm", "Sports", 1199],
  ["WH-DUMB-028", "Adjustable Dumbbell 20kg", "Sports", 5499],
  ["WH-BOTL-029", "Insulated Water Bottle", "Sports", 899],
  ["WH-CYCL-030", "Cycling Helmet", "Sports", 2399],
  ["WH-TENT-031", "2-Person Camping Tent", "Sports", 6999],
  ["WH-NOTE-032", "Hardbound Notebook A5", "Office", 349],
  ["WH-PENS-033", "Gel Pen Pack (10)", "Office", 249],
  ["WH-PRNT-034", "Wireless Laser Printer", "Office", 12999],
  ["WH-PAPR-035", "A4 Copier Paper Ream", "Office", 399],
  ["WH-SSD-036", "1TB Portable SSD", "Electronics", 7999],
  ["WH-ROUT-037", "Wi-Fi 6 Router", "Electronics", 4299],
  ["WH-WEBC-038", "1080p Webcam", "Electronics", 2699],
  ["WH-MIC-039", "USB Condenser Microphone", "Electronics", 4999],
  ["WH-TABL-040", "10\" Android Tablet", "Electronics", 15499],
  ["WH-EARB-041", "True Wireless Earbuds", "Electronics", 2999],
  ["WH-CASE-042", "Rugged Phone Case", "Accessories", 699],
  ["WH-SCRN-043", "Tempered Glass Protector", "Accessories", 299],
  ["WH-HUB-044", "7-in-1 USB-C Hub", "Accessories", 2899],
  ["WH-STYL-045", "Active Stylus Pen", "Accessories", 1999],
  ["WH-SDCD-046", "128GB microSD Card", "Accessories", 1099],
  ["WH-TRAV-047", "Cabin Trolley Bag", "Fashion", 4499],
  ["WH-ORGN-048", "Desk Organizer Tray", "Office", 899],
  ["WH-HUMD-049", "Ultrasonic Humidifier", "Home & Kitchen", 2299],
  ["WH-COFF-050", "Espresso Coffee Maker", "Home & Kitchen", 9499],
  ["WH-GRIL-051", "Electric Sandwich Grill", "Home & Kitchen", 1899],
  ["WH-FITB-052", "Fitness Band", "Electronics", 2499],
];

const SUPPLIERS = [
  "Meridian Distribution",
  "Northgate Supply Co.",
  "Vertex Global Trading",
  "Sunrise Import House",
  "Kavery Logistics Supply",
];
const ZONES = ["A-12", "A-15", "B-03", "B-07", "C-02", "C-09", "D-04"];

const CUSTOMERS = [
  ["Priya Sharma", "Bengaluru"],
  ["Rohit Verma", "Pune"],
  ["Aisha Khan", "Hyderabad"],
  ["Daniel Mathews", "Chennai"],
  ["Sneha Iyer", "Kochi"],
  ["Arjun Nair", "Mumbai"],
  ["Meera Kapoor", "Delhi"],
  ["Vikram Reddy", "Vijayawada"],
  ["Neha Gupta", "Jaipur"],
  ["Karan Malhotra", "Chandigarh"],
  ["Ananya Bose", "Kolkata"],
  ["Farhan Ali", "Lucknow"],
  ["Divya Menon", "Coimbatore"],
  ["Sameer Joshi", "Nagpur"],
  ["Tanvi Desai", "Ahmedabad"],
  ["Harsh Patel", "Surat"],
  ["Ritika Singh", "Bhopal"],
  ["Nikhil Rao", "Mysuru"],
  ["Pooja Chauhan", "Indore"],
  ["Manav Gill", "Ludhiana"],
];

const CARRIERS = ["Delhivery", "Blue Dart", "DTDC", "Ekart"];

const EMPLOYEES: Employee[] = [
  ["Anita Deshpande", "Admin", "HQ"],
  ["Rajesh Menon", "Warehouse Manager", "All"],
  ["Sunita Rao", "Inventory Manager", "All"],
  ["Vivek Sharma", "Picking Manager", "A"],
  ["Neelam Kaur", "Packing Manager", "PACK-1"],
  ["Imran Sheikh", "QC Manager", "QC-1"],
  ["Deepak Chauhan", "Dispatcher", "DOCK"],
  ["Rahul Kumar", "Picker", "A-12"],
  ["Sanjay Patil", "Picker", "A-15"],
  ["Kavya Nair", "Picker", "B-03"],
  ["Mohit Bansal", "Picker", "C-02"],
  ["Lakshmi Iyer", "Picker", "C-09"],
  ["Prakash Yadav", "Packer", "PACK-1"],
  ["Rekha Sinha", "Packer", "PACK-2"],
  ["Ajay Thomas", "QC Operator", "QC-1"],
  ["Fatima Rizvi", "QC Operator", "QC-2"],
  ["Gaurav Mishra", "Picker", "D-04"],
  ["Balwinder Singh", "Gate Manager", "NORTH GATE"],
  ["Meera Krishnan", "Gate Manager", "SOUTH GATE"],
].map(([name, role, zone], i) => ({
  id: `EMP-${1001 + i}`,
  name: name!,
  role: role as Employee["role"],
  zone: zone!,
  shift: (["Morning", "Evening", "Night"] as const)[i % 3]!,
  tasksCompleted: 40 + ((i * 37) % 220),
  avgTaskMin: 4 + ((i * 3) % 11),
  efficiency: 78 + ((i * 7) % 21),
  status: i === 16 ? "On Break" : "Active",
  email: `${name!.toLowerCase().split(" ")[0]}@wareflow.demo`,
}));

export const DEMO_ACCOUNTS = [
  { email: "admin@wareflow.demo", id: "EMP-1001" },
  { email: "manager@wareflow.demo", id: "EMP-1002" },
  { email: "inventory@wareflow.demo", id: "EMP-1003" },
  { email: "picker@wareflow.demo", id: "EMP-1008" },
  { email: "balwinder@wareflow.demo", id: "EMP-1018" },
];

function buildProducts(): Product[] {
  return CATALOG.map(([sku, name, category, price], i) => {
    const demand = int(6, 40);
    const lead = int(2, 5);
    const safety = int(10, 30);
    let available = int(0, 240);
    if (i % 9 === 3) available = int(0, 8);
    if (i % 11 === 5) available = 0;
    return {
      sku: sku!,
      name: name!,
      category: category!,
      price: price!,
      zone: ZONES[i % ZONES.length]!,
      supplier: SUPPLIERS[i % SUPPLIERS.length]!,
      available,
      reserved: int(0, 24),
      damaged: rnd() > 0.75 ? int(1, 4) : 0,
      reorderPoint: Math.round(demand * lead * 0.6 + safety),
      avgDailyDemand: demand,
      leadTimeDays: lead,
      safetyStock: safety,
    };
  });
}

export function buildSeed(): WfState {
  const now = Date.now();
  const products = buildProducts();
  const iso = (msOffset: number) => new Date(now + msOffset).toISOString();

  // Demo scenario anchor: WH-HEAD-001 has exactly 7 available.
  const head = products.find((p) => p.sku === "WH-HEAD-001")!;
  head.available = 7;
  head.reserved = 18;
  head.damaged = 2;
  head.reorderPoint = 20;
  const chg = products.find((p) => p.sku === "WH-CHG-004")!;
  chg.available = 12;
  chg.reorderPoint = 30;
  chg.avgDailyDemand = 18;
  const head2 = products.find((p) => p.sku === "WH-HEAD-002")!;
  head2.available = 8;

  const orders: Order[] = [];
  const mkOrder = (
    n: number,
    over: Partial<Order> & { itemSpec?: [string, number][] },
  ): Order => {
    const [customer, city] = CUSTOMERS[n % CUSTOMERS.length]!;
    const spec =
      over.itemSpec ??
      Array.from({ length: int(1, 4) }, () => {
        const p = pick(products);
        return [p.sku, int(1, 3)] as [string, number];
      });
    const items = spec.map(([sku, qty]) => {
      const p = products.find((x) => x.sku === sku)!;
      return { sku, name: p.name, qty, allocated: 0, picked: 0 };
    });
    const value = items.reduce(
      (sum, it) => sum + it.qty * products.find((p) => p.sku === it.sku)!.price,
      0,
    );
    const createdMin = int(20, 400);
    const promisedMin = int(-40, 420);
    const base: Order = {
      id: `ORD-${10470 + n}`,
      customer: customer!,
      city: city!,
      items,
      value,
      createdAt: iso(-createdMin * 60000),
      promisedAt: iso(promisedMin * 60000),
      shipping: pick(["Express", "Standard", "Standard", "Economy"] as const),
      customerTier: pick(["Prime", "Standard", "Standard", "Business"] as const),
      stage: "Created",
      allocation: "Unallocated",
      priority: "NORMAL",
      score: 0,
      reasons: [],
      carrier: pick(CARRIERS),
      atRisk: false,
      ...over,
    };
    delete (base as unknown as Record<string, unknown>)["itemSpec"];
    return base;
  };

  // The hero demo conflict.
  orders.push(
    mkOrder(12, {
      id: "ORD-10482",
      customer: "Priya Sharma",
      city: "Bengaluru",
      itemSpec: [
        ["WH-HEAD-001", 10],
        ["WH-CHG-004", 1],
        ["WH-STND-006", 1],
      ],
      shipping: "Express",
      customerTier: "Prime",
      createdAt: iso(-95 * 60000),
      promisedAt: iso(45 * 60000),
      stage: "Created",
      allocation: "Unallocated",
    }),
  );
  orders.push(
    mkOrder(25, {
      id: "ORD-10495",
      customer: "Karan Malhotra",
      city: "Chandigarh",
      itemSpec: [["WH-HEAD-001", 5]],
      shipping: "Standard",
      customerTier: "Standard",
      createdAt: iso(-60 * 60000),
      promisedAt: iso(360 * 60000),
      stage: "Created",
      allocation: "Unallocated",
    }),
  );

  const stages: Order["stage"][] = [
    "Created",
    "Created",
    "Allocated",
    "Allocated",
    "Picking",
    "Picking",
    "Packed",
    "QC",
    "Dispatched",
    "Dispatched",
  ];
  for (let n = 0; n < 34; n++) {
    const id = `ORD-${10470 + n}`;
    if (id === "ORD-10482" || id === "ORD-10495") continue;
    const stage = stages[n % stages.length]!;
    const o = mkOrder(n, { id, stage });
    if (stage !== "Created") {
      o.allocation = "Allocated";
      o.items.forEach((it) => (it.allocated = it.qty));
    }
    if (stage === "Picking") o.items.forEach((it, i) => (it.picked = i === 0 ? it.qty : 0));
    if (stage === "Packed" || stage === "QC" || stage === "Dispatched") {
      o.items.forEach((it) => (it.picked = it.qty));
      o.packing = {
        type: pick(["Small Box", "Medium Box", "Large Box", "Poly Mailer"]),
        weight: Math.round((0.4 + rnd() * 4) * 10) / 10,
        station: pick(["PACK-1", "PACK-2"]),
        checklist: ["Items scanned", "Quantity verified", "Packaging selected"],
      };
    }
    if (stage === "QC") o.qc = "Needs Review";
    if (stage === "Dispatched") {
      o.qc = "Passed";
      o.tracking = `${o.carrier.slice(0, 2).toUpperCase()}${int(100000000, 999999999)}`;
    }
    orders.push(o);
  }
  orders.sort((a, b) => a.id.localeCompare(b.id));
  orders.forEach((o) => Object.assign(o, scoreOrder(o, products)));

  const pickTasks: PickTask[] = orders
    .filter((o) => o.stage === "Allocated" || o.stage === "Picking")
    .map((o, i) => ({
      id: `PT-${3001 + i}`,
      orderId: o.id,
      picker: EMPLOYEES.filter((e) => e.role === "Picker")[i % 6]!.name,
      zone: products.find((p) => p.sku === o.items[0]!.sku)!.zone,
      route: [...new Set(o.items.map((it) => products.find((p) => p.sku === it.sku)!.zone))],
      priority: o.priority,
      etaMin: 5 + o.items.length * 3,
      status: o.stage === "Picking" ? "Picking" : "Pending",
      items: o.items.map((it) => ({
        sku: it.sku,
        name: it.name,
        qty: it.qty,
        picked: it.picked >= it.qty,
        location: products.find((p) => p.sku === it.sku)!.zone,
      })),
    }));

  const txns: Txn[] = [];
  let t = 0;
  for (const o of orders.slice(0, 18)) {
    for (const it of o.items.slice(0, 2)) {
      txns.push({
        id: `TX-${9000 + t++}`,
        ts: iso(-int(10, 600) * 60000),
        sku: it.sku,
        action: o.stage === "Created" ? "Received" : "Allocated",
        qty: o.stage === "Created" ? it.qty * 4 : -it.qty,
        reference: o.id,
        employee: pick(EMPLOYEES).name,
      });
    }
  }
  txns.sort((a, b) => b.ts.localeCompare(a.ts));

  const exceptions: WfException[] = [
    {
      id: "EXC-2001",
      type: "Stock Mismatch",
      orderId: "ORD-10482",
      sku: "WH-HEAD-001",
      problem: "Order requires 10 × Wireless Headphones; only 7 units available.",
      impact: "Critical order at risk of missing 16:30 SLA.",
      recommendation: "Allocate 7 units now and raise a backorder for the remaining 3.",
      owner: "Sunita Rao",
      slaMin: 45,
      severity: "Critical",
      status: "Open",
      createdAt: iso(-18 * 60000),
    },
    {
      id: "EXC-2002",
      type: "Damaged Item",
      sku: "WH-SPKR-007",
      problem: "2 Bluetooth Speakers found with crushed packaging in Zone B-03.",
      impact: "Sellable stock reduced by 2 units.",
      recommendation: "Move to damaged bin and trigger supplier claim.",
      owner: "Sunita Rao",
      slaMin: 240,
      severity: "Normal",
      status: "Open",
      createdAt: iso(-140 * 60000),
    },
    {
      id: "EXC-2003",
      type: "Picking Issue",
      orderId: "ORD-10476",
      problem: "Zone C pick times 21% above warehouse average.",
      impact: "6 orders queued behind Zone C picks.",
      recommendation: "Reassign 2 pickers from Zone A to Zone C.",
      owner: "Vivek Sharma",
      slaMin: 90,
      severity: "High",
      status: "Open",
      createdAt: iso(-52 * 60000),
    },
    {
      id: "EXC-2004",
      type: "QC Failure",
      orderId: "ORD-10478",
      problem: "Shipping label mismatch detected at QC-2.",
      impact: "Order held before dispatch.",
      recommendation: "Reprint label and re-run QC checklist.",
      owner: "Imran Sheikh",
      slaMin: 60,
      severity: "High",
      status: "Open",
      createdAt: iso(-33 * 60000),
    },
    {
      id: "EXC-2005",
      type: "Delayed Order",
      orderId: "ORD-10471",
      problem: "Order past promised time by 40 minutes.",
      impact: "SLA breach recorded against Prime customer.",
      recommendation: "Escalate to Warehouse Manager and expedite dispatch.",
      owner: "Rajesh Menon",
      slaMin: 30,
      severity: "Critical",
      status: "In Review",
      createdAt: iso(-70 * 60000),
    },
    {
      id: "EXC-2006",
      type: "Missing Item",
      orderId: "ORD-10474",
      sku: "WH-CBLE-013",
      problem: "Picker could not locate 1 × Braided USB-C Cable at B-07.",
      impact: "Partial shipment risk.",
      recommendation: "Cycle count B-07 and substitute from overflow rack.",
      owner: "Vivek Sharma",
      slaMin: 45,
      severity: "High",
      status: "Open",
      createdAt: iso(-24 * 60000),
    },
    {
      id: "EXC-2007",
      type: "Dispatch Delay",
      orderId: "ORD-10479",
      problem: "Blue Dart pickup delayed by 35 minutes at Dock 2.",
      impact: "4 packed orders waiting handover.",
      recommendation: "Reroute to Delhivery evening run.",
      owner: "Deepak Chauhan",
      slaMin: 60,
      severity: "Normal",
      status: "Open",
      createdAt: iso(-15 * 60000),
    },
    {
      id: "EXC-2008",
      type: "Allocation Conflict",
      sku: "WH-HEAD-002",
      problem: "3 open orders competing for 8 remaining units.",
      impact: "Two orders will require backorder.",
      recommendation: "Allocate by priority score, backorder the lowest.",
      owner: "Sunita Rao",
      slaMin: 120,
      severity: "High",
      status: "Open",
      createdAt: iso(-8 * 60000),
    },
  ];

  const audit: AuditLog[] = [
    {
      id: "AUD-1",
      ts: iso(-200 * 60000),
      user: "Anita Deshpande",
      action: "Changed Role",
      entity: "Rahul Kumar",
      from: "Picker",
      to: "Picker",
    },
    {
      id: "AUD-2",
      ts: iso(-120 * 60000),
      user: "Sunita Rao",
      action: "Stock Adjusted",
      entity: "WH-SPKR-007",
      from: "34",
      to: "32",
    },
    {
      id: "AUD-3",
      ts: iso(-60 * 60000),
      user: "Rajesh Menon",
      action: "Order Dispatched",
      entity: "ORD-10473",
      from: "QC Passed",
      to: "Dispatched",
    },
  ];

  const notifications: Notification[] = [
    {
      id: "N-1",
      ts: iso(-4 * 60000),
      kind: "critical",
      title: "Inventory conflict on ORD-10482",
      body: "10 units required, 7 available. Allocation decision needed.",
      read: false,
    },
    {
      id: "N-2",
      ts: iso(-11 * 60000),
      kind: "warning",
      title: "SKU WH-HEAD-002 low",
      body: "Only 8 units remaining against 3 open orders.",
      read: false,
    },
    {
      id: "N-3",
      ts: iso(-26 * 60000),
      kind: "warning",
      title: "Zone C picking slower than average",
      body: "Pick time 21% above warehouse baseline.",
      read: false,
    },
    {
      id: "N-4",
      ts: iso(-48 * 60000),
      kind: "info",
      title: "Shift handover complete",
      body: "Morning shift closed with 214 orders fulfilled.",
      read: true,
    },
  ];

  return {
    products,
    orders,
    employees: EMPLOYEES,
    pickTasks,
    txns,
    exceptions,
    replenishments: [],
    audit,
    notifications,
    inbound: buildInbound(now, products),
    gateEvents: buildGateEvents(now),
    currentUserId: null,
    updatedAt: new Date(now).toISOString(),
  };
}
