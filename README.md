# Lovable Operations Hub

# Build a Production-Style Smart Warehouse Operations Platform

Build a polished, realistic, enterprise-grade **Smart Warehouse Operations & Order Fulfillment Platform** for a large e-commerce warehouse.

This is a **6-hour hackathon prototype**, so prioritize:

* Working workflows
* Decision-making logic
* Realistic warehouse behavior
* Excellent UI/UX
* Smooth interactions
* Clear information hierarchy
* Realistic sample data
* Role-based access
* Exception handling
* A polished enterprise appearance

Do NOT make this look like a generic AI-generated CRUD dashboard.

The product should feel like an internal warehouse operations system that a company could actually use.

Use realistic **Amazon-scale e-commerce sample data and product/order patterns**, but DO NOT claim that the data is live Amazon data or use private Amazon APIs. Use realistic synthetic/mock data inspired by a large e-commerce warehouse.

---

# PRODUCT NAME

Use the product name:

**WAREFLOW**

Subtitle:

**Intelligent Warehouse Operations & Fulfillment**

Create a professional enterprise SaaS identity around WAREFLOW.

---

# CORE PRODUCT IDEA

WAREFLOW is an intelligent warehouse control platform that helps warehouse managers and operators:

1. Monitor inventory
2. Manage incoming orders
3. Determine order priority
4. Allocate limited inventory intelligently
5. Optimize picking
6. Manage packing
7. Perform quality checks
8. Handle damaged/missing items
9. Track dispatch
10. Detect operational bottlenecks
11. Recommend replenishment
12. Manage warehouse employees
13. Manage managers/sub-admins
14. Resolve exceptions
15. Monitor the entire fulfillment lifecycle

The most important differentiator:

**The system must make operational decisions, not merely display information.**

---

# PRIMARY WORKFLOW

Implement this complete workflow:

Order Created
→ Priority Determined
→ Inventory Checked
→ Allocation Decision
→ Picking
→ Packing
→ Quality Check
→ Dispatch
→ Inventory Updated

Also implement:

Exception
→ Decision
→ Resolution

Every important action should update the relevant data throughout the application.

---

# DESIGN PHILOSOPHY

The UI must be:

* Minimal
* Professional
* Clean
* Enterprise-grade
* Information-dense but NOT cluttered
* Easy to understand within 5 seconds
* Responsive
* Fast
* Consistent

Avoid putting too many cards, charts, numbers, tables and paragraphs on every page.

Each page should have:

* One clear primary purpose
* One primary action
* Important information first
* Secondary information hidden behind tabs, drawers, filters or detail views

Think of products like modern enterprise operations software rather than a student dashboard.

Use:

* Clean sidebar
* Compact top navigation
* Consistent spacing
* Professional typography
* Subtle borders
* Soft shadows
* Status badges
* Data tables
* Slide-over detail panels
* Confirmation dialogs
* Toast notifications
* Empty states
* Loading states
* Error states

Do NOT use excessive gradients, huge hero sections, excessive rounded cards, unnecessary animations or flashy AI visuals.

---

# COLOR SYSTEM

Use a professional warehouse/operations theme.

Primary:

* Deep navy / dark blue
* Professional blue accent

Status colors:

Green:

* Healthy
* Completed
* In Stock
* Dispatched

Amber:

* Warning
* Low Stock
* Delayed
* Pending

Red:

* Critical
* Out of Stock
* Damaged
* Failed

Blue:

* Processing
* Picking
* Packing
* In Transit

Gray:

* Neutral
* Inactive
* Archived

Keep colors subtle and consistent.

---

# APPLICATION STRUCTURE

Create these main sections:

1. Overview
2. Orders
3. Inventory
4. Allocation
5. Picking
6. Packing & QC
7. Dispatch
8. Exceptions
9. Replenishment
10. Analytics
11. Employees
12. Users & Roles
13. Settings

Do not make every section visually identical.

Each section should have its own operational purpose.

---

# 1. OVERVIEW / CONTROL TOWER

Create a warehouse command center.

At the top:

**Warehouse Control Tower**

Show:

* Warehouse selector
* Date/time
* Current operational status
* Search
* Notifications
* User profile

Primary KPI strip:

