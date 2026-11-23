import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './Shell'

// Keep primary landing views instant
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Overview } from './pages/Overview'

// Lazy-load heavier secondary pages and visualizers for instant route transitions & code-splitting
const Warehouse3DFlow = lazy(() => import('./pages/Warehouse3DFlow').then(m => ({ default: m.Warehouse3DFlow })))
const StockExplorer = lazy(() => import('./pages/StockExplorer').then(m => ({ default: m.StockExplorer })))
const MaterialPicker = lazy(() => import('./pages/Material360').then(m => ({ default: m.MaterialPicker })))
const Material360 = lazy(() => import('./pages/Material360').then(m => ({ default: m.Material360 })))
const DigitalTwin = lazy(() => import('./pages/DigitalTwin').then(m => ({ default: m.DigitalTwin })))
const ShortageHorizon = lazy(() => import('./pages/ShortageHorizon').then(m => ({ default: m.ShortageHorizon })))
const BuildCapacity = lazy(() => import('./pages/BuildCapacity').then(m => ({ default: m.BuildCapacity })))
const SupplierDelaySimulator = lazy(() => import('./pages/SupplierDelaySimulator').then(m => ({ default: m.SupplierDelaySimulator })))
const Procurement = lazy(() => import('./pages/Procurement').then(m => ({ default: m.Procurement })))
const Proposals = lazy(() => import('./pages/Proposals').then(m => ({ default: m.Proposals })))
const ProposalDetail = lazy(() => import('./pages/ProposalDetail').then(m => ({ default: m.ProposalDetail })))
const ProposalPicker = lazy(() => import('./pages/ProposalPicker').then(m => ({ default: m.ProposalPicker })))
const DeadStock = lazy(() => import('./pages/DeadStock').then(m => ({ default: m.DeadStock })))
const QualityHold = lazy(() => import('./pages/QualityHold').then(m => ({ default: m.QualityHold })))
const Receiving = lazy(() => import('./pages/Receiving').then(m => ({ default: m.Receiving })))
const CycleCounts = lazy(() => import('./pages/CycleCounts').then(m => ({ default: m.CycleCounts })))
const Dispatch = lazy(() => import('./pages/Dispatch').then(m => ({ default: m.Dispatch })))
const Traceability = lazy(() => import('./pages/Traceability').then(m => ({ default: m.Traceability })))
const DailyBrief = lazy(() => import('./pages/DailyBrief').then(m => ({ default: m.DailyBrief })))
const AgentHub = lazy(() => import('./pages/AgentHub').then(m => ({ default: m.AgentHub })))
const AgentTester = lazy(() => import('./pages/AgentTester').then(m => ({ default: m.AgentTester })))
const AgentWorkspace = lazy(() => import('./pages/AgentWorkspace').then(m => ({ default: m.AgentWorkspace })))
const AgentWorkflow = lazy(() => import('./pages/AgentWorkflow').then(m => ({ default: m.AgentWorkflow })))
const ManualTrigger = lazy(() => import('./pages/ManualTrigger').then(m => ({ default: m.ManualTrigger })))
const RunHistory = lazy(() => import('./pages/RunHistory').then(m => ({ default: m.RunHistory })))
const Connectors = lazy(() => import('./pages/Connectors').then(m => ({ default: m.Connectors })))
const DataUploads = lazy(() => import('./pages/DataUploads').then(m => ({ default: m.DataUploads })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))

function RouteLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        gap: 10,
        color: '#6D28D9',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '2.5px solid #E2E8F0',
          borderTopColor: '#6D28D9',
          animation: 'spin 0.6s linear infinite',
        }}
      />
      <span>Loading operational module...</span>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    document.documentElement.style.colorScheme = 'light'
    try {
      localStorage.setItem('picktwin.theme', 'light')
    } catch {
      // Ignore
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/warehouse-3d"
        element={
          <Suspense fallback={<RouteLoader />}>
            <Warehouse3DFlow />
          </Suspense>
        }
      />
      <Route element={<Shell />}>
        {/* Default route lands on Home: Inventory at a Glance */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />

        {/* Monitor */}
        <Route path="/overview" element={<Overview />} />
        <Route
          path="/stock"
          element={
            <Suspense fallback={<RouteLoader />}>
              <StockExplorer />
            </Suspense>
          }
        />
        <Route
          path="/material"
          element={
            <Suspense fallback={<RouteLoader />}>
              <MaterialPicker />
            </Suspense>
          }
        />
        <Route
          path="/material/:materialId"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Material360 />
            </Suspense>
          }
        />
        <Route
          path="/digital-twin"
          element={
            <Suspense fallback={<RouteLoader />}>
              <DigitalTwin />
            </Suspense>
          }
        />

        {/* Plan */}
        <Route
          path="/shortages"
          element={
            <Suspense fallback={<RouteLoader />}>
              <ShortageHorizon />
            </Suspense>
          }
        />
        <Route
          path="/capacity"
          element={
            <Suspense fallback={<RouteLoader />}>
              <BuildCapacity />
            </Suspense>
          }
        />
        <Route
          path="/build-capacity"
          element={
            <Suspense fallback={<RouteLoader />}>
              <BuildCapacity />
            </Suspense>
          }
        />
        <Route
          path="/simulation"
          element={
            <Suspense fallback={<RouteLoader />}>
              <SupplierDelaySimulator />
            </Suspense>
          }
        />

        {/* Act */}
        <Route
          path="/procurement"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Procurement />
            </Suspense>
          }
        />
        <Route
          path="/proposals"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Proposals />
            </Suspense>
          }
        />
        <Route
          path="/proposals/:id"
          element={
            <Suspense fallback={<RouteLoader />}>
              <ProposalDetail />
            </Suspense>
          }
        />
        <Route
          path="/proposal"
          element={
            <Suspense fallback={<RouteLoader />}>
              <ProposalPicker />
            </Suspense>
          }
        />
        <Route
          path="/dead-stock"
          element={
            <Suspense fallback={<RouteLoader />}>
              <DeadStock />
            </Suspense>
          }
        />

        {/* Warehouse */}
        <Route
          path="/quality"
          element={
            <Suspense fallback={<RouteLoader />}>
              <QualityHold />
            </Suspense>
          }
        />
        <Route
          path="/receiving"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Receiving />
            </Suspense>
          }
        />
        <Route
          path="/cycle-counts"
          element={
            <Suspense fallback={<RouteLoader />}>
              <CycleCounts />
            </Suspense>
          }
        />
        <Route
          path="/dispatch"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Dispatch />
            </Suspense>
          }
        />
        <Route
          path="/traceability"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Traceability />
            </Suspense>
          }
        />

        {/* Reports */}
        <Route
          path="/brief"
          element={
            <Suspense fallback={<RouteLoader />}>
              <DailyBrief />
            </Suspense>
          }
        />

        {/* AI Agents */}
        <Route
          path="/agents"
          element={
            <Suspense fallback={<RouteLoader />}>
              <AgentHub />
            </Suspense>
          }
        />
        <Route
          path="/agent-hub"
          element={
            <Suspense fallback={<RouteLoader />}>
              <AgentHub />
            </Suspense>
          }
        />
        <Route
          path="/agent-tester"
          element={
            <Suspense fallback={<RouteLoader />}>
              <AgentTester />
            </Suspense>
          }
        />
        <Route
          path="/agent-tester/:agentId"
          element={
            <Suspense fallback={<RouteLoader />}>
              <AgentTester />
            </Suspense>
          }
        />
        <Route
          path="/agent"
          element={
            <Suspense fallback={<RouteLoader />}>
              <AgentWorkspace />
            </Suspense>
          }
        />
        <Route
          path="/agent/workflow"
          element={
            <Suspense fallback={<RouteLoader />}>
              <AgentWorkflow />
            </Suspense>
          }
        />
        <Route
          path="/agent/trigger"
          element={
            <Suspense fallback={<RouteLoader />}>
              <ManualTrigger />
            </Suspense>
          }
        />
        <Route
          path="/agent/runs"
          element={
            <Suspense fallback={<RouteLoader />}>
              <RunHistory />
            </Suspense>
          }
        />

        {/* Data & Connectors */}
        <Route
          path="/connectors"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Connectors />
            </Suspense>
          }
        />
        <Route
          path="/uploads"
          element={
            <Suspense fallback={<RouteLoader />}>
              <DataUploads />
            </Suspense>
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <Suspense fallback={<RouteLoader />}>
              <Settings />
            </Suspense>
          }
        />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  )
}
