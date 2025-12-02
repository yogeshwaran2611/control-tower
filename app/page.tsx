"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ClipboardList,
  Cog,
  Command as CommandIcon,
  Gauge,
  Layers,
  LineChart,
  Map as MapIcon,
  RefreshCcw,
  Search,
  ShieldAlert,
  Truck,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

/**
 * JSPL Control Tower — Show & Tell Scaffold
 * - Single-file interactive shell
 * - Vertical navigation + horizontal sub-tabs
 * - Global search + sticky filter bar
 * - KPIs + Live table + Map placeholder
 * - Ticket drawer with ITSM-ish actions
 * - Workshop Mode decision capture drawer
 */

const BRAND = {
  name: "SmarTruck",
  tenant: "JSPL",
  purple: "#20104D",
};

const SEVERITIES = [
  { id: "P1", label: "P1", tone: "destructive" },
  { id: "P2", label: "P2", tone: "warning" },
  { id: "P3", label: "P3", tone: "secondary" },
  { id: "P4", label: "P4", tone: "outline" },
] as const;

type Severity = (typeof SEVERITIES)[number]["id"];

type Stage = "Pre-Shipment" | "In-Plant" | "In-Transit" | "Delivery";

type TrackingHealth = "High" | "Medium" | "Low" | "Down";

type Trip = {
  id: string;
  stage: Stage;
  vehicle: string;
  lane: string;
  carrier: string;
  origin: string;
  destination: string;
  lastPingMins: number;
  confidence: TrackingHealth;
  etaDeltaMins: number; // + means late
  tags: string[]; // exceptions summary
  p1p2Open: number;
};

type TicketStatus = "Open" | "Acknowledged" | "In Progress" | "Pending" | "Resolved" | "Closed";

type Ticket = {
  id: string;
  tripId: string;
  severity: Severity;
  status: TicketStatus;
  category: string;
  subcategory: string;
  ownerGroup: string;
  owner: string;
  slaMinsToBreach: number;
  lastUpdatedMins: number;
  summary: string;
};

type NavId =
  | "live"
  | "tickets"
  | "plants"
  | "routes"
  | "carriers"
  | "analytics"
  | "admin";

const NAV: Array<{ id: NavId; label: string; icon: React.ElementType; subtabs: string[] }>
= [
  { id: "live", label: "Live Operations", icon: Gauge, subtabs: ["Overview", "Pre-Shipment", "In-Plant", "In-Transit", "Delivery"] },
  { id: "tickets", label: "Tickets & SLAs", icon: ClipboardList, subtabs: ["Ticket Queue", "My Tickets", "Aging & Escalations", "Root Cause Library"] },
  { id: "plants", label: "Plants & Yards", icon: Layers, subtabs: ["Plant Dashboard", "Gate & Dock KPIs", "Detention Analysis"] },
  { id: "routes", label: "Routes & Geofences", icon: MapIcon, subtabs: ["Route Library", "No-Go Zones", "Corridor Compliance"] },
  { id: "carriers", label: "Carriers & Drivers", icon: Users, subtabs: ["Carrier Performance", "Driver Compliance & Safety", "Communication Templates"] },
  { id: "analytics", label: "Analytics & Reports", icon: LineChart, subtabs: ["KPI Dashboards", "Trend & Lane Analytics", "Carrier Scorecards"] },
  { id: "admin", label: "Configuration & Admin", icon: Cog, subtabs: ["Business Rules & Thresholds", "User & Role Management", "Integration & Master Data"] },
];

const MOCK_TRIPS: Trip[] = [
  {
    id: "TRP-240112",
    stage: "In-Transit",
    vehicle: "OD14AB1234",
    lane: "Angul → Jharsuguda",
    carrier: "Sai Logistics",
    origin: "Angul Plant",
    destination: "Jharsuguda DC",
    lastPingMins: 6,
    confidence: "High",
    etaDeltaMins: 18,
    tags: ["ETA Risk"],
    p1p2Open: 1,
  },
  {
    id: "TRP-240128",
    stage: "In-Plant",
    vehicle: "OD05CD7731",
    lane: "Jajpur → Paradeep",
    carrier: "Kalinga Trans",
    origin: "Jajpur Plant",
    destination: "Paradeep Port",
    lastPingMins: 22,
    confidence: "Medium",
    etaDeltaMins: 0,
    tags: ["Docs Pending", "Queue > Norm"],
    p1p2Open: 2,
  },
  {
    id: "TRP-240141",
    stage: "Pre-Shipment",
    vehicle: "(unassigned)",
    lane: "Angul → Sambalpur",
    carrier: "—",
    origin: "Angul Plant",
    destination: "Sambalpur Stockyard",
    lastPingMins: 0,
    confidence: "Down",
    etaDeltaMins: 0,
    tags: ["Non-Placement"],
    p1p2Open: 1,
  },
  {
    id: "TRP-240156",
    stage: "In-Transit",
    vehicle: "CG04EF9012",
    lane: "Raigarh → Rourkela",
    carrier: "Shakti Roadlines",
    origin: "Raigarh Plant",
    destination: "Rourkela Plant",
    lastPingMins: 38,
    confidence: "Low",
    etaDeltaMins: 55,
    tags: ["No Ping", "Idle > 45m"],
    p1p2Open: 1,
  },
  {
    id: "TRP-240160",
    stage: "Delivery",
    vehicle: "OD09GH4455",
    lane: "Barbil → Dhenkanal",
    carrier: "Om Fleet",
    origin: "Barbil Mine",
    destination: "Dhenkanal Yard",
    lastPingMins: 12,
    confidence: "High",
    etaDeltaMins: -8,
    tags: ["POD Pending"],
    p1p2Open: 0,
  },
];