* Orders Today
* Pending Orders
* Orders at Risk
* Low Stock SKUs
* Picking Queue
* Dispatch Due
* Exceptions

Do not show 15+ KPI cards.

Only show the most important 6-7.

Below that create:

### Order Flow

Visualize:

Orders
→ Allocated
→ Picking
→ Packing
→ QC
→ Dispatch

Show count at each stage.

### Priority Queue

Show the most important orders requiring attention.

Example:

ORDER #ORD-10482
Priority: CRITICAL
Customer: Priya Sharma
Items: 4
Promised By: 16:30
Status: Allocation Required

Actions:

* View
* Allocate
* Escalate

### Operational Alerts

Examples:

"12 orders at risk of missing SLA"

"SKU WH-HEAD-002 has only 8 units remaining"

"Picking zone C is 18% slower than average"

"3 damaged items awaiting resolution"

### Warehouse Health

Show a simple operational health score:

**92 / 100 — Healthy**

Breakdown:

Inventory: Healthy
Picking: Healthy
Packing: Warning
Dispatch: Healthy

---

# 2. ORDERS

Create a professional order management page.

Top:

Orders

Search orders...

Filters:

* All
* Critical
* High
* Normal
* Delayed
* Unallocated
* Picking
* Packing
* Dispatched

Table columns:

* Order ID
* Customer
* Items
* Priority
* SLA
* Allocation
* Fulfillment Status
* Created
* Actions

Example realistic orders:

ORD-10482
ORD-10483
ORD-10484
ORD-10485

Customers should have realistic names.

Products should look like real e-commerce products:

* Wireless Headphones
* Mechanical Keyboard
* USB-C Charger
* Smart Watch
* Laptop Stand
* Bluetooth Speaker
* Running Shoes
* Office Backpack
* Monitor
* Power Bank

Clicking an order opens a detailed slide-over panel.

Order detail should show:

Customer
Order Items
Quantity
Inventory Availability
Priority
SLA
Allocation
Picking Status
Packing Status
QC Status
Dispatch Status

Show a visual timeline:

Created
→ Prioritized
→ Allocated
→ Picking
→ Packed
→ QC
→ Dispatched

---

# 3. SMART PRIORITY ENGINE

Implement actual decision logic.

Every order receives a priority score.

Example factors:

Urgency / SLA
Customer priority
Order age
Inventory availability
Order value
Shipping method

Example scoring:

Priority Score =
SLA urgency +
customer priority +
order age +
shipping urgency +
inventory feasibility

Classify:

90-100 = Critical
70-89 = High
40-69 = Normal
0-39 = Low

Show:

**Why this order is Critical**

Example:

SLA expires in 45 minutes
+
Express shipping
+
Inventory available
===================

Critical Priority

Do not just display the priority.

Explain the decision.

---

# 4. SMART INVENTORY ALLOCATION

This is one of the MOST IMPORTANT hackathon features.

Create a page called:

**Allocation Center**

Show orders waiting for allocation.

Example scenario:

URGENT ORDER
ORD-10482

Required:
10 × Wireless Headphones

Available:
7 units

Another lower-priority order:

ORD-10495

Required:
5 units

Available:
7 units

The system should make a recommendation.

Example:

### Recommended Decision

Reserve 7 units for ORD-10482

Reason:

Critical SLA
Higher priority
Partial fulfillment possible
Lower-priority order can be delayed

Show:

**Allocation Confidence: 94%**

Buttons:

* Accept Recommendation
* Modify Allocation
* Split Allocation
* Backorder
* Escalate

When the user accepts:

Update inventory
Update order status
Create allocation record
Update affected lower-priority order
Create an audit log

This must actually work.

---

# 5. INVENTORY

Create a professional inventory management page.

Filters:

* All
* Healthy
* Low Stock
* Out of Stock
* Reserved
* Damaged
* Overstock

Search:

Search SKU, product or category

Table:

SKU
Product
Category
Warehouse Zone
Available
Reserved
Damaged
Reorder Point
Status

Example:

SKU:
WH-HEAD-001

Product:
Wireless Headphones

Available:
42

Reserved:
18

Damaged:
2

Reorder Point:
20

Status:
Healthy

Click inventory item.

Show:

