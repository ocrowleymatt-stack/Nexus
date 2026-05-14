import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { RotateCcw, Network, FileText, Database, Search as SearchIcon, Compass, LogIn, LogOut, Save, FolderOpen, Plus, Trash2, Gavel, Loader2, ShieldAlert, Shield, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose, PanelLeft, PanelRight, X } from 'lucide-react'
import IngestToGraphPanel from './components/IngestToGraphPanel'
import { NetworkMap } from './components/NetworkMap'
import { SearchOverlay } from './components/SearchOverlay'
import { GoldenShowerEffect, OCSignature } from './components/GoldenShowerEffect'
import { deepSearchEntity, extractIntelligenceFromCsv, extractIntelligenceFromUrl, huntZipIntelligence, expandGraph, forensicSearchNode, veniceSensemaking, extractIntelligenceFromText, reconstructVisual } from './services/geminiService'
import { mergeGraphs } from './lib/intelligenceGraph'
import { auth, loginWithGoogle } from './lib/firebase'
import { onAuthStateChanged, User, signOut } from 'firebase/auth'
import { saveProject, getProjects, deleteProject } from './lib/firestoreService'

import { NarrativeSidebar } from './components/NarrativeSidebar'
import ReportingDeck from './components/ReportingDeck'
import VisualSettingsPanel from './components/VisualSettingsPanel'
import ImportDeck from './components/ImportDeck'
import QuantumSearchPanel from './components/QuantumSearchPanel'
import CorroborationPanel from './components/CorroborationPanel'
import InterrogationPanel from './components/InterrogationPanel'
import { DashboardStats, fetchDashboardStats } from './services/dashboardService'
import { VisualSettings } from './types'
import { NexusGraph } from './types/graph'

type GraphData = {
  nodes: any[]
  links: any[]
  narrative?: string
  centralNode?: string
}

const initialGraph: GraphData = {
  nodes: [],
  links: []
}

const defaultVisualSettings: VisualSettings = {
  theme: 'default',
  nodeShape: 'circle',
  linkStyle: 'default',
  showDataFlags: true
}

type WorkspaceTab = 'ingest' | 'query' | 'quantum' | 'corroboration' | 'projects' | 'reporting' | 'visuals'

