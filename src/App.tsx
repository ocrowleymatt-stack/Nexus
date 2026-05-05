import { useState, useCallback, useEffect, useRef } from 'react'
import { RotateCcw, Network, FileText, Database, Search as SearchIcon, Compass, LogIn, LogOut, Save, FolderOpen, Plus, Trash2, Gavel, Loader2, ShieldAlert, Shield, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose, PanelLeft, PanelRight, X } from 'lucide-react'
import IngestToGraphPanel from './components/IngestToGraphPanel'
import { NetworkMap } from './components/NetworkMap'
import { SearchOverlay } from './components/SearchOverlay'
import { deepSearchEntity, extractIntelligenceFromCsv, huntZipIntelligence, expandGraph, forensicSearchNode, veniceSensemaking, extractIntelligenceFromText } from './services/geminiService'
import { mergeGraphs } from './lib/intelligenceGraph'
import { auth, loginWithGoogle } from './lib/firebase'
import { onAuthStateChanged, User, signOut } from 'firebase/auth'
import { saveProject, getProjects, deleteProject } from './lib/firestoreService'

import { NarrativeSidebar } from './components/NarrativeSidebar'
import ReportingDeck from './components/ReportingDeck'
import VisualSettingsPanel from './components/VisualSettingsPanel'
import ImportDeck from './components/ImportDeck'
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
  const [activeTab, setActiveTab] = useState<'ingest' | 'projects' | 'reporting' | 'visuals'>('ingest')
  const [autoGrow, setAutoGrow] = useState(false)
  const [forensicReports, setForensicReports] = useState<Record<string, string>>({})
  const [loadingForensic, setLoadingForensic] = useState<Record<string, boolean>>({})

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  const graphForMap = {
    centralNode: centralNode || 'Nexus Intelligence Core',
    narrative: graph.narrative || 'Awaiting investigative ingestion.',
    nodes: graph.nodes,
    links: graph.links
  }

  const [showLeftSidebar, setShowLeftSidebar] = useState(true)
  const [showRightSidebar, setShowRightSidebar] = useState(false) // Right sidebar hidden by default on mobile

  return (
    <div className="relative flex h-screen w-screen bg-[#050505] text-white selection:bg-[#d4af37] selection:text-black overflow-hidden font-sans">
      {/* Toggle Controls */}
      <div className="fixed top-24 left-6 z-[60] flex flex-col gap-2">
        <button 
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className={`pointer-events-auto p-3 rounded-2xl bg-[#111] border border-white/10 text-white/50 hover:text-[#d4af37] hover:border-[#d4af37]/50 transition-all shadow-2xl flex items-center gap-2 group ${showLeftSidebar ? 'opacity-0 -translate-x-10 pointer-events-none' : 'opacity-100 translate-x-0'}`}
          title="Toggle Tools"
        >
          <PanelLeft size={20} />
          <span className="text-[10px] font-mono uppercase font-bold pr-2">Investigation Toolbox</span>
        </button>
      </div>

      <div className="fixed top-24 right-6 z-[60] flex flex-col gap-2 items-end">
        <button 
          onClick={() => {
            setShowRightSidebar(!showRightSidebar);
            if (!showRightSidebar && !selectedNode && graph.nodes.length > 0) {
              setSelectedNode(graph.nodes[0]);
            }
          }}
          className={`pointer-events-auto p-3 rounded-2xl bg-[#111] border border-white/10 text-white/50 hover:text-[#d4af37] hover:border-[#d4af37]/50 transition-all shadow-2xl flex items-center gap-2 group ${showRightSidebar ? 'opacity-0 translate-x-10 pointer-events-none' : 'opacity-100 translate-x-0'}`}
          title="Toggle Intel"
        >
          <span className="text-[10px] font-mono uppercase font-bold pl-2">Intel Spotlight</span>
          <PanelRight size={20} />
        </button>
      </div>

      {/* Left Sidebar */}
      <aside className={`z-40 shrink-0 border-r border-white/10 bg-[#0c0c0c]/95 backdrop-blur-3xl flex flex-col shadow-2xl transition-all duration-500 ease-in-out fixed lg:relative h-full ${showLeftSidebar ? 'w-full lg:w-[400px] translate-x-0' : 'w-0 -translate-x-full overflow-hidden'}`}>
        <div className="border-b border-white/5 p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 font-serif italic text-lg tracking-tighter">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#d4af37] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)] overflow-hidden border border-white/20">
                  {/* Persona Face - Amateur Photography Style */}
                  <img 
                    src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200" 
                    alt="Agent" 
                    className="w-full h-full object-cover grayscale opacity-80 mix-blend-multiply border-none"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-[#d4af37]/20 mix-blend-color" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0c0c0c] animate-pulse" title="System Ready" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-mono tracking-[0.4em] text-white/30 uppercase -mb-1">O'CROWLEY</span>
                Nexus Agent
              </div>
              <span className="text-[9px] font-mono font-normal not-italic text-white/20 bg-white/5 px-2 py-0.5 rounded border border-white/10 ml-2">CORE // 1.2.0-ADR</span>
            </div>
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
              className="w-full bg-transparent border-none text-2xl font-serif italic font-black tracking-tight text-[#d4af37] focus:outline-none focus:ring-0 placeholder:text-white/10"
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
                   className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'ingest' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                >
                   Index
                </button>
                <button 
                  onClick={() => setActiveTab('projects')}
                  className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'projects' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                >
                  Vault
                </button>
                <button 
                  onClick={() => setActiveTab('reporting')}
                  className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'reporting' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
                >
                  Brief
                </button>
                <button 
                  onClick={() => setActiveTab('visuals')}
                  className={`flex items-center justify-center rounded-xl py-3 text-[8px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'visuals' ? 'bg-[#d4af37]/10 border-[#d4af37]/40 text-[#d4af37]' : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5'}`}
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
        </div>

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
                    <button 
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
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

        <div className="border-t border-white/10 p-6 bg-black/40">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-white/30 tracking-widest">
            <FileText size={14} />
            Network Topology
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:border-white/10">
              <div className="text-3xl font-black text-white">{graph.nodes.length}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">Entities</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:border-white/10">
              <div className="text-3xl font-black text-white">{graph.links.length}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">Correlations</div>
            </div>
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
              <h1 className="font-serif text-8xl italic text-white/10 tracking-tighter">Investigation</h1>
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
              <button
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 py-3 text-[10px] font-mono uppercase text-[#d4af37] hover:bg-[#d4af37]/20 transition-all"
                title="Generates a realistic forensic visual of this entity"
                onClick={() => {
                  alert("Intelligence protocol initiated. In a production environment, this would generate a high-veracity amateur-style photograph with natural flaws as requested. (Currently bypassed due to API budget constraints)");
                }}
              >
                <RotateCcw size={14} className="animate-pulse" />
                Visual Reconstruction (ADR v2)
              </button>

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