Inventory Overview
Stock Movement
Reserved Quantity
Available Quantity
Damaged Quantity
Reorder Point
Supplier
Recent Transactions

---

# 6. INVENTORY MOVEMENT

Every inventory change must create a transaction.

Examples:

+20 Received
-5 Allocated
-2 Picked
-1 Damaged
+10 Restocked

Create an inventory ledger.

Columns:

Timestamp
SKU
Action
Quantity
Reference
Employee

Example:

14:21
WH-HEAD-001
Allocated
-7
ORD-10482
Rahul K.

This makes the prototype feel like a real operational system.

---

# 7. LOW STOCK & REPLENISHMENT

Create a dedicated:

**Replenishment Center**

Detect:

* Low stock
* Critical stock
* Out of stock
* Overstock

Calculate:

Reorder Point

based on:

Average daily demand
+
Lead time
+
Safety stock

Example:

Average daily demand: 24
Lead time: 3 days
Safety stock: 20

Recommended reorder:

92 units

Show:

### Smart Recommendation

SKU: WH-CHG-004

Current stock: 12
Reorder point: 30
Average daily demand: 18

Recommended order:
**72 units**

Buttons:

* Create Purchase Request
* Ignore
* Adjust Quantity

---

# 8. PICKING

Create:

**Picking Operations**

Show:

Picking Queue

Each picking task contains:

Order ID
Picker
Zone
Items
Priority
Estimated Time
Status

Statuses:

Pending
Picking
Completed
Blocked

Create a picking task detail.

Example:

Order:
ORD-10482

Picker:
Rahul Kumar

Zone:
A-12

Items:

Wireless Headphones × 2
USB-C Charger × 1
Laptop Stand × 1

Show a simple warehouse location:

A-12 → A-15 → B-03

Create:

**Pick Route Recommendation**

"Optimized route reduces walking distance by approximately 18%."

Button:

**Start Picking**

Then:

Mark Item Picked

If item is missing:

**Report Missing Item**

This should automatically create an exception.

---

# 9. PACKING

Create:

**Packing Station**

Show active packing tasks.

For each order:

Order ID
Items
Packaging Type
Weight
Station
Status

Example:

ORD-10482

Packaging:
Medium Box

Weight:
1.8 kg

Packing checklist:

✓ Items scanned
✓ Quantity verified
✓ Packaging selected
○ Final seal

Button:

**Complete Packing**

---

# 10. QUALITY CHECK

Create QC workflow.

Before dispatch:

Verify:

* Correct items
* Correct quantity
* Item condition
* Packaging
* Shipping label

Show:

QC Status

Passed
Failed
Needs Review

If QC fails:

Automatically create an exception.

---

# 11. EXCEPTIONS CENTER

This should be a major differentiator.

Create:

**Exception Command Center**

Categories:

* Missing Item
* Damaged Item
* Stock Mismatch
* Allocation Conflict
* Delayed Order
* Picking Issue
* QC Failure
* Dispatch Delay

Each exception should show:

Problem
Impact
Recommended Action
Owner
SLA
Status

Example:

### STOCK MISMATCH

Order:
ORD-10482

Expected:
10

Available:
7

Impact:
Order at risk

Recommended Action:
Allocate 7 units and create backorder for 3.

Actions:

Accept
Modify
Escalate
Resolve

Workflow:

Exception
→ Decision
→ Resolution

When resolved:

Create audit event.

---

# 12. DISPATCH

Create:

**Dispatch Center**

Show:

Ready to Dispatch
Packed
QC Passed
Label Generated
Dispatched
Delayed

Table:

Order
Carrier
Tracking
Dispatch SLA
Status

Use realistic carrier names such as:

Delhivery
Blue Dart
DTDC
Ekart

These can be mock carriers.

Do not use real APIs.

Click dispatch.

Show:

Order timeline

Packed
→ QC Passed
→ Label Created
→ Handover
→ Dispatched

Button:

**Mark as Dispatched**

Update order and inventory accordingly.

---

# 13. ANALYTICS

Create a clean analytics section.

Do NOT overload it with charts.

Focus on operational decisions.

Show:

### Fulfillment Performance

Orders processed
On-time fulfillment %
Average fulfillment time
SLA breach %
First-pass QC rate