const MOCK_TICKETS: Ticket[] = [
  {
    id: "TCK-88102",
    tripId: "TRP-240156",
    severity: "P1",
    status: "Open",
    category: "GPS & Telematics",
    subcategory: "No Ping",
    ownerGroup: "Control Tower (L1)",
    owner: "Unassigned",
    slaMinsToBreach: 24,
    lastUpdatedMins: 9,
    summary: "No location heartbeat for >30 mins while trip active; ETA at risk.",
  },
  {
    id: "TCK-88111",
    tripId: "TRP-240128",
    severity: "P2",
    status: "In Progress",
    category: "In-Plant",
    subcategory: "Documentation Delay",
    ownerGroup: "Plant Dispatch",
    owner: "Jajpur Dispatch",
    slaMinsToBreach: 88,
    lastUpdatedMins: 14,
    summary: "Docs pending beyond norm; truck stuck at plant; dispatch cut-off at risk.",
  },
  {
    id: "TCK-88123",
    tripId: "TRP-240141",
    severity: "P1",
    status: "Acknowledged",
    category: "Pre-Shipment",
    subcategory: "Non-Placement",
    ownerGroup: "Transport Planning",
    owner: "Ananya (Planner)",
    slaMinsToBreach: 41,
    lastUpdatedMins: 6,
    summary: "Vehicle not placed against indent; carrier non-response; dispatch window approaching.",
  },
];

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function severityBadgeClass(sev: Severity) {
  if (sev === "P1") return "bg-red-500/15 text-red-600 border-red-500/20";
  if (sev === "P2") return "bg-amber-500/15 text-amber-700 border-amber-500/20";
  if (sev === "P3") return "bg-slate-500/15 text-slate-700 border-slate-500/20";
  return "bg-slate-200 text-slate-700 border-slate-300";
}

function healthBadgeClass(h: TrackingHealth) {
  if (h === "High") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/20";
  if (h === "Medium") return "bg-amber-500/15 text-amber-700 border-amber-500/20";
  if (h === "Low") return "bg-red-500/15 text-red-600 border-red-500/20";
  return "bg-red-600/20 text-red-700 border-red-600/30";
}

