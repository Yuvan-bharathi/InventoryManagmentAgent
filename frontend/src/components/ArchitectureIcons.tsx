import React from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DATA SOURCES (Enterprise Silos)
// ─────────────────────────────────────────────────────────────────────────────

/** ERP (SAP S/4HANA) - Corporate Headquarters Tower with SAP Blue Badge */
export function IconSapErp({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
      <rect x="7" y="6" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="11" y="6" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="15" y="6" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="7" y="10" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="11" y="10" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="15" y="10" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="7" y="14" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="11" y="14" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="15" y="14" width="2.5" height="2.5" rx="0.5" fill="#0284C7" />
      <rect x="10" y="18" width="4" height="3" fill="#0369A1" />
      <circle cx="18" cy="6" r="3.5" fill="#0070F2" />
      <path d="M16.5 6L17.5 7L19.5 5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** MES (Siemens Opcenter) - Automated SMT Line & Industrial Precision Assembly */
export function IconSiemensMes({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M3 20V10L8 13V10L13 13V7L21 11V20H3Z" fill="#D1FAE5" stroke="#059669" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="3" y1="18" x2="21" y2="18" stroke="#047857" strokeWidth="2" strokeDasharray="2 2" />
      <circle cx="12" cy="7" r="3" fill="#059669" />
      <circle cx="12" cy="7" r="1.2" fill="#FFFFFF" />
      <path d="M18 4C19 5 19 6 18 7" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 3C22 5 22 7 20 9" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** WMS (Digital Twin) - Warehouse High-Bay Storage Racks & Pallet Bins */
export function IconWmsTwin({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.5" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="#7C3AED" strokeWidth="1.5" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="#7C3AED" strokeWidth="1.5" />
      <line x1="12" y1="3" x2="12" y2="21" stroke="#7C3AED" strokeWidth="1.5" />
      <rect x="5" y="4.5" width="5" height="3" rx="0.5" fill="#8B5CF6" />
      <rect x="14" y="4.5" width="5" height="3" rx="0.5" fill="#C4B5FD" />
      <rect x="5" y="10.5" width="5" height="3" rx="0.5" fill="#C4B5FD" />
      <rect x="14" y="10.5" width="5" height="3" rx="0.5" fill="#8B5CF6" />
      <rect x="5" y="16.5" width="5" height="3" rx="0.5" fill="#8B5CF6" />
      <rect x="14" y="16.5" width="5" height="3" rx="0.5" fill="#A78BFA" />
    </svg>
  )
}

/** Excel & Manual Files - Official Microsoft Excel Green Workbook with Distinct 'X' & Grid */
export function IconExcel({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Green spreadsheet workbook base */}
      <rect x="2" y="3" width="20" height="18" rx="3.5" fill="#107C41" />
      {/* White table grid cells in background */}
      <rect x="10.5" y="5.5" width="9.5" height="13" rx="1" fill="#FFFFFF" fillOpacity="0.2" />
      <path d="M10.5 9.5H20 M10.5 14H20 M15 5.5V18.5" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.7" />
      {/* Excel Front Fold Badge with bold white 'X' */}
      <rect x="3" y="5.5" width="8.5" height="13" rx="2" fill="#0C592C" />
      <path d="M5.5 8.5L9 15.5 M9 8.5L5.5 15.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INGESTION & DATA LAYER (FastAPI + PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────

/** FastAPI Gateway - Fast API Cloud with Lightning Speed Ingestion */
export function IconFastApi({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Cloud perimeter */}
      <path
        d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z"
        fill="#E0F2FE"
        stroke="#0284C7"
        strokeWidth="1.4"
      />
      {/* High-speed Teal Lightning Bolt */}
      <path d="M13.5 6.5L7.5 13H12.5L11.5 18.5L17.5 12H12.5L13.5 6.5Z" fill="#009688" stroke="#00796B" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  )
}

/** PostgreSQL 16 DB - Relational Database Stack (Matching SQL Server Stack in reference) */
export function IconPostgres({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Bottom cylinder disc */}
      <path d="M4 14C4 16.2 7.6 18 12 18C16.4 18 20 16.2 20 14V17C20 19.2 16.4 21 12 21C7.6 21 4 19.2 4 17V14Z" fill="#336791" />
      {/* Middle cylinder disc */}
      <path d="M4 9C4 11.2 7.6 13 12 13C16.4 13 20 11.2 20 9V12C20 14.2 16.4 16 12 16C7.6 16 4 14.2 4 12V9Z" fill="#295175" />
      {/* Top cylinder body */}
      <path d="M4 4C4 6.2 7.6 8 12 8C16.4 8 20 6.2 20 4V7C20 9.2 16.4 11 12 11C7.6 11 4 9.2 4 7V4Z" fill="#3E7EAF" />
      {/* Top oval platter */}
      <ellipse cx="12" cy="4.5" rx="8" ry="3" fill="#60A5FA" />
      {/* Activity status LEDs */}
      <circle cx="7" cy="11.5" r="1" fill="#38BDF8" />
      <circle cx="7" cy="16.5" r="1" fill="#38BDF8" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI AGENT MESH (Active Agents 1–7)
// ─────────────────────────────────────────────────────────────────────────────

/** AGT-07: Central Orchestrator - Cognitive Neural Core with Multi-Agent Network */
export function IconOrchestrator({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Central AI Processor Core */}
      <circle cx="12" cy="12" r="4.5" fill="#7C3AED" />
      <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
      {/* Multi-Agent Synaptic Connection Links */}
      <line x1="12" y1="3" x2="12" y2="7.5" stroke="#9333EA" strokeWidth="1.5" />
      <line x1="12" y1="16.5" x2="12" y2="21" stroke="#9333EA" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="7.5" y2="12" stroke="#9333EA" strokeWidth="1.5" />
      <line x1="16.5" y1="12" x2="21" y2="12" stroke="#9333EA" strokeWidth="1.5" />
      <line x1="5.5" y1="5.5" x2="8.8" y2="8.8" stroke="#C084FC" strokeWidth="1.4" />
      <line x1="15.2" y1="15.2" x2="18.5" y2="18.5" stroke="#C084FC" strokeWidth="1.4" />
      <line x1="18.5" y1="5.5" x2="15.2" y2="8.8" stroke="#C084FC" strokeWidth="1.4" />
      <line x1="8.8" y1="15.2" x2="5.5" y2="18.5" stroke="#C084FC" strokeWidth="1.4" />
      {/* Specialist Agent Nodes */}
      <circle cx="12" cy="3" r="1.8" fill="#A855F7" />
      <circle cx="12" cy="21" r="1.8" fill="#A855F7" />
      <circle cx="3" cy="12" r="1.8" fill="#A855F7" />
      <circle cx="21" cy="12" r="1.8" fill="#A855F7" />
    </svg>
  )
}

/** AGT-01: Data Reconciler - Cross-System ETL Synchronization & Verified Audit Check */
export function IconDataReconciler({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Top synchronization arrow */}
      <path d="M4 12C4 7.58 7.58 4 12 4C14.6 4 16.9 5.25 18.3 7.2M18.3 7.2V4M18.3 7.2H15.3" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom synchronization arrow */}
      <path d="M20 12C20 16.42 16.42 20 12 20C9.4 20 7.1 18.75 5.7 16.8M5.7 16.8V20M5.7 16.8H8.7" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Reconciled clean data check in center */}
      <circle cx="12" cy="12" r="3.5" fill="#E0F2FE" />
      <path d="M10.2 12.1L11.4 13.3L13.8 10.7" stroke="#0284C7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** AGT-02: Stock Monitor - 24/7 Real-Time Usable Stock Radar & Buffer Surveillance */
export function IconStockMonitor({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="9" stroke="#059669" strokeWidth="1.5" strokeOpacity="0.3" />
      <circle cx="12" cy="12" r="6" stroke="#059669" strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="2.5" fill="#059669" />
      <path d="M12 12L19 7" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="8.5" r="1.5" fill="#34D399" />
      <circle cx="8" cy="15" r="1.2" fill="#10B981" />
    </svg>
  )
}

/** AGT-03: Shortage Forecast - Non-Linear Material Depletion Vector & Stockout Curve */
export function IconShortageForecast({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Coordinate axes */}
      <path d="M3 4V20H20" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Steep depletion trajectory curve */}
      <path d="M4 7C8 8.5 11 12.5 15.5 18" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
      {/* Dotted forecast projection into zero stock */}
      <path d="M15.5 18L19.5 20" stroke="#EF4444" strokeWidth="2" strokeDasharray="2 2" strokeLinecap="round" />
      {/* Critical halt threshold indicator */}
      <circle cx="15.5" cy="18" r="2.5" fill="#DC2626" />
      <path d="M15.5 17V19" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/** AGT-04: BOM Twin & Capacity - Hierarchical Bill-of-Materials Graph & Constraint Solver */
export function IconBomTwin({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Finished Smartphone Master Assembly Node */}
      <rect x="9" y="3" width="6" height="4" rx="1" fill="#B45309" />
      {/* Explosion Tree Connection Pipes */}
      <path d="M12 7V10.5 M5 10.5H19 M5 10.5V14.5 M12 10.5V14.5 M19 10.5V14.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
      {/* Child Sub-Assemblies & Components */}
      <rect x="2.5" y="14.5" width="5" height="4.5" rx="1" fill="#F59E0B" />
      <rect x="9.5" y="14.5" width="5" height="4.5" rx="1" fill="#F59E0B" />
      <rect x="16.5" y="14.5" width="5" height="4.5" rx="1" fill="#F59E0B" />
      {/* Bottleneck constraint marker in center node */}
      <circle cx="12" cy="16.7" r="1.1" fill="#FFFFFF" />
    </svg>
  )
}

/** AGT-05: Replenishment - Formal B2B Purchase Order Document & MOQ Procurement */
export function IconReplenishment({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Enterprise PO Contract Document */}
      <rect x="4" y="3" width="13" height="18" rx="2" fill="#FAF5FF" stroke="#7C3AED" strokeWidth="1.5" />
      {/* Document text lines */}
      <line x1="7" y1="7" x2="14" y2="7" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="10" x2="12" y2="10" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
      <line x1="7" y1="13" x2="13" y2="13" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
      {/* Certified Replenishment Stamp with Checkmark */}
      <circle cx="16.5" cy="16.5" r="4.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="1" />
      <path d="M14.5 16.5L16 18L18.5 15.5" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** AGT-06: E&O Dead Stock - Working Capital Vault & Idle Inventory Circulation */
export function IconDeadStock({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Capital currency circle */}
      <circle cx="12" cy="12" r="8.5" fill="#F0FDFA" stroke="#0D9488" strokeWidth="1.5" />
      {/* Currency ₹ symbol / recovery arrows */}
      <path d="M9.5 8H14.5 M9.5 10.5H13.5 M9.5 8C12 8 13.5 9 13.5 11C13.5 12.5 12 13.5 10 13.5L14.5 17" stroke="#0D9488" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* 90-day idle circulation dots */}
      <circle cx="19" cy="6" r="1.5" fill="#14B8A6" />
      <circle cx="5" cy="18" r="1.5" fill="#14B8A6" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GOVERNANCE (Human Sign-Off Gate)
// ─────────────────────────────────────────────────────────────────────────────

/** Feasibility & Capacity - 7-Department Sequential Simulation Pipeline DAG */
export function IconFeasibilityWorkflow({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="5" cy="12" r="3" fill="#0284C7" />
      <circle cx="12" cy="7" r="3" fill="#38BDF8" />
      <circle cx="12" cy="17" r="3" fill="#38BDF8" />
      <circle cx="19" cy="12" r="3" fill="#0284C7" />
      <path d="M7.5 10.5L9.5 8.5 M7.5 13.5L9.5 15.5 M14.5 8.5L16.5 10.5 M14.5 15.5L16.5 13.5" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="19" cy="12" r="1.2" fill="#FFFFFF" />
    </svg>
  )
}

/** Human Approval Gate - Executive Security Shield & Role-Based Sign-Off */
export function IconHumanApproval({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Governance security shield */}
      <path d="M12 3L4 6V11C4 16.5 7.4 20.8 12 22C16.6 20.8 20 16.5 20 11V6L12 3Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
      {/* User profile silhouette in shield */}
      <circle cx="12" cy="9.5" r="2.5" fill="#D97706" />
      <path d="M8 15.5C8 13.5 9.8 12.8 12 12.8C14.2 12.8 16 13.5 16 15.5V16H8V15.5Z" fill="#D97706" />
      {/* Sign-off approved check badge */}
      <circle cx="16.5" cy="16.5" r="3.5" fill="#10B981" />
      <path d="M15 16.5L16.2 17.7L18 15.5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CLOSED-LOOP EXECUTION & TWIN
// ─────────────────────────────────────────────────────────────────────────────

/** PO Release & Transfers - Enterprise Inter-Plant Logistics & SAP BAPI Transit */
export function IconPoRelease({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Inter-plant transfer container / crate */}
      <rect x="3" y="6" width="13" height="12" rx="1.5" fill="#D1FAE5" stroke="#059669" strokeWidth="1.5" />
      <path d="M3 10H16 M7 6V18 M12 6V18" stroke="#059669" strokeWidth="1" strokeOpacity="0.4" />
      {/* Outbound dispatch arrow into plant */}
      <path d="M15 12H21 M18 9L21 12L18 15" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Certified Release check badge */}
      <circle cx="6" cy="15" r="2" fill="#059669" />
      <path d="M5.2 15L5.8 15.6L6.8 14.4" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Dual Alert Routing - Targeted Escalation Bell for Plant Ops & Customer Service */
export function IconDualAlert({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 4C8.7 4 6 6.7 6 10V14L4 16H20L18 14V10C18 6.7 15.3 4 12 4Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
      <path d="M10 18C10 19.1 10.9 20 12 20C13.1 20 14 19.1 14 18" stroke="#D97706" strokeWidth="1.5" />
      {/* Dual diverging signal wave beams (Plant Ops vs Customer Service) */}
      <path d="M18.5 7C19.8 8.2 20.5 9.5 20.5 11" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 7C4.2 8.2 3.5 9.5 3.5 11" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 3D Twin & OTIF Portal - Isometric 3D Warehouse Mesh & Delivery Milestones */
export function Icon3DTwinOtif({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Isometric 3D Warehouse Cube */}
      <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 3V12 M20 7.5L12 12 M4 7.5L12 12 M12 12V21" stroke="#2563EB" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Top isometric plane grid */}
      <path d="M8 5.2L16 9.7 M16 5.2L8 9.7" stroke="#93C5FD" strokeWidth="1" strokeDasharray="1 1" />
      {/* Center target milestone crosshair */}
      <circle cx="12" cy="12" r="2" fill="#2563EB" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMS SOLVED ICONS (5 Core Problems)
// ─────────────────────────────────────────────────────────────────────────────

export function IconProblemShortage({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M2 17L9 10L13 14L18 5" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="5" r="2" fill="#DC2626" />
    </svg>
  )
}

export function IconProblemBottleneck({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 4H17L12 11V16L8 18V11L3 4Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="8" r="1.5" fill="#D97706" />
    </svg>
  )
}

export function IconProblemDelay({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="10" cy="10" r="8" stroke="#7C3AED" strokeWidth="1.8" />
      <path d="M10 6V10L13 13" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IconProblemDeadStock({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="10" cy="10" r="7.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.6" />
      <rect x="7" y="9" width="6" height="5" rx="1" fill="#0284C7" />
      <path d="M8.5 9V7C8.5 6.2 9.2 5.5 10 5.5C10.8 5.5 11.5 6.2 11.5 7V9" stroke="#0284C7" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconProblemPhantom({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      {/* Audit balance scale comparing ERP vs WMS */}
      <line x1="10" y1="3" x2="10" y2="17" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="7" x2="16" y2="7" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 7L2 12H6L4 7Z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.2" />
      <path d="M16 7L14 14H18L16 7Z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.2" />
      <line x1="7" y1="17" x2="13" y2="17" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE HEADER & PROBLEMS BADGE ICONS
// ─────────────────────────────────────────────────────────────────────────────

export function IconPipelineHeader({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="#7C3AED" />
      <rect x="12" y="2" width="6" height="6" rx="1.5" fill="#9333EA" />
      <rect x="7" y="12" width="6" height="6" rx="1.5" fill="#6D28D9" />
      <line x1="5" y1="8" x2="10" y2="12" stroke="#C084FC" strokeWidth="1.5" />
      <line x1="15" y1="8" x2="10" y2="12" stroke="#C084FC" strokeWidth="1.5" />
    </svg>
  )
}

export function IconTargetProblems({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
      <circle cx="8" cy="8" r="7" stroke="#EA580C" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="4.5" stroke="#EA580C" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="2" fill="#EA580C" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC RESOLVER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function renderArchitectureIcon(nodeId: string, size = 16): React.ReactNode {
  switch (nodeId) {
    case 'src-sap':
      return <IconSapErp size={size} />
    case 'src-mes':
      return <IconSiemensMes size={size} />
    case 'src-wms':
      return <IconWmsTwin size={size} />
    case 'src-excel':
      return <IconExcel size={size} />
    case 'ing-fastapi':
      return <IconFastApi size={size} />
    case 'ing-postgres':
      return <IconPostgres size={size} />
    case 'agt-07':
    case 'agt-10':
      return <IconOrchestrator size={size} />
    case 'agt-01':
      return <IconDataReconciler size={size} />
    case 'agt-02':
      return <IconStockMonitor size={size} />
    case 'agt-03':
      return <IconShortageForecast size={size} />
    case 'agt-04':
      return <IconBomTwin size={size} />
    case 'agt-05':
      return <IconReplenishment size={size} />
    case 'agt-06':
    case 'agt-09':
      return <IconDeadStock size={size} />
    case 'gov-workflows':
      return <IconFeasibilityWorkflow size={size} />
    case 'gov-approval':
      return <IconHumanApproval size={size} />
    case 'act-po':
      return <IconPoRelease size={size} />
    case 'act-alert':
      return <IconDualAlert size={size} />
    case 'act-twin':
      return <Icon3DTwinOtif size={size} />
    default:
      return null
  }
}

export function renderProblemIcon(problemId: string, size = 14): React.ReactNode {
  switch (problemId) {
    case 'prob-shortages':
      return <IconProblemShortage size={size} />
    case 'prob-bottlenecks':
      return <IconProblemBottleneck size={size} />
    case 'prob-delays':
      return <IconProblemDelay size={size} />
    case 'prob-deadstock':
      return <IconProblemDeadStock size={size} />
    case 'prob-phantom':
      return <IconProblemPhantom size={size} />
    default:
      return null
  }
}