### Bottleneck Analysis

Identify the slowest operational stage.

Example:

Picking:
12 min average

Packing:
6 min

QC:
3 min

Dispatch:
5 min

Highlight:

**Picking is currently the primary bottleneck.**

Reason:

Zone C processing time increased by 22%.

Recommendation:

"Reassign 2 pickers from Zone A to Zone C."

Button:

**Apply Recommendation**

---

# 14. BOTTLENECK DETECTION

Implement simple rule-based intelligence.

Detect:

High picking time
High packing queue
Low staffing
High exception volume
Dispatch backlog
Inventory shortages

Generate:

### Operational Recommendation

Example:

"Zone C picking is 21% slower than the warehouse average."

Recommendation:

"Move 2 available pickers from Zone A to Zone C."

Actions:

Apply
Dismiss

This is much more impressive than simply showing a graph.

---

# 15. EMPLOYEE MANAGEMENT

Create:

**Workforce**

Admin and authorized managers can manage warehouse employees.

Show:

Employee
Role
Zone
Current Task
Tasks Completed
Efficiency
Status

Roles:

Admin
Warehouse Manager
Inventory Manager
Picking Manager
Packing Manager
QC Manager
Dispatcher
Picker
Packer
QC Operator

Employee detail:

Name
Employee ID
Role
Zone
Shift
Tasks Completed
Average Task Time
Efficiency
Current Status

Actions:

Edit
Assign Zone
Change Role
Deactivate

---

# 16. USER & ROLE MANAGEMENT

Create:

**Users & Roles**

Only Admin should have complete access.

Roles:

### Admin

Full system access.

Can:

Manage users
Manage managers
Manage employees
Edit warehouse configuration
View analytics
Change roles
Manage settings

### Warehouse Manager

Can:

View operations
Manage orders
Manage allocation
Manage picking
Manage packing
Manage exceptions
View analytics

Cannot:

Create Admins
Delete Admin
Change system-level settings

### Inventory Manager

Can:

Inventory
Allocation
Replenishment
Inventory transactions

### Operations Staff

Can only access operational workflows assigned to them.

Implement route/page restrictions based on role.

---

# 17. ADMIN PANEL

Create a professional administration section.

Sections:

Users
Roles
Employees
Managers
Warehouse Configuration
Zones
Shifts
System Settings
Audit Logs

Admin should be able to:

Add Employee
Edit Employee
Deactivate Employee
Create Manager
Change Role
Assign Zone
Assign Shift

Create forms with validation.

---

# 18. AUDIT LOG

Every important system action should create an audit record.

Examples:

Admin changed employee role
Inventory allocated to order
Order priority changed
Exception resolved
Stock manually adjusted
Order dispatched

Show:

Timestamp
User
Action
Entity
Previous Value
New Value

Example:

14:32
Admin
Changed Role
Rahul Kumar
Picker → Picking Manager

This feature makes the system feel significantly more enterprise-grade.

---

# 19. NOTIFICATION CENTER

Create a notification bell.

Notifications:

Critical order
Low stock
SLA risk
Exception
Picking delay
QC failure
Dispatch delay

Allow:

Mark as read
Mark all as read

---

# 20. SEARCH

Implement global search.

Search:

Orders
SKU
Products
Employees
Exceptions

Example:

Searching:

ORD-10482

should return:

Order
Customer
Items
Current status
Priority

---

# 21. SAMPLE DATA

Pre-populate the application with realistic warehouse data.

Use:

50+ products
30+ orders
15+ employees
5+ managers
10+ inventory alerts
8+ exceptions
Multiple warehouse zones
Multiple fulfillment statuses

Use realistic product categories:

Electronics
Home & Kitchen
Fashion
Sports
Office
Accessories

Products should have:

SKU
Name
Category
Price
Stock
Reserved
Damaged
Reorder Point
Warehouse Zone
Supplier

Orders should have:

Order ID
Customer
Items
Priority
SLA
Created Time
Status
Shipping Method
Warehouse
Assigned Employee

Make the data interconnected.

For example:

If an order consumes inventory, inventory must decrease.

If allocation occurs, reserved stock must increase.

If picking occurs, allocated quantity should move accordingly.

If an item is damaged, damaged quantity should increase.