function formatMins(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  tone?: "neutral" | "critical" | "warn" | "good";
  onClick?: () => void;
}) {
  const ring =
    tone === "critical"
      ? "ring-1 ring-red-500/20"
      : tone === "warn"
      ? "ring-1 ring-amber-500/20"
      : tone === "good"
      ? "ring-1 ring-emerald-500/20"
      : "ring-1 ring-slate-200";

  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left",
        "transition",
        "hover:-translate-y-[1px] hover:shadow-sm",
        "rounded-2xl",
        "focus:outline-none focus:ring-2 focus:ring-cyan-300/50",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
      type="button"
    >
      <Card className={cn("rounded-2xl border-slate-200", ring)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">{title}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
              {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <Icon className="h-5 w-5 text-slate-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function TopBar({
  onOpenCommand,
  onToggleWorkshop,
  workshopEnabled,
}: {
  onOpenCommand: () => void;
  onToggleWorkshop: () => void;
  workshopEnabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-2xl"
          style={{ background: `linear-gradient(135deg, ${BRAND.purple}, #3B1B8F)` }}
        >
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">{BRAND.name} Control Tower</div>
            <Badge className="rounded-xl border border-slate-200 bg-white text-slate-700">
              {BRAND.tenant}
            </Badge>
          </div>
          <div className="text-xs text-slate-500">Monitor • Manage Exceptions • Analyze • Configure</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={onOpenCommand}>
          <CommandIcon className="mr-2 h-4 w-4" />
          Command
          <Badge className="ml-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-600">
            ⌘K
          </Badge>
        </Button>

        <Button
          variant={workshopEnabled ? "default" : "outline"}
          className={cn(
            "rounded-2xl",
            workshopEnabled ? "bg-[#20104D] hover:bg-[#20104D]/90" : ""
          )}
          onClick={onToggleWorkshop}
        >
          <Layers className="mr-2 h-4 w-4" />
          Workshop Mode
        </Button>

        <Button variant="outline" className="rounded-2xl">
          <RefreshCcw className="h-4 w-4" />
        </Button>

        <Button variant="outline" className="rounded-2xl">
          <Bell className="h-4 w-4" />
        </Button>

        <Button className="rounded-2xl bg-[#20104D] hover:bg-[#20104D]/90">Sign in</Button>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  active: NavId;
  onSelect: (id: NavId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div className={cn("h-full border-r border-slate-200 bg-white", collapsed ? "w-[72px]" : "w-[280px]")}> 
      <div className="flex items-center justify-between px-3 py-3">
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}> 
          <div className="h-9 w-9 rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <ShieldAlert className="h-5 w-5 text-slate-900" />
          </div>
          {!collapsed ? (
            <div>
              <div className="text-sm font-semibold text-slate-900">JSPL Workbench</div>
              <div className="text-xs text-slate-500">Control tower shell</div>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <Button variant="ghost" className="rounded-2xl" onClick={onToggleCollapse}>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
        ) : (
          <Button variant="ghost" className="rounded-2xl" onClick={onToggleCollapse}>
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </Button>
        )}
      </div>
      <Separator />

      <ScrollArea className={cn("h-[calc(100vh-120px)]", collapsed ? "px-2" : "px-3")}>
        <div className="py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full",
                  "rounded-2xl",
                  "px-3 py-2.5",
                  "flex items-center gap-3",
                  "transition",
                  isActive ? "bg-[#20104D] text-white" : "hover:bg-slate-50 text-slate-800",
                  collapsed ? "justify-center" : ""
                )}
                type="button"
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-900")} />
                {!collapsed ? (
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.id === "tickets" ? (
                      <Badge className={cn("rounded-xl", isActive ? "bg-white/15 text-white" : "bg-red-500/10 text-red-700")}>3</Badge>
                    ) : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <div className={cn("px-3 pb-4", collapsed ? "px-2" : "")}> 
        <div className={cn("rounded-2xl border border-slate-200 bg-slate-50 p-3", collapsed ? "p-2" : "")}> 
          <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}> 
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {!collapsed ? (
              <div className="text-xs text-slate-700">
                <span className="font-semibold">Show & Tell</span> • Mock data
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  search,
  setSearch,
  timeWindow,
  setTimeWindow,
  plant,
  setPlant,
  lane,
  setLane,
  carrier,
  setCarrier,
  severities,
  setSeverities,
  trackingHealth,
  setTrackingHealth,
}: {
  search: string;
  setSearch: (v: string) => void;
  timeWindow: string;
  setTimeWindow: (v: string) => void;
  plant: string;
  setPlant: (v: string) => void;
  lane: string;
  setLane: (v: string) => void;
  carrier: string;
  setCarrier: (v: string) => void;
  severities: Severity[];
  setSeverities: (v: Severity[]) => void;
  trackingHealth: TrackingHealth | "All";
  setTrackingHealth: (v: TrackingHealth | "All") => void;
}) {
  const plants = ["All", "Angul Plant", "Jajpur Plant", "Raigarh Plant", "Barbil Mine", "Dhenkanal Yard"];
  const lanes = ["All", "Angul → Jharsuguda", "Jajpur → Paradeep", "Angul → Sambalpur", "Raigarh → Rourkela", "Barbil → Dhenkanal"];
  const carriers = ["All", "Sai Logistics", "Kalinga Trans", "Shakti Roadlines", "Om Fleet"];

  function toggleSeverity(s: Severity, checked: boolean) {
    if (checked) setSeverities(Array.from(new Set([...severities, s])));
    else setSeverities(severities.filter((x) => x !== s));
  }

  return (
    <div className="sticky top-0 z-20 border-y border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search Trip / Vehicle / Ticket / PO / Driver"
            className="h-10 rounded-2xl pl-9"
          />
        </div>

        <Select value={timeWindow} onValueChange={setTimeWindow}>
          <SelectTrigger className="h-10 w-[150px] rounded-2xl">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Live">Live</SelectItem>
            <SelectItem value="Today">Today</SelectItem>
            <SelectItem value="Last 24h">Last 24h</SelectItem>
            <SelectItem value="Custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        <Select value={plant} onValueChange={setPlant}>
          <SelectTrigger className="h-10 w-[180px] rounded-2xl">
            <SelectValue placeholder="Plant" />
          </SelectTrigger>
          <SelectContent>
            {plants.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={lane} onValueChange={setLane}>
          <SelectTrigger className="h-10 w-[190px] rounded-2xl">
            <SelectValue placeholder="Lane" />
          </SelectTrigger>
          <SelectContent>
            {lanes.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={carrier} onValueChange={setCarrier}>
          <SelectTrigger className="h-10 w-[170px] rounded-2xl">
            <SelectValue placeholder="Carrier" />
          </SelectTrigger>
          <SelectContent>
            {carriers.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 rounded-2xl">
              Severity
              <Badge className="ml-2 rounded-lg border border-slate-200 bg-white text-slate-700">
                {severities.length}
              </Badge>
              <ChevronDown className="ml-2 h-4 w-4 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl">
            <DropdownMenuLabel>Include severities</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SEVERITIES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.id}
                checked={severities.includes(s.id)}
                onCheckedChange={(v: boolean) => toggleSeverity(s.id, v)}
              >
                {s.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={trackingHealth} onValueChange={(v: string) => setTrackingHealth(v as any)}>
          <SelectTrigger className="h-10 w-[170px] rounded-2xl">
            <SelectValue placeholder="Tracking" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">Tracking: All</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Down">Down</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          className="h-10 rounded-2xl"
          onClick={() => {
            setSearch("");
            setTimeWindow("Live");
            setPlant("All");
            setLane("All");
            setCarrier("All");
            setSeverities(["P1", "P2", "P3", "P4"]);
            setTrackingHealth("All");
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-lg font-semibold tracking-tight text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function MapPlaceholder({ trips, onPickTrip }: { trips: Trip[]; onPickTrip: (t: Trip) => void }) {
  return (
    <Card className="rounded-2xl border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Live Map (placeholder)</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="rounded-xl bg-slate-900/5 text-slate-700">Trips: {trips.length}</Badge>
            <Button variant="outline" className="h-8 rounded-2xl text-xs">
              Layers
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
            <MapIcon className="h-4 w-4" />
            Corridor • Deviations • No Ping • No-go
          </div>

          {/* Fake markers */}
          <div className="absolute inset-0">
            {trips.slice(0, 4).map((t, idx) => {
              const x = 18 + idx * 20;
              const y = 25 + idx * 18;
              const color = t.p1p2Open > 0 ? "bg-red-500" : t.confidence === "Low" || t.confidence === "Down" ? "bg-amber-500" : "bg-emerald-500";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPickTrip(t)}
                  className={cn(
                    "absolute",
                    `left-[${x}%] top-[${y}%]`,
                    "group",
                    "-translate-x-1/2 -translate-y-1/2"
                  )}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div className={cn("h-3 w-3 rounded-full", color)} />
                  <div className="pointer-events-none absolute left-4 top-1 hidden w-[220px] rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs shadow-lg group-hover:block">
                    <div className="font-semibold text-slate-900">{t.id}</div>
                    <div className="mt-1 text-slate-600">{t.vehicle} • {t.lane}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge className={cn("rounded-xl border", healthBadgeClass(t.confidence))}>{t.confidence}</Badge>
                      {t.tags.slice(0, 2).map((x) => (
                        <Badge key={x} className="rounded-xl bg-slate-900/5 text-slate-700">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Grid lines */}
          <div className="absolute inset-0 opacity-40">
            <div className="h-full w-full bg-[linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketDrawer({
  open,
  onOpenChange,
  ticket,
  trip,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket?: Ticket;
  trip?: Trip;
}) {
  const t = ticket;
  const tr = trip;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:w-[560px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-base">{t ? t.id : tr ? tr.id : "Details"}</SheetTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge className="rounded-xl border border-slate-200 bg-white text-slate-700">JSPL</Badge>
                  {t ? (
                    <Badge className={cn("rounded-xl border", severityBadgeClass(t.severity))}>{t.severity}</Badge>
                  ) : null}
                  {tr ? (
                    <Badge className={cn("rounded-xl border", healthBadgeClass(tr.confidence))}>
                      Tracking: {tr.confidence}
                    </Badge>
                  ) : null}
                  {t ? (
                    <span>• SLA breach in <span className="font-semibold text-slate-900">{formatMins(t.slaMinsToBreach)}</span></span>
                  ) : null}
                </div>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" className="rounded-2xl">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>

            {/* Action bar */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="rounded-2xl bg-[#20104D] hover:bg-[#20104D]/90">Acknowledge</Button>
              <Button variant="outline" className="rounded-2xl">Assign</Button>
              <Button variant="outline" className="rounded-2xl">Send WhatsApp</Button>
              <Button variant="outline" className="rounded-2xl">Escalate</Button>
              <Button variant="outline" className="rounded-2xl">Close</Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="summary" className="h-full">
              <div className="border-b border-slate-200 px-4 py-2">
                <TabsList className="w-full justify-start rounded-2xl bg-slate-50 p-1">
                  <TabsTrigger value="summary" className="rounded-xl">Summary</TabsTrigger>
                  <TabsTrigger value="timeline" className="rounded-xl">Trip Timeline</TabsTrigger>
                  <TabsTrigger value="comms" className="rounded-xl">Comms</TabsTrigger>
                  <TabsTrigger value="evidence" className="rounded-xl">Evidence</TabsTrigger>
                  <TabsTrigger value="audit" className="rounded-xl">Audit</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="h-[calc(100vh-210px)] px-5 py-4">
                <TabsContent value="summary" className="mt-0">
                  <div className="space-y-4">
                    <Card className="rounded-2xl border-slate-200">
                      <CardContent className="p-4">
                        <div className="text-xs text-slate-500">Ticket summary</div>
                        <div className="mt-1 text-sm text-slate-900">
                          {t ? t.summary : "Trip details preview. Create a ticket from Live operations."}
                        </div>
                        {t ? (
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Category</div>
                              <div className="mt-1 font-semibold text-slate-900">{t.category} / {t.subcategory}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Owner</div>
                              <div className="mt-1 font-semibold text-slate-900">{t.ownerGroup}</div>
                              <div className="text-slate-500">{t.owner}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Status</div>
                              <div className="mt-1 font-semibold text-slate-900">{t.status}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Last updated</div>
                              <div className="mt-1 font-semibold text-slate-900">{formatMins(t.lastUpdatedMins)} ago</div>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Linked trip</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {tr ? (
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Trip</div>
                              <div className="mt-1 font-semibold text-slate-900">{tr.id}</div>
                              <div className="text-slate-500">Stage: {tr.stage}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Vehicle</div>
                              <div className="mt-1 font-semibold text-slate-900">{tr.vehicle}</div>
                              <div className="text-slate-500">Carrier: {tr.carrier}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Lane</div>
                              <div className="mt-1 font-semibold text-slate-900">{tr.lane}</div>
                              <div className="text-slate-500">{tr.origin} → {tr.destination}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="text-slate-500">Telemetry</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge className={cn("rounded-xl border", healthBadgeClass(tr.confidence))}>{tr.confidence}</Badge>
                                <span className="text-slate-500">Last ping</span>
                                <span className="font-semibold text-slate-900">{formatMins(tr.lastPingMins)} ago</span>
                              </div>
                              <div className="text-slate-500">ETA delta: {tr.etaDeltaMins >= 0 ? "+" : ""}{tr.etaDeltaMins}m</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-600">No trip selected.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-0">
                  <Card className="rounded-2xl border-slate-200">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-500">Milestones (mock)</div>
                      <div className="mt-3 space-y-3">
                        {[
                          { k: "Gate-Out", v: "Completed", t: "2h 10m ago" },
                          { k: "In-Transit", v: "Active", t: "Now" },
                          { k: "Last Ping", v: tr ? `${formatMins(tr.lastPingMins)} ago` : "—", t: "" },
                          { k: "Exception", v: t ? `${t.category} • ${t.subcategory}` : "—", t: "" },
                        ].map((r) => (
                          <div key={r.k} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                            <div>
                              <div className="text-xs text-slate-500">{r.k}</div>
                              <div className="text-sm font-semibold text-slate-900">{r.v}</div>
                            </div>
                            <div className="text-xs text-slate-500">{r.t}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="comms" className="mt-0">
                  <div className="space-y-4">
                    <Card className="rounded-2xl border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Send template</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="outline" className="rounded-2xl justify-start">WhatsApp • “No Ping – confirm ETA”</Button>
                          <Button variant="outline" className="rounded-2xl justify-start">WhatsApp • “Route deviation – return to corridor”</Button>
                          <Button variant="outline" className="rounded-2xl justify-start">Email • “SLA breach escalation notice”</Button>
                          <Button variant="outline" className="rounded-2xl justify-start">WhatsApp • “Detention warning”</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Communication log (mock)</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 text-sm">
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="text-xs text-slate-500">12:14 • WhatsApp sent to Carrier</div>
                            <div className="mt-1 text-slate-900">“No ping for 30 mins. Please confirm driver status + corrected ETA.”</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="text-xs text-slate-500">12:18 • Reply received</div>
                            <div className="mt-1 text-slate-900">“Network issue near forest patch. ETA +45m.”</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="evidence" className="mt-0">
                  <Card className="rounded-2xl border-slate-200">
                    <CardContent className="p-4">
                      <div className="text-sm font-semibold text-slate-900">Evidence</div>
                      <div className="mt-1 text-xs text-slate-500">POD, photos, docs, location proofs (placeholder)</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="h-28 rounded-2xl border border-dashed border-slate-300 bg-slate-50" />
                        <div className="h-28 rounded-2xl border border-dashed border-slate-300 bg-slate-50" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-0">
                  <Card className="rounded-2xl border-slate-200">
                    <CardContent className="p-4">
                      <div className="text-sm font-semibold text-slate-900">Audit trail</div>
                      <div className="mt-3 space-y-2 text-sm">
                        {[
                          "Ticket created by System (Rules Engine)",
                          "Assigned to Control Tower (L1)",
                          "WhatsApp template sent to carrier",
                          "ETA updated from carrier reply",
                        ].map((x) => (
                          <div key={x} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="text-xs text-slate-500">Timestamp • User/System</div>
                            <div className="mt-1 text-slate-900">{x}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WorkshopDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-base">Workshop Mode • Decision Capture</SheetTitle>
                <div className="mt-1 text-xs text-slate-500">Use this live in the client meeting to lock knobs for MVP.</div>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" className="rounded-2xl">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-4">
              <Card className="rounded-2xl border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Decisions pending</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm">
                  <ul className="space-y-2">
                    {[
                      "No Ping threshold (minutes) by lane risk",
                      "Idle threshold day/night",
                      "Placement SLA + escalation ladder",
                      "POD upload SLA + evidence requirements",
                      "No-go zones owner + default severity",
                      "Template approvals (WhatsApp + Email)",
                    ].map((x) => (
                      <li key={x} className="flex items-start gap-2">
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-slate-800">{x}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Decision fields (fill live)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-slate-500">No Ping threshold</div>
                      <Input className="mt-1 rounded-2xl" placeholder="e.g., 30 mins (normal), 15 mins (high risk)" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">P1 Acknowledge / Resolve</div>
                      <Input className="mt-1 rounded-2xl" placeholder="e.g., Ack 10m / Workaround 60m" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Primary owner for ‘No Ping’ tickets</div>
                      <Input className="mt-1 rounded-2xl" placeholder="e.g., Control Tower (L1)" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Escalation ladder (L1 → L2 → L3)</div>
                      <Input className="mt-1 rounded-2xl" placeholder="e.g., L1 Ops → L2 Carrier Mgr → L3 Security" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Templates to approve (MVP)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "WA: No Ping – confirm ETA",
                      "WA: Idle – reason code",
                      "WA: Route deviation – return",
                      "WA: Detention warning",
                      "Email: SLA breach escalation",
                    ].map((x) => (
                      <Badge key={x} className="rounded-xl bg-slate-900/5 text-slate-700">
                        {x}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full rounded-2xl bg-[#20104D] hover:bg-[#20104D]/90">
                Export workshop notes (placeholder)
              </Button>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CommandPalette({ open, onOpenChange, onJump }: { open: boolean; onOpenChange: (v: boolean) => void; onJump: (nav: NavId, subtab?: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] rounded-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-sm">Command Palette</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          <Command className="rounded-2xl border border-slate-200">
            <CommandInput placeholder="Type to search actions…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Navigation">
                <CommandItem onSelect={() => { onJump("live", "Overview"); onOpenChange(false); }}>
                  Live Operations → Overview
                </CommandItem>
                <CommandItem onSelect={() => { onJump("live", "In-Transit"); onOpenChange(false); }}>
                  Live Operations → In-Transit
                </CommandItem>
                <CommandItem onSelect={() => { onJump("tickets", "Ticket Queue"); onOpenChange(false); }}>
                  Tickets & SLAs → Ticket Queue
                </CommandItem>
                <CommandItem onSelect={() => { onJump("routes", "No-Go Zones"); onOpenChange(false); }}>
                  Routes & Geofences → No-Go Zones
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => onOpenChange(false)}>Create Ticket (mock)</CommandItem>
                <CommandItem onSelect={() => onOpenChange(false)}>Send WhatsApp template (mock)</CommandItem>
                <CommandItem onSelect={() => onOpenChange(false)}>Open Workshop Mode</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiveOverview({
  trips,
  tickets,
  onOpenTicket,
  onOpenTrip,
}: {
  trips: Trip[];
  tickets: Ticket[];
  onOpenTicket: (t: Ticket) => void;
  onOpenTrip: (t: Trip) => void;
}) {
  const p1 = tickets.filter((t) => t.severity === "P1" && t.status !== "Closed").length;
  const p2 = tickets.filter((t) => t.severity === "P2" && t.status !== "Closed").length;
  const noPingNow = trips.filter((t) => t.confidence === "Down" || t.tags.includes("No Ping")).length;
  const etaRisk = trips.filter((t) => t.etaDeltaMins > 30).length;
  const inPlant = trips.filter((t) => t.stage === "In-Plant").length;
  const inTransit = trips.filter((t) => t.stage === "In-Transit").length;

  const liveQueue = trips;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Active Trips" value={`${trips.length}`} subtitle="Filtered view" icon={Truck} />
        <KpiCard title="P1 Open" value={`${p1}`} icon={ShieldAlert} tone="critical" onClick={() => {}} />
        <KpiCard title="P2 Open" value={`${p2}`} icon={AlertTriangle} tone="warn" onClick={() => {}} />
        <KpiCard title="No Ping Now" value={`${noPingNow}`} icon={MapIcon} tone={noPingNow > 0 ? "warn" : "neutral"} />
        <KpiCard title="ETA Risk" value={`${etaRisk}`} icon={Gauge} tone={etaRisk > 0 ? "warn" : "neutral"} />
        <KpiCard title="In-Plant / In-Transit" value={`${inPlant} / ${inTransit}`} icon={Layers} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="rounded-2xl border-slate-200 xl:col-span-7">
          <CardHeader className="pb-3">
            <SectionHeader
              title="Live Queue"
              subtitle="High-signal, ops-first list. Click a trip to open the drawer."
              right={
                <div className="flex items-center gap-2">
                  <Badge className="rounded-xl bg-slate-900/5 text-slate-700">Auto-refresh • 60s</Badge>
                  <Button variant="outline" className="h-8 rounded-2xl text-xs">
                    Export
                  </Button>
                </div>
              }
            />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Lane</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Last Ping</TableHead>
                    <TableHead>ETA Δ</TableHead>
                    <TableHead>Alerts</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveQueue.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => onOpenTrip(t)}
                    >
                      <TableCell className="font-medium text-slate-900">{t.id}</TableCell>
                      <TableCell>
                        <Badge className="rounded-xl bg-slate-900/5 text-slate-700">{t.stage}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">{t.vehicle}</TableCell>
                      <TableCell className="text-slate-700">{t.lane}</TableCell>
                      <TableCell className="text-slate-700">{t.carrier}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("rounded-xl border", healthBadgeClass(t.confidence))}>
                            {t.confidence}
                          </Badge>
                          <span className="text-xs text-slate-600">{formatMins(t.lastPingMins)} ago</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("font-medium", t.etaDeltaMins > 30 ? "text-amber-700" : "text-slate-700")}>
                        {t.etaDeltaMins >= 0 ? "+" : ""}{t.etaDeltaMins}m
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.tags.slice(0, 2).map((x) => (
                            <Badge key={x} className="rounded-xl bg-slate-900/5 text-slate-700">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.p1p2Open > 0 ? (
                          <Badge className="rounded-xl bg-red-500/10 text-red-700">{t.p1p2Open}</Badge>
                        ) : (
                          <Badge className="rounded-xl bg-slate-900/5 text-slate-700">0</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500">Tip: click a row to open the Ticket/Trip drawer.</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-9 rounded-2xl">Create Ticket</Button>
                <Button className="h-9 rounded-2xl bg-[#20104D] hover:bg-[#20104D]/90">View Ticket Queue</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="xl:col-span-5">
          <MapPlaceholder trips={trips} onPickTrip={onOpenTrip} />
          <div className="mt-4 grid grid-cols-1 gap-4">
            <Card className="rounded-2xl border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Telemetry Health (mini)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">No Ping trips</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{noPingNow}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Provider/API status</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className="rounded-xl bg-emerald-500/15 text-emerald-700 border border-emerald-500/20">Healthy</Badge>
                      <span className="text-xs text-slate-500">(mock)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  Fallback behavior: last known position + historical ETA when confidence is Low/Down.
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Critical tickets</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {tickets
                    .filter((x) => x.severity === "P1" || x.severity === "P2")
                    .slice(0, 3)
                    .map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => onOpenTicket(x)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-900">{x.id}</div>
                          <Badge className={cn("rounded-xl border", severityBadgeClass(x.severity))}>{x.severity}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">{x.category} • {x.subcategory}</div>
                        <div className="mt-2 text-xs text-slate-500">SLA breach in {formatMins(x.slaMinsToBreach)} • {x.tripId}</div>
                      </button>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPage({
  title,
  subtitle,
  bullets,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
}) {
  return (
    <Card className="rounded-2xl border-slate-200">
      <CardContent className="p-6">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
        <div className="mt-4 grid gap-2">
          {bullets.map((b) => (
            <div key={b} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-cyan-500" />
              <div className="text-sm text-slate-800">{b}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ControlTowerShowAndTell() {
  const [activeNav, setActiveNav] = useState<NavId>("live");
  const [activeSubtab, setActiveSubtab] = useState<string>(NAV[0].subtabs[0]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [search, setSearch] = useState("");
  const [timeWindow, setTimeWindow] = useState("Live");
  const [plant, setPlant] = useState("All");
  const [lane, setLane] = useState("All");
  const [carrier, setCarrier] = useState("All");
  const [severities, setSeverities] = useState<Severity[]>(["P1", "P2", "P3", "P4"]);
  const [trackingHealth, setTrackingHealth] = useState<TrackingHealth | "All">("All");

  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const [workshopEnabled, setWorkshopEnabled] = useState(false);
  const [workshopDrawerOpen, setWorkshopDrawerOpen] = useState(false);

  const [commandOpen, setCommandOpen] = useState(false);

  const activeNavDef = NAV.find((n) => n.id === activeNav) || NAV[0];

  // keep subtab valid when nav changes
  useEffect(() => {
    if (!activeNavDef.subtabs.includes(activeSubtab)) {
      setActiveSubtab(activeNavDef.subtabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav]);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tripsFiltered = useMemo(() => {
    return MOCK_TRIPS.filter((t) => {
      const s = search.trim().toLowerCase();
      const matchesSearch = !s
        ? true
        : [t.id, t.vehicle, t.lane, t.carrier, t.origin, t.destination]
            .join(" ")
            .toLowerCase()
            .includes(s);
      const matchesPlant = plant === "All" ? true : t.origin === plant || t.destination === plant;
      const matchesLane = lane === "All" ? true : t.lane === lane;
      const matchesCarrier = carrier === "All" ? true : t.carrier === carrier;
      const matchesTracking = trackingHealth === "All" ? true : t.confidence === trackingHealth;
      return matchesSearch && matchesPlant && matchesLane && matchesCarrier && matchesTracking;
    });
  }, [search, plant, lane, carrier, trackingHealth]);

  const ticketsFiltered = useMemo(() => {
    return MOCK_TICKETS.filter((t) => {
      if (!severities.includes(t.severity)) return false;
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return [t.id, t.tripId, t.category, t.subcategory, t.ownerGroup, t.owner]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [severities, search]);

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return undefined;
    return MOCK_TICKETS.find((t) => t.id === selectedTicketId);
  }, [selectedTicketId]);

  const selectedTrip = useMemo(() => {
    const id = selectedTripId || selectedTicket?.tripId;
    if (!id) return undefined;
    return MOCK_TRIPS.find((t) => t.id === id);
  }, [selectedTripId, selectedTicket]);

  function openTicket(t: Ticket) {
    setSelectedTicketId(t.id);
    setSelectedTripId(t.tripId);
    setTicketDrawerOpen(true);
  }

  function openTrip(t: Trip) {
    setSelectedTripId(t.id);
    setSelectedTicketId(null);
    setTicketDrawerOpen(true);
  }

  function jump(nav: NavId, subtab?: string) {
    setActiveNav(nav);
    const def = NAV.find((n) => n.id === nav);
    setActiveSubtab(subtab && def?.subtabs.includes(subtab) ? subtab : def?.subtabs[0] || "Overview");
  }

  const headerTitle = useMemo(() => {
    const top = activeNavDef.label;
    return { top, sub: activeSubtab };
  }, [activeNavDef.label, activeSubtab]);

  return (
    <div className="min-h-screen bg-[#F7F8FC]">
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          active={activeNav}
          onSelect={(id) => setActiveNav(id)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            onOpenCommand={() => setCommandOpen(true)}
            workshopEnabled={workshopEnabled}
            onToggleWorkshop={() => {
              const next = !workshopEnabled;
              setWorkshopEnabled(next);
              setWorkshopDrawerOpen(next);
            }}
          />

          <FilterBar
            search={search}
            setSearch={setSearch}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            plant={plant}
            setPlant={setPlant}
            lane={lane}
            setLane={setLane}
            carrier={carrier}
            setCarrier={setCarrier}
            severities={severities}
            setSeverities={setSeverities}
            trackingHealth={trackingHealth}
            setTrackingHealth={setTrackingHealth}
          />

          {/* Horizontal sub-tabs */}
          <div className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-xs text-slate-500">{headerTitle.top}</div>
                <div className="text-base font-semibold tracking-tight text-slate-900">{headerTitle.sub}</div>
              </div>

              <div className="flex items-center gap-2">
                {workshopEnabled ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setWorkshopDrawerOpen(true)}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Open decision capture
                  </Button>
                ) : null}
                <Button variant="outline" className="rounded-2xl">
                  <CommandIcon className="mr-2 h-4 w-4" />
                  Shortcuts
                </Button>
              </div>
            </div>

            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {activeNavDef.subtabs.map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    variant={activeSubtab === tab ? "default" : "outline"}
                    className={cn(
                      "h-9 rounded-2xl",
                      activeSubtab === tab ? "bg-[#20104D] hover:bg-[#20104D]/90" : ""
                    )}
                    onClick={() => setActiveSubtab(tab)}
                  >
                    {tab}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <ScrollArea className="flex-1">
            <div className="px-4 py-4">
              {activeNav === "live" && activeSubtab === "Overview" ? (
                <LiveOverview
                  trips={tripsFiltered}
                  tickets={ticketsFiltered}
                  onOpenTicket={openTicket}
                  onOpenTrip={openTrip}
                />
              ) : activeNav === "tickets" && activeSubtab === "Ticket Queue" ? (
                <PlaceholderPage
                  title="Ticket Queue (ITSM-grade)"
                  subtitle="This is where L1 triages, assigns, messages, and escalates with SLA timers."
                  bullets={[
                    "Kanban + table hybrid (filtered by severity/SLA risk)",
                    "Bulk actions: assign, send template, escalate",
                    "Right drawer: Summary / Timeline / Comms / Evidence / Audit",
                    "Mandatory fields + pending reason codes",
                  ]}
                />
              ) : activeNav === "routes" && activeSubtab === "No-Go Zones" ? (
                <PlaceholderPage
                  title="No-Go Zones"
                  subtitle="Define restricted regions, default severity, and escalation policy (security-ready)."
                  bullets={[
                    "Zone library with owners + approval",
                    "Policy preview: If entered → create P1 ticket + notify Security + notify Carrier",
                    "Corridor buffers and geofence layers",
                    "Hotspot analytics feeds governance",
                  ]}
                />
              ) : activeNav === "carriers" && activeSubtab === "Carrier Performance" ? (
                <PlaceholderPage
                  title="Carrier Performance Scorecards"
                  subtitle="Governance view: placement SLA, route compliance, no-ping/tamper rate, OTIF, detention impact."
                  bullets={[
                    "Rank carriers by lane and plant",
                    "Auto-open Problem tickets on recurring patterns",
                    "Monthly QBR exports",
                    "Allocation consequence hooks (policy-driven)",
                  ]}
                />
              ) : (
                <PlaceholderPage
                  title={`${headerTitle.top} • ${headerTitle.sub}`}
                  subtitle="This section is scaffolded for show-and-tell. Hook data + components incrementally."
                  bullets={[
                    "Global filters + navigation are already wired",
                    "Use the Ticket Drawer pattern everywhere",
                    "Add real map (Mapbox/Leaflet) later without changing shell",
                    "Rules engine + templates plug into this UI",
                  ]}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <TicketDrawer
        open={ticketDrawerOpen}
        onOpenChange={setTicketDrawerOpen}
        ticket={selectedTicket}
        trip={selectedTrip}
      />

      <WorkshopDrawer open={workshopDrawerOpen} onOpenChange={setWorkshopDrawerOpen} />

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onJump={(nav, subtab) => jump(nav, subtab)}
      />

      {/* Tiny footer watermark */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 shadow-sm backdrop-blur">
        Show & Tell UI scaffold • SmarTruck-style • JSPL (mock data)
      </div>
    </div>
  );
}