export default function App() {
  console.log('[CLIENT] App rendering');
  const [graph, setGraph] = useState<GraphData>(initialGraph)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [centralNode, setCentralNode] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(true)
  const [showNarrative, setShowNarrative] = useState(false)
  const [driveToken, setDriveToken] = useState<string | null>(null)
  const [isVeniceLoading, setIsVeniceLoading] = useState(false)
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => {
    const cached = localStorage.getItem('nexus_visual_settings');
    return cached ? JSON.parse(cached) : defaultVisualSettings;
  })
  
  // Auth & Projects State
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('nexus_user_hint');
    return cached ? JSON.parse(cached) : null;
  })
  const [authLoading, setAuthLoading] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem('nexus_curr_pid'))
  const [projectName, setProjectName] = useState('New Investigation')
  const [isSaving, setIsSaving] = useState(false)
  const [showImportDeck, setShowImportDeck] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ingest')
  const [autoGrow, setAutoGrow] = useState(false)
  const [forensicReports, setForensicReports] = useState<Record<string, string>>({})
  const [loadingForensic, setLoadingForensic] = useState<Record<string, boolean>>({})
  const [reconstructedImages, setReconstructedImages] = useState<Record<string, string>>({})
  const [isReconstructing, setIsReconstructing] = useState<Record<string, boolean>>({})
  const [minimalMode, setMinimalMode] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)


  const liveStats: DashboardStats = dashboardStats ?? {
    source: 'local',
    investigations: projects.length + (currentProjectId ? 0 : graph.nodes.length > 0 ? 1 : 0),
    files: graph.nodes.filter((node) => node.type === 'file' || node.group === 'file').length,
    dataPoints: graph.nodes.length + graph.links.length,
    entities: graph.nodes.length,
    correlations: graph.links.length
  }

  const refreshDashboardStats = useCallback(async () => {
    try {
      setDashboardStats(await fetchDashboardStats())
    } catch (err) {
      console.warn('[DASHBOARD_STATS_FALLBACK]', err)
      setDashboardStats(null)
    }
  }, [])

  useEffect(() => {
    refreshDashboardStats()
    const interval = setInterval(refreshDashboardStats, 30000)
    return () => clearInterval(interval)
  }, [refreshDashboardStats])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        localStorage.setItem('nexus_user_hint', JSON.stringify({ uid: u.uid, email: u.email }));
        fetchProjects()
      } else {
        localStorage.removeItem('nexus_user_hint');
        setProjects([])
        // We don't clear currentProjectId immediately to allow local-only work
      }
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const fetchProjects = async () => {
    const list = await getProjects()
    setProjects(list)
  }

  const handleDownloadBackup = () => {
    const data = {
      graph,
      projectName,
      centralNode,
      timestamp: new Date().toISOString(),
      nexus_version: "2.0-clinical"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `LOCAL_COPY_${projectName.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSave = async (forceName?: string) => {
    if (!user) return
    setIsSaving(true)
    try {
      const id = currentProjectId || `proj_${Date.now()}`
      const name = forceName || projectName
      await saveProject(id, name, graph, centralNode)
      if (!currentProjectId) {
        setCurrentProjectId(id)
      }
      fetchProjects()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Autosave when graph changes
  useEffect(() => {
    if (graph.nodes.length > 0 && user) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        handleSave()
      }, 2000)
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [graph, projectName, centralNode, user])

  const startNewProject = () => {
    setGraph(initialGraph)
    setCurrentProjectId(null)
    setProjectName('New Investigation')
    setSelectedNode(null)
    setCentralNode(null)
    setOverlayOpen(true)
  }

  const loadProject = (p: any) => {
    setGraph(p.graph)
    setCurrentProjectId(p.id)
    setProjectName(p.name)
    setCentralNode(p.centralNode)
    setOverlayOpen(false)
    setActiveTab('ingest')
  }

  const mergeProject = (p: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to merge "${p.name}" into your current workspace?`)) {
      setGraph(prev => mergeGraphs(prev, p.graph))
      setProjectName(prev => `${prev} + ${p.name}`)
      setActiveTab('ingest')
    }
  }

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id)
      if (currentProjectId === id) {
        startNewProject()
      }
      fetchProjects()
    }
  }

  const reset = () => {
    setGraph(initialGraph)
    setSelectedNode(null)
    setCentralNode(null)
    setError(null)
  }

  const handleDeepSearch = async (query: string) => {
    setIsSearching(true)
    setError(null)
    try {
      const result = await deepSearchEntity(query)
      setGraph(prev => mergeGraphs(prev, result))
      if (result.centralNode) setCentralNode(result.centralNode)
      setOverlayOpen(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Deep search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleExpandGraph = async () => {
    if (!graph.nodes.length || isSearching) return
    setIsSearching(true)
    setError(null)
    try {
      const expandedData = await expandGraph(graph)
      setGraph(prev => mergeGraphs(prev, expandedData))
    } catch (err: any) {
      console.error("Expansion failed:", err)
      setError(`AI was unable to expand the map further. ${err.message || ''}`)
    } finally {
      setIsSearching(false)
    }
  }

  // Auto-Grow Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoGrow && graph.nodes.length > 0 && !isSearching) {
      interval = setInterval(() => {
        handleExpandGraph();
      }, 45000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoGrow, graph.nodes.length, isSearching]);

  useEffect(() => {
    const checkSystemUpdates = async () => {
      if (graph.nodes.length === 0 && !currentProjectId && user) {
        console.log('[SYSTEM] Auto-Syncing Remote Intelligence...');
        try {
          // Simulate a sync from ocrowley/nexus-intelligence
          const report = `
# System Intelligence Update: 05-06-2026
Source: Global Nexus Lattice Sync

### New Investigative Node:
- **Project Venice**: Identified as a multi-stage coordination effort.
- **Matt Crowley**: Lead Investigator (Verified).

### Status:
Synchronized with remote repository. 12 new correlations identified.
          `;
          const result = await extractIntelligenceFromText(report);
          setGraph(prev => mergeGraphs(prev, result));
          setProjectName("Nexus Intelligence Sync");
          setOverlayOpen(false);
          console.log('[SYSTEM] Sync Complete.');
        } catch (e) {
          console.error('[SYSTEM_SYNC_ERROR]', e);
        }
      }
    };
    checkSystemUpdates();
  }, [user]);

  // Local Storage Sync (Local Copy)
  useEffect(() => {
    if (graph.nodes.length > 0) {
      localStorage.setItem('nexus_last_graph', JSON.stringify(graph));
      localStorage.setItem('nexus_last_project_name', projectName);
      if (centralNode) localStorage.setItem('nexus_last_central', centralNode);
    }
    localStorage.setItem('nexus_visual_settings', JSON.stringify(visualSettings));
  }, [graph, projectName, centralNode, visualSettings]);

  useEffect(() => {
    const cachedGraph = localStorage.getItem('nexus_last_graph');
    const cachedName = localStorage.getItem('nexus_last_project_name');
    const cachedCentral = localStorage.getItem('nexus_last_central');
    
    if (cachedGraph && graph.nodes.length === 0) {
      try {
        const parsed = JSON.parse(cachedGraph);
        setGraph(parsed);
        if (cachedName) setProjectName(cachedName);
        if (cachedCentral) setCentralNode(cachedCentral);
        setOverlayOpen(false); // Close overlay if we have data
      } catch (e) {
        console.error("Local cache recovery failed", e);
      }
    }
  }, []);

  const handleTextUpload = async (textData: string) => {
    setIsSearching(true)
    setError(null)
    try {
      const result = await extractIntelligenceFromText(textData)
      setGraph(prev => mergeGraphs(prev, result))
      if (result.centralNode) setCentralNode(result.centralNode)
      setOverlayOpen(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Text extraction failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleCsvUpload = async (csvData: string) => {
    setIsSearching(true)
    setError(null)
    try {
      console.log("[CLIENT] Initiating CSV Intelligence Extraction...");
      const result = await extractIntelligenceFromCsv(csvData)
      console.log("[CLIENT] Extraction Complete. Merging into Graph.");
      setGraph(prev => mergeGraphs(prev, result))
      if (result.centralNode) setCentralNode(result.centralNode)
      setOverlayOpen(false)
    } catch (err: any) {
      console.error("[CSV_UPLOAD_ERROR]", err);
      setError(`Intelligence Extraction Failed: ${err.message || 'Unknown server error'}. Check your API keys and try again.`);
    } finally {
      setIsSearching(false)
    }
  }

  const handleZipUpload = async (zipName: string, fileTree: string[], samples: any) => {
    setIsSearching(true)
    setError(null)
    try {
      const result = await huntZipIntelligence(zipName, fileTree, samples)
      setGraph(prev => mergeGraphs(prev, result))
      if (result.centralNode) setCentralNode(result.centralNode)
      setOverlayOpen(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'ZIP extraction failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleVeniceSensemaking = async () => {
    setIsVeniceLoading(true)
    setError(null)
    try {
      const refinedData = await veniceSensemaking({
        nodes: graph.nodes,
        links: graph.links,
        narrative: graph.narrative
      })
      setGraph(refinedData)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Venice Sensemaking failed')
    } finally {
      setIsVeniceLoading(false)
    }
  }

  const handleNodeClick = (node: any) => {
    if (node.id === 'SYSTEM_EXPAND') {
      handleExpandGraph();
    } else {
      setSelectedNode(node)
      const newCentral = node.label || node.name || node.id
      if (newCentral) setCentralNode(newCentral)
      setShowRightSidebar(true) // Force reveal intelligence profile
    }
  }

  const handleForensicSearch = async (node: any) => {
    const nodeId = node.id
    setLoadingForensic(prev => ({ ...prev, [nodeId]: true }))
    try {
      const report = await forensicSearchNode(node.name || node.id)
      setForensicReports(prev => ({ ...prev, [nodeId]: report }))
    } catch (err) {
      console.error(err)
      setForensicReports(prev => ({ ...prev, [nodeId]: "Forensic search failed or no records accessible." }))
    } finally {
      setLoadingForensic(prev => ({ ...prev, [nodeId]: false }))
    }
  }

  const handleReconstructVisual = async (node: any) => {
    const nodeId = node.id
    setIsReconstructing(prev => ({ ...prev, [nodeId]: true }))
    try {
      const seedImage = localStorage.getItem('nexus_forensic_seed') || undefined
      const base64 = await reconstructVisual(node.name || node.id, node.description || '', seedImage)
      setReconstructedImages(prev => ({ ...prev, [nodeId]: `data:image/png;base64,${base64}` }))
    } catch (err) {
      console.error(err)
      alert("Visual reconstruction failed. Forensic engine may be busy.")
    } finally {
      setIsReconstructing(prev => ({ ...prev, [nodeId]: false }))
    }
  }

  const graphForMap = {
    centralNode: centralNode || 'Nexus Intelligence Core',
    narrative: graph.narrative || 'Awaiting investigative ingestion.',
    nodes: graph.nodes,
    links: graph.links
  }

  const [showLeftSidebar, setShowLeftSidebar] = useState(false)
  const [showRightSidebar, setShowRightSidebar] = useState(false) 

  // Sync State back to Control Centre if linked
  useEffect(() => {
    if (window.opener || window.parent !== window) {
      const target = window.opener || window.parent;
      // Broadened target origin for flexible integration, but specifically targeting nexus.ocrowley.com preferred
      const targetOrigin = '*'; 
      target.postMessage({ 
        command: 'GRAPH_UPDATED', 
        payload: { 
          graph, 
          projectName, 
          centralNode,
          isLinked,
          timestamp: new Date().toISOString()
        } 
      }, targetOrigin);
    }
  }, [graph, projectName, centralNode, isLinked]);

  // Remote Pulse Listener - Listen for nexus.ocrowley.com commands
  useEffect(() => {
    const handleRemoteCommand = (event: MessageEvent) => {
      // Allow nexus.ocrowley.com or any o-crowley subdomains for testing
      if (!event.origin.includes('ocrowley.com') && !event.origin.includes('run.app')) return;
      
      const { command, payload } = event.data;
      if (!command) return;

      console.log(`[NEXUS_REMOTE] Command received: ${command}`, payload);
      setIsLinked(true); // Flag that we are being controlled remotely

      switch(command) {
        case 'INGEST_ENTITY':
          handleDeepSearch(payload.query);
          break;
        case 'INGEST_TEXT':
          extractIntelligenceFromText(payload.text).then(r => setGraph(prev => mergeGraphs(prev, r)));
          break;
        case 'INGEST_URL':
          extractIntelligenceFromUrl(payload.url).then(r => setGraph(prev => mergeGraphs(prev, r)));
          break;
        case 'EXPAND_GRAPH':
          handleExpandGraph();
          break;
        case 'SET_MINIMAL':
          setMinimalMode(payload.enabled);
          if (payload.enabled) {
            setShowLeftSidebar(false);
            setShowRightSidebar(false);
          }
          break;
        case 'TOGGLE_SIDEBAR':
          if (payload.side === 'left') setShowLeftSidebar(payload.enabled);
          if (payload.side === 'right') setShowRightSidebar(payload.enabled);
          break;
        case 'RECONSTRUCT_IMAGE':
          handleReconstructVisual({ id: payload.entityName, name: payload.entityName, description: payload.description });
          break;
        case 'LOAD_FULL_GRAPH':
          setGraph(payload.graph);
          if (payload.projectName) setProjectName(payload.projectName);
          break;
        case 'SENSEMAKING':
          veniceSensemaking(graph).then(r => setGraph(r));
          break;
        case 'SET_THEME':
          setVisualSettings(prev => ({ ...prev, theme: payload.theme }));
          break;
        case 'PING':
          // @ts-ignore
          event.source?.postMessage({ command: 'PONG', payload: { version: '2.5.0-pulse' } }, { targetOrigin: event.origin });
          break;
      }
    };

    window.addEventListener('message', handleRemoteCommand);
    return () => window.removeEventListener('message', handleRemoteCommand);
  }, [graph, visualSettings]);

  return (
    <div className="relative flex h-screen w-screen bg-[#050505] text-white selection:bg-[#d4af37] selection:text-black overflow-hidden font-sans">
      {/* Toggle Controls - Minimized to single Pulse button when hidden */}
      <div className={`fixed top-6 left-6 z-[60] flex items-center gap-3 transition-opacity duration-500 ${minimalMode ? 'opacity-20 hover:opacity-100' : 'opacity-100'}`}>
        <button 
          onClick={() => setOverlayOpen(true)}
          className="p-4 rounded-2xl bg-[#d4af37] text-black shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 transition-all group border-none"
          title="Pulse Menu"
        >
          <SearchIcon size={24} className="group-hover:rotate-12 transition-transform" />
        </button>
        
        {!minimalMode && (
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#d4af37] font-bold tracking-tighter uppercase leading-none">Nexus Pulse</span>
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest mt-1">Remote Link: Active</span>
          </div>
        )}
      </div>

      <div className={`fixed bottom-6 left-6 z-[60] flex items-center gap-2 transition-all duration-500 ${minimalMode ? 'opacity-0 translate-y-10 group-hover:opacity-100 group-hover:translate-y-0' : 'opacity-100'}`}>
        <button 
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className="p-3 rounded-xl bg-black/40 border border-white/10 text-white/30 hover:text-[#d4af37] transition-all backdrop-blur-md"
        >
          <PanelLeft size={18} />
        </button>
        <button 
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className="p-3 rounded-xl bg-black/40 border border-white/10 text-white/30 hover:text-[#d4af37] transition-all backdrop-blur-md"
        >
          <PanelRight size={18} />
        </button>
        {minimalMode && (
          <button 
            onClick={() => setMinimalMode(false)}
            className="p-3 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-bold uppercase transition-all backdrop-blur-md"
          >
            Exit Minimal
          </button>
        )}
      </div>

      {/* Show/Hide Minimal Toggle for quick access */}
      {!minimalMode && (
        <div className="fixed bottom-6 right-6 z-[60]">
           <button 
            onClick={() => setMinimalMode(true)}
            className="px-4 py-2 rounded-xl bg-black/20 border border-white/5 text-[9px] font-mono text-white/20 hover:text-[#d4af37] hover:border-[#d4af37]/20 transition-all uppercase tracking-widest"
          >
            Enter Minimal (Visualizer Mode)
          </button>
        </div>
      )}

      {/* Left Sidebar - Floating Overlay Pattern */}
      <aside className={`z-[70] fixed inset-y-0 left-0 border-r border-white/10 bg-[#0c0c0c]/98 backdrop-blur-3xl flex flex-col shadow-2xl transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${showLeftSidebar ? 'w-[400px] translate-x-0' : 'w-0 -translate-x-full'}`}>
        <div className="relative border-b border-white/5 p-8 overflow-hidden group">
          <GoldenShowerEffect />
          <div className="relative z-10 flex items-center justify-between mb-4">
            <OCSignature />
            <div className="flex items-center gap-1">
              {authLoading ? (
                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : user ? (
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <button 
                  onClick={loginWithGoogle}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#d4af37] text-black rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                >
                  <LogIn size={14} />
                  ADR Login
                </button>
              )}
              <button 
                onClick={() => setShowLeftSidebar(false)}
                className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {isLinked ? (
            <div className="mt-8 p-6 border border-[#d4af37]/20 rounded-2xl bg-[#d4af37]/5 space-y-4">
              <div className="flex items-center gap-3 text-[#d4af37]">
                <Network size={20} className="animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Remote Controller Active</span>
              </div>
              <p className="text-[10px] font-mono text-white/40 uppercase leading-relaxed">
                This instance is being controlled by nexus.ocrowley.com. Manual local tools have been minimized to prevent state collision.
              </p>
              <button 
                onClick={() => setIsLinked(false)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[8px] font-mono text-white/20 uppercase tracking-widest transition-all"
              >
                Unlink and Restore Local Panel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowImportDeck(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 py-3 text-[10px] font-mono uppercase text-[#d4af37] hover:bg-[#d4af37]/20 transition-all font-bold"
              >
                <Database size={14} />
                Nexus Intelligence Port
              </button>

              <div className="space-y-4">
                <input 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-transparent border-none text-2xl font-display font-black tracking-tight text-[#d4af37] focus:outline-none focus:ring-0 placeholder:text-white/10"
                  placeholder="Project Name"
                />
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setOverlayOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.03] border border-white/10 py-4 text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37] hover:bg-white/[0.08] hover:border-[#d4af37]/40 active:scale-[0.98] transition-all group"
                  >
                    <SearchIcon size={14} />
                    Intel Ingest
                  </button>
                  
                  <div className="grid grid-cols-4 gap-1">
                    <button 
                      onClick={() => setActiveTab('ingest')}
                       className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'ingest' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                       Index
                    </button>
                    <button 
                      onClick={() => setActiveTab('query')}
                      className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'query' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                      Query
                    </button>
                    <button 
                      onClick={() => setActiveTab('quantum')}
                      className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'quantum' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                      Search
                    </button>
                    <button 
                      onClick={() => setActiveTab('corroboration')}
                      className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'corroboration' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                      Corro
                    </button>
                    <button 
                      onClick={() => setActiveTab('projects')}
                      className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'projects' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                      Vault
                    </button>
                    <button 
                      onClick={() => setActiveTab('reporting')}
                      className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'reporting' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                      Brief
                    </button>
                    <button 
                      onClick={() => setActiveTab('visuals')}
                      className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-tech font-bold uppercase tracking-widest border transition-all ${activeTab === 'visuals' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                    >
                      Style
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button 
                      onClick={startNewProject}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white/50 border border-white/5"
                      title="New Investigation"
                    >
                      <Plus size={12} />
                      New Session
                    </button>
                    <button 
                      disabled={!user || isSaving}
                      onClick={() => handleSave()}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all disabled:opacity-50"
                      title="Manual Save"
                    >
                      {isSaving ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      ) : (
                        <Save size={14} className="text-white/40" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {!isLinked && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'projects' ? (
              <div className="p-6 space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Stored Investigations</h3>
                {projects.length === 0 ? (
                  <div className="text-center py-10 opacity-20">
                    <FolderOpen size={40} className="mx-auto mb-4" />
                    <p className="text-[10px] font-mono">No projects found</p>
                  </div>
                ) : (
                  projects.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => loadProject(p)}
                      className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${currentProjectId === p.id ? 'bg-[#d4af37]/10 border-[#d4af37]/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                    >
                      <div className="text-sm font-bold truncate pr-8">{p.name}</div>
                      <div className="text-[10px] font-mono text-white/30 mt-1 uppercase">
                        {p.graph.nodes.length} nodes · {p.graph.links.length} links
                      </div>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => mergeProject(p, e)}
                          className="p-2 text-white/40 hover:text-[#d4af37] transition-colors"
                          title="Merge into current workspace"
                        >
                          <Plus size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteProject(p.id, e)}
                          className="p-2 text-white/40 hover:text-red-500 transition-colors"
                          title="Delete Intelligence Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === 'query' ? (
              <InterrogationPanel graph={graph} />
            ) : activeTab === 'quantum' ? (
              <QuantumSearchPanel isSearching={isSearching} onSearch={handleDeepSearch} />
            ) : activeTab === 'corroboration' ? (
              <CorroborationPanel graph={graph} />
            ) : activeTab === 'reporting' ? (
              <div className="p-6">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-6">Reporting & Artifacts</h3>
                <ReportingDeck 
                  graph={graph} 
                  projectName={projectName} 
                  onExpand={handleExpandGraph}
                  isExpanding={isSearching}
                  autoGrow={autoGrow}
                  onToggleAutoGrow={setAutoGrow}
                  handleDownloadBackup={handleDownloadBackup}
                  onVeniceSensemaking={handleVeniceSensemaking}
                  isVeniceLoading={isVeniceLoading}
                />
              </div>
            ) : activeTab === 'visuals' ? (
              <div className="p-6">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-6">Visual Configuration</h3>
                <VisualSettingsPanel settings={visualSettings} onChange={setVisualSettings} />
              </div>
            ) : (
              <IngestToGraphPanel setGraph={setGraph} />
            )}
          </div>
        )}

        <div className="border-t border-white/10 p-6 bg-black/40">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-white/30 tracking-widest">
            <FileText size={14} />
            Network Topology
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">Live Dashboard</span>
            <span className={`rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${liveStats.source === 'api' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20'}`}>
              {liveStats.source === 'api' ? 'API' : 'Local'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              ['Investigations', liveStats.investigations],
              ['Files', liveStats.files],
              ['Data Points', liveStats.dataPoints],
              ['Entities', liveStats.entities],
              ['Correlations', liveStats.correlations]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:border-white/10">
                <div className="text-2xl font-black text-white">{value}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">{label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            className="mt-6 flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RotateCcw size={14} />
            Purge Workspace
          </button>
        </div>
      </aside>

      <main className="relative flex-1 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.05)_0%,_transparent_70%)]">
        {graph.nodes.length > 0 ? (
          <NetworkMap
            data={graphForMap as any}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
            visualSettings={visualSettings}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="select-none text-center">
              <h1 className="font-display text-8xl font-black text-white/5 tracking-tighter">Investigation</h1>
              <p className="mt-6 font-mono text-xs uppercase tracking-[2em] text-white/20 animate-pulse">Awaiting Intel</p>
            </div>
          </div>
        )}
      </main>

      <aside className={`z-40 shrink-0 border-l border-white/10 bg-black/90 p-0 backdrop-blur-xl flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out absolute lg:relative right-0 h-full ${showRightSidebar || (selectedNode && !showLeftSidebar) ? 'w-[320px] lg:w-[380px] translate-x-0 p-6 pt-20' : 'w-0 translate-x-full overflow-hidden border-none'}`}>
        <div className="flex items-start justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Intelligence Profile</h2>
          <div className="flex items-center gap-2">
            {selectedNode && (
              <div className="h-1.5 w-1.5 rounded-full bg-[#d4af37] animate-pulse shadow-[0_0_10px_rgba(212,175,55,1)]" />
            )}
            <button 
              onClick={() => {
                setShowRightSidebar(false);
                setSelectedNode(null);
              }}
              className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {selectedNode ? (
          <div className="mt-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
            <div className="space-y-4">
              <div className="text-2xl font-black tracking-tight text-white/90 leading-none">
                {selectedNode.label || selectedNode.name || selectedNode.id}
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono uppercase text-white/50 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/50" />
                {selectedNode.type || selectedNode.group || 'Identified Entity'}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/5 p-5 font-mono text-[11px] text-white/40 space-y-2">
              <div className="flex justify-between">
                <span>UID</span>
                <span className="text-white/60 truncate ml-4">{selectedNode.id}</span>
              </div>
              <div className="flex justify-between">
                <span>RELIABILITY</span>
                <span className="text-[#d4af37]/70">VERIFIED</span>
              </div>
            </div>
            
            {selectedNode.description && (
              <div className="relative px-6 py-4">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500/0 via-green-500/50 to-green-500/0" />
                <div className="text-white/70 italic text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedNode.description}
                </div>
              </div>
            )}

            {selectedNode.source_refs && selectedNode.source_refs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/20">Evidence Threads</h3>
                <div className="space-y-2">
                  {selectedNode.source_refs.map((ref: string, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono text-white/40 break-all leading-tight">
                      {ref}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-white/5 space-y-4">
              {/* Visual Reconstruction / Evidence Generation */}
              <div className="space-y-3">
                {reconstructedImages[selectedNode.id] && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full aspect-square rounded-2xl overflow-hidden border border-[#d4af37]/30 shadow-[0_0_30px_rgba(212,175,55,0.1)] relative group"
                  >
                    <img 
                      src={reconstructedImages[selectedNode.id]} 
                      className="w-full h-full object-cover grayscale brightness-110 contrast-125"
                      alt="Reconstructed Face"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-3 left-3 text-[8px] font-mono uppercase tracking-widest text-[#d4af37]/80">
                      Forensic Visual Reconstruction // ADR-CORE-v2
                    </div>
                  </motion.div>
                )}

                <button
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 py-3 text-[10px] font-mono uppercase text-[#d4af37] hover:bg-[#d4af37]/20 transition-all disabled:opacity-50"
                  title="Generates a realistic forensic visual of this entity"
                  disabled={isReconstructing[selectedNode.id]}
                  onClick={() => handleReconstructVisual(selectedNode)}
                >
                  {isReconstructing[selectedNode.id] ? (
                    <Loader2 size={14} className="animate-spin text-[#d4af37]" />
                  ) : (
                    <RotateCcw size={14} className="animate-pulse" />
                  )}
                  {isReconstructing[selectedNode.id] ? 'Synthesizing...' : 'Visual Reconstruction (ADR v2)'}
                </button>
              </div>

              <button
                onClick={() => handleForensicSearch(selectedNode)}
                disabled={loadingForensic[selectedNode.id]}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 py-3 text-[10px] font-mono uppercase text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {loadingForensic[selectedNode.id] ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Gavel size={14} />
                )}
                Legal/Forensic Deep Dive
              </button>

              {forensicReports[selectedNode.id] && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-red-500">
                    <ShieldAlert size={12} />
                    Forensic Spotlight
                  </div>
                  <div className="text-[11px] text-white/60 leading-relaxed font-sans whitespace-pre-wrap">
                    {forensicReports[selectedNode.id]}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => handleNodeClick(selectedNode)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 py-3 text-[10px] font-mono uppercase text-[#d4af37] hover:bg-[#d4af37]/10 transition-all active:scale-95"
            >
              <Compass size={14} />
              Center Viewport on Node
            </button>
          </div>
        ) : (
          <div className="mt-20 text-center space-y-4 opacity-30 group cursor-default">
            <Compass size={40} className="mx-auto text-white/50 group-hover:rotate-45 transition-transform duration-700" />
            <p className="text-xs font-mono uppercase tracking-widest text-white/50 leading-relaxed max-w-[200px] mx-auto">
              Select a node within the lattice to extract granular intelligence
            </p>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-white/5">
             <div className="text-[9px] font-mono uppercase text-white/20 tracking-tighter">
                Session ID: {Math.random().toString(36).substring(7).toUpperCase()}
             </div>
        </div>
      </aside>

      <div className="pointer-events-none fixed inset-0 opacity-[0.03]">
        <div className="h-full w-full" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      {overlayOpen && (
        <SearchOverlay
          isSearching={isSearching}
          error={error}
          driveToken={driveToken}
          onDriveAuth={setDriveToken}
          onSearch={handleDeepSearch}
          onCsvUpload={handleCsvUpload}
          onZipUpload={handleZipUpload}
          onTextUpload={handleTextUpload}
          onClose={() => setOverlayOpen(false)}
        />
      )}

      {showNarrative && (
        <NarrativeSidebar 
          data={graph as any} 
          onClose={() => setShowNarrative(false)} 
        />
      )}

      {showImportDeck && (
        <ImportDeck 
          onImportComplete={(importedGraph) => {
            setGraph(prev => mergeGraphs(prev, importedGraph));
            setShowImportDeck(false);
          }}
          onClose={() => setShowImportDeck(false)}
        />
      )}

      {/* Global Status Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isSearching ? 'bg-yellow-500 animate-pulse' : 'bg-[#d4af37]'}`} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
            {isSearching ? 'Processing Intel...' : 'System Idle'}
          </span>
        </div>
        {graph.nodes.length > 0 && (
          <button 
            onClick={() => setShowNarrative(true)}
            className="flex items-center gap-2 pl-4 border-l border-white/10 hover:text-[#d4af37]/80 transition-colors"
          >
            <FileText size={12} />
            <span className="text-[10px] font-mono uppercase tracking-widest">Case Narrative</span>
          </button>
        )}
      </div>
    </div>
  )
}