If order is dispatched, status must change.

---

# 22. DEMO SCENARIO

Create one especially strong preconfigured demo scenario.

Scenario:

Order:
ORD-10482

Priority:
CRITICAL

Customer:
Priya Sharma

Required:

10 Wireless Headphones

Available:

7

Another order:

ORD-10495

Priority:
NORMAL

Required:

5 Wireless Headphones

Available total:

7

The system should identify the conflict.

Show:

**Inventory Conflict Detected**

Then:

**Recommended Decision**

Allocate 7 units to ORD-10482.

Delay ORD-10495.

Reason:

Critical order has higher SLA priority.

Then allow the judge to click:

**Accept Recommendation**

The entire system should update.

This should be one of the main demo moments.

---

# 23. REAL-TIME FEEL

Even though the application uses sample data, make it feel live.

Show:

"Last updated 10 seconds ago"

Use simulated operational updates where appropriate.

Examples:

Order status changing
Inventory counts updating
New alerts appearing
Picking queue changing

Do NOT overdo animations.

Use subtle transitions only.

---

# 24. DATA PERSISTENCE

Use a proper backend/database if available in the Lovable environment.

Prefer:

Supabase

Use tables/entities such as:

users
roles
employees
warehouses
zones
products
inventory
inventory_transactions
orders
order_items
allocations
picking_tasks
packing_tasks
quality_checks
dispatches
exceptions
replenishment
notifications
audit_logs

If full backend implementation would slow down the prototype, prioritize functional persistence for:

Orders
Inventory
Employees
Exceptions
Allocations

Use realistic seeded data.

---

# 25. AUTHENTICATION

Create a professional login screen.

Title:

WAREFLOW

Subtitle:

Intelligent Warehouse Operations

Login:

Email
Password

Provide demo accounts for hackathon testing.

Example:

Admin:
[admin@wareflow.demo](mailto:admin@wareflow.demo)

Warehouse Manager:
[manager@wareflow.demo](mailto:manager@wareflow.demo)

Inventory Manager:
[inventory@wareflow.demo](mailto:inventory@wareflow.demo)

Picker:
[picker@wareflow.demo](mailto:picker@wareflow.demo)

Use role-based dashboards/navigation.

For prototype purposes, demo authentication can be implemented safely using seeded users if necessary.

---

# 26. RESPONSIVE DESIGN

Desktop-first because this is a warehouse management application.

Also support tablet resolution.

Make tables horizontally scrollable where required.

Do not allow the UI to break when data increases.

---

# 27. EMPTY / LOADING / ERROR STATES

Every major page must have:

Loading state
Empty state
Error state

Example:

No exceptions

"Everything is running smoothly."

Do not leave blank screens.

---

# 28. UX DETAILS

Implement:

Search
Filtering
Sorting
Pagination
Status badges
Confirmation dialogs
Toast notifications
Slide-over details
Edit dialogs
Form validation

Destructive actions should require confirmation.

Example:

"Deactivate Employee?"

"Are you sure you want to deactivate Rahul Kumar?"

---

# 29. NAVIGATION

Sidebar:

Overview
Orders
Inventory
Allocation
Picking
Packing & QC
Dispatch
Exceptions
Replenishment
Analytics

Management

Employees
Users & Roles

System

Audit Logs
Settings

At the bottom:

Current user
Role
Profile
Logout

Use icons consistently.

---

# 30. IMPORTANT UI RULE

Do NOT make every page look like:

10 cards
+
3 charts
+
huge table

Instead:

Overview = command center

Orders = operational table

Inventory = inventory table

Allocation = decision workspace

Picking = task workspace

Exceptions = resolution workspace

Analytics = performance analysis

Employees = workforce management

Admin = management console

Each screen should have a different purpose.

---

# 31. MICRO-INTERACTIONS

Add subtle professional interactions:

* Hover states
* Button loading
* Success toast
* Status transitions
* Drawer animations
* Confirmation modal
* Skeleton loading
* Progress indicators

Avoid excessive animations.

---

# 32. IMPORTANT HACKATHON REQUIREMENT

The application must NOT feel like a static mockup.

Buttons must work.

Examples:

Accept Allocation Recommendation
→ updates allocation
→ updates inventory
→ updates order
→ creates audit log
→ notification appears

Mark Item Picked
→ updates picking task
→ updates order progress
→ updates inventory

Report Missing Item
→ creates exception
→ marks order as at-risk
→ shows recommended resolution

Resolve Exception
→ updates exception
→ updates affected order/inventory
→ creates audit log

Complete Packing
→ moves order to QC

Pass QC
→ moves order to Dispatch

Dispatch Order
→ updates order
→ updates inventory
→ creates audit log

Edit Employee
→ updates employee data everywhere

Change Role
→ updates permissions

Create Replenishment Request
→ creates replenishment record

Everything should remain consistent.

---

# 33. DEMO MODE

Create a small "Demo Mode" capability for judges.

The demo should make it easy to demonstrate the intelligent workflow.

Include a scenario selector:

### Scenario 1

Critical Order / Inventory Conflict

### Scenario 2

Low Stock / Replenishment

### Scenario 3

Missing Item

### Scenario 4

Picking Bottleneck

### Scenario 5

QC Failure

Selecting a scenario should load/highlight the relevant operational situation.

Do not make this look fake or like a game.

Keep it professional.

---

# 34. LANDING / LOGIN

Do not create a marketing-heavy landing page.

This is an internal enterprise application.

The first experience should be:

Login
→ Dashboard

The dashboard should immediately communicate:

**"This is a warehouse control system."**

---

# 35. FINAL VISUAL QUALITY

The final application should resemble a real enterprise product built by a professional product team.

Target feeling:

"Someone could actually operate a warehouse from this."

NOT:

"This looks like a student dashboard."

NOT:

"This looks like an AI-generated CRUD app."

NOT:

"This is just charts and cards."

---

# 36. PERFORMANCE

Keep the application fast.

Avoid unnecessary dependencies.

Avoid huge images.

Use icons instead of unnecessary graphics.

Optimize tables and rendering.

---

# 37. HACKATHON DEMO PRIORITY

If development time becomes limited, prioritize these features in this order:

1. Dashboard / Control Tower
2. Orders
3. Inventory
4. Smart Allocation
5. Exceptions
6. Picking
7. Packing/QC
8. Dispatch
9. Replenishment
10. Analytics
11. Employee Management
12. Role Management
13. Audit Logs
14. Demo Scenarios

The core workflow must work completely before adding secondary visual features.

---

# 38. FINAL JUDGE EXPERIENCE

A judge should be able to understand the product within 30 seconds.

When opening the dashboard they should immediately see:

**Orders at Risk**
**Inventory Risks**
**Active Exceptions**
**Picking Queue**

Then demonstrate this scenario:

Critical order requires 10 units.

Only 7 are available.

Another normal order needs 5.

WAREFLOW recommends allocating the 7 units to the critical order.

Judge clicks:

**Accept Recommendation**

The system updates:

Inventory
Order
Allocation
Exception/Risk
Audit Log

Then demonstrate:

Pick
→ Pack
→ QC
→ Dispatch

This should feel like one connected operational system.

---

# 39. BUILD PRINCIPLE

Do not simply implement the problem statement.

Build a product around the problem.

The key product principle is:

**SEE → DECIDE → ACT → VERIFY**

See:
What is happening?

Decide:
What should the warehouse do?

Act:
Execute the operational decision.

Verify:
Did the action resolve the problem?

Every major workflow should follow this principle.

---

# FINAL INSTRUCTION TO LOVABLE

Build the complete WAREFLOW application now.

Do not create a static prototype.

Create a functional, interconnected, realistic warehouse operations product with polished UI, realistic sample data, role-based access, decision-making logic, operational workflows, exception handling, inventory updates, audit logs and demo scenarios.

Prioritize functionality and usability over decorative UI.

Make the application look like a **real enterprise warehouse control platform**, not an AI-generated dashboard.

Use clean, minimal enterprise UX with strong information hierarchy.

All major buttons and workflows must work end-to-end.

Start by creating the application shell, navigation, authentication, database/data model, seeded realistic data and dashboard, then implement the operational workflows one by one.

Do not stop at the dashboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wareflow-smart-ops.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/df45f392-86bb-4e50-ad6e-534cc99240b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
