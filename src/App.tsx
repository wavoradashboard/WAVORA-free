import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getStoredData, saveStoredData, AppState } from './data';
import { User, Release, ArtistProfile, Label, RevenueReport, SupportQuery, OacApplication, TrackStatus, PayoutRequest, Plan } from './types';
// Importing Tab Components
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import DashboardHome from './components/DashboardHome';
import NewReleaseWizard from './components/NewReleaseWizard';
import ManageArtists from './components/ManageArtists';
import ManageLabels from './components/ManageLabels';
import CatalogueView from './components/CatalogueView';
import RevenuePage from './components/RevenuePage';
import SupportPage from './components/SupportPage';
import AdminPanel from './components/AdminPanel';
import MemberPool from './components/MemberPool';
import ProfileModal from './components/ProfileModal';
import RevenueReportsModal from './components/RevenueReportsModal';
import NotificationsDrawer from './components/NotificationsDrawer';


import { 
  Menu, 
  X, 
  Disc, 
  User as UserIcon, 
  ShieldAlert, 
  Compass, 
  AudioLines, 
  HelpCircle,
  Landmark,
  Tags,
  Users,
  Layers,
  Sparkles,
  Home,
  Bell
} from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => getStoredData());

  // Current session parameters
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [realAdminUser, setRealAdminUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState<boolean>(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState<boolean>(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);

  // Sync session on mount with local storage standard login
  useEffect(() => {
    const initLocalSession = () => {
      try {
        const savedUserStr = localStorage.getItem('wavora_current_user');
        if (savedUserStr) {
          const user = JSON.parse(savedUserStr);
          const roster = appState.users;
          const freshUser = roster.find(u => u.email.toLowerCase() === user.email.toLowerCase()) || user;
          
          setCurrentUser(freshUser);
          const adminStr = 'admin@g.g';
          const isAppAdmin = (email: string) => email === adminStr || email === 'wavoradashboard@gmail.com';
          
          if (isAppAdmin(freshUser.email)) {
            setCurrentTab('admin-panel');
          } else {
            setCurrentTab('home');
          }
        }
      } catch (e) {
        console.error('Session Initializer Error:', e);
      }
    };
    initLocalSession();
  }, []);

  // Auto-login logic for testing or keep sessions alive if needed (defaults to null for real authentication view)
  const users = appState.users;
  const releases = appState.releases;
  const artists = appState.artists;
  const labels = appState.labels;
  const revenueReports = appState.revenueReports;
  const queries = appState.queries;
  const oacApplications = appState.oacApplications;
  const notifications = appState.notifications || [];

  // Filter count of active, non-dismissed notifications for the bell badge
  const [headerDismissedIds, setHeaderDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const loadDismissed = () => {
      try {
        const saved = localStorage.getItem(`wavora_dismissed_notif_${currentUser.email}`);
        setHeaderDismissedIds(saved ? JSON.parse(saved) : []);
      } catch {
        setHeaderDismissedIds([]);
      }
    };

    // Load initially
    loadDismissed();

    // Listen to sync events when they are dismissed inside the drawer or other widgets
    window.addEventListener('wavora_notifications_synced', loadDismissed);
    return () => window.removeEventListener('wavora_notifications_synced', loadDismissed);
  }, [currentUser, isNotifDrawerOpen]);

  const filteredNotifs = notifications.filter(notif => {
    if (!currentUser) return false;
    if (notif.targetType === 'Everyone') return true;
    if (notif.targetType === 'Plan') return notif.targetValue?.toLowerCase() === currentUser.plan?.toLowerCase();
    if (notif.targetType === 'Artist') return notif.targetValue?.toLowerCase() === currentUser.email?.toLowerCase();
    return false;
  });

  const activeNotifCount = filteredNotifs.filter(n => !headerDismissedIds.includes(n.id)).length;

  // Synchronization helpers
  const updateState = (updater: (prev: AppState) => AppState) => {
    setAppState((prev) => {
      const next = updater(prev);
      saveStoredData(next);
      return next;
    });
  };

  // Auth Callbacks
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('wavora_current_user', JSON.stringify(user));
    setIsImpersonating(false);
    setRealAdminUser(null);
    const isAppAdmin = (email?: string) => email === 'admin@g.g' || email === 'wavoradashboard@gmail.com';

    if (isAppAdmin(user.email)) {
      setCurrentTab('admin-panel');
    } else {
      setCurrentTab('home');
    }
  };

  const handleRegister = (newUser: User) => {
    updateState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
    // Auto-login registered user and redirect
    setCurrentUser(newUser);
    localStorage.setItem('wavora_current_user', JSON.stringify(newUser));
    setCurrentTab('home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRealAdminUser(null);
    setIsImpersonating(false);
    setCurrentTab('home');
    localStorage.removeItem('wavora_current_user');
  };

  // Admin Actions
  const handleApproveUser = async (email: string) => {
    updateState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.email === email ? { ...u, isApproved: true } : u)),
    }));
  };

  const handleRejectUser = async (email: string) => {
    updateState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.email !== email),
    }));
  };

  const handleCreateUser = async (newUser: User): Promise<{ success: boolean; message: string }> => {
    const exists = appState.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase());
    if (exists) {
      return { success: false, message: 'This email is already in use.' };
    }

    const finalUserId = newUser.id || crypto.randomUUID();
    const userWithId: User = {
      ...newUser,
      id: finalUserId,
      isApproved: true,
      registeredAt: newUser.registeredAt || new Date().toISOString()
    };

    updateState((prev) => ({
      ...prev,
      users: [...prev.users, userWithId],
    }));

    return { success: true, message: 'User account created and pre-approved!' };
  };

  const handleUpdateReleaseStatus = async (releaseId: string, status: TrackStatus, feedback?: string) => {
    updateState((prev) => ({
      ...prev,
      releases: prev.releases.map((r) => 
        r.id === releaseId 
          ? { ...r, status, feedback: feedback || r.feedback } 
          : r
      ),
    }));
  };

  const handleUpdateRelease = async (releaseId: string, updates: Partial<Release>) => {
    updateState((prev) => ({
      ...prev,
      releases: prev.releases.map((r) => 
        r.id === releaseId 
          ? { ...r, ...updates } 
          : r
      ),
    }));
  };

  const handleReplySupportQuery = async (queryId: string, replyText: string) => {
    updateState((prev) => ({
      ...prev,
      queries: prev.queries.map((q) => 
        q.id === queryId 
          ? { ...q, status: 'Resolved' as const, replyText } 
          : q
      ),
    }));
  };

  const handleUpdateOacStatus = async (oacId: string, status: 'Approved' | 'Rejected') => {
    updateState((prev) => ({
      ...prev,
      oacApplications: prev.oacApplications.map((app) => 
        app.id === oacId 
          ? { ...app, status } 
          : app
      ),
    }));
  };

  const handlePostRevenue = async (email: string, month: string, amount: number, releaseName: string, currency: 'USD' | 'INR' = 'USD') => {
    updateState((prev) => {
      // Find existing report for this user, month, and currency
      const existingIdx = prev.revenueReports.findIndex(
        r => r.email === email && r.month === month && (r.currency || 'USD') === currency
      );
      
      const newBreakdownItem = { releaseName, amount };
      
      let updatedReports = [...prev.revenueReports];
      
      if (existingIdx > -1) {
        // Append breakdown and add amount
        const currentRep = updatedReports[existingIdx];
        updatedReports[existingIdx] = {
          ...currentRep,
          amount: currentRep.amount + amount,
          breakdown: [...currentRep.breakdown, newBreakdownItem],
        };
      } else {
        // Insert brand new report block
        const newReport: RevenueReport = {
          id: crypto.randomUUID(),
          email,
          month,
          amount,
          currency,
          breakdown: [newBreakdownItem],
        };
        updatedReports = [newReport, ...updatedReports];
      }

      return {
        ...prev,
        revenueReports: updatedReports,
      };
    });
  };

  // Impersonating mechanics
  const isAppAdmin = (email?: string) => email === 'admin@g.g' || email === 'wavoradashboard@gmail.com';

  const handleImpersonateUser = (targetUser: User) => {
    if (isAppAdmin(currentUser?.email)) {
      setRealAdminUser(currentUser);
    }
    setCurrentUser(targetUser);
    setIsImpersonating(true);
    setCurrentTab('home');
  };

  const handleExitImpersonation = () => {
    if (realAdminUser) {
      setCurrentUser(realAdminUser);
      setRealAdminUser(null);
    } else {
      // Fallback
      const admin = users.find(u => isAppAdmin(u.email));
      if (admin) setCurrentUser(admin);
    }
    setIsImpersonating(false);
    setCurrentTab('admin-panel');
  };

  const handleSavePassword = (currentPass: string, newPass: string) => {
    if (!currentUser) return { success: false, message: 'No active user session.' };
    
    // Find absolute exact current state of the user password to make sure current password matches
    const actualUser = appState.users.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
    
    if (!actualUser) {
      return { success: false, message: 'User not found in roster statistics.' };
    }

    if (actualUser.password !== currentPass) {
      return { success: false, message: 'Incorrect current password.' };
    }

    // Save and persist password
    updateState((prev) => ({
      ...prev,
      users: prev.users.map((u) => 
        u.email.toLowerCase() === currentUser.email.toLowerCase() 
          ? { ...u, password: newPass } 
          : u
      ),
    }));

    // Update local state copy
    setCurrentUser((prevUser) => prevUser ? { ...prevUser, password: newPass } : null);

    return { success: true, message: 'Password updated successfully!' };
  };

  // Artist Actions
  const handleAddArtist = async (profile: ArtistProfile) => {
    updateState((prev) => ({
      ...prev,
      artists: [...prev.artists, profile],
    }));
  };

  const handleRemoveArtist = async (id: string) => {
    updateState((prev) => ({
      ...prev,
      artists: prev.artists.filter((art) => art.id !== id),
    }));
  };

  const handleUpdateArtist = async (id: string, updates: Partial<ArtistProfile>) => {
    updateState((prev) => ({
      ...prev,
      artists: prev.artists.map((art) => art.id === id ? { ...art, ...updates } : art),
    }));
  };

  const handleUpdateUser = async (email: string, updates: Partial<User>) => {
    updateState((prev) => {
      return {
        ...prev,
        users: prev.users.map((u) => u.email.toLowerCase() === email.toLowerCase() ? { 
          ...u, 
          ...updates,
        } : u),
      };
    });

    if (currentUser?.email.toLowerCase() === email.toLowerCase()) {
      setCurrentUser(prev => prev ? {
        ...prev,
        ...updates,
      } : null);
    }
  };

  const handleAddPayoutRequest = async (
    amount: number,
    currency: 'USD' | 'INR',
    method: 'UPI' | 'Bank',
    details: { upiId?: string; bankName?: string; bankAccountNo?: string; bankIfsc?: string; bankHolderName?: string }
  ) => {
    if (!currentUser) return;
    const newRequest: PayoutRequest = {
      id: crypto.randomUUID(),
      email: currentUser.email,
      artistName: currentUser.artistName,
      amount,
      currency,
      paymentMethod: method,
      paymentDetails: details,
      submittedAt: new Date().toISOString(),
      status: 'Pending' as const
    };

    updateState((prev) => ({
      ...prev,
      payoutRequests: [newRequest, ...(prev.payoutRequests || [])]
    }));
  };

  const handleUpdatePayoutRequest = async (id: string, status: 'Approved' | 'Rejected', feedback?: string) => {
    updateState((prev) => ({
      ...prev,
      payoutRequests: (prev.payoutRequests || []).map(r => r.id === id ? { ...r, status, feedback } : r)
    }));
  };

  const handleAddLabel = async (label: Label) => {
    updateState((prev) => ({
      ...prev,
      labels: [...prev.labels, label],
    }));
  };

  const handleRemoveLabel = async (id: string) => {
    updateState((prev) => ({
      ...prev,
      labels: prev.labels.filter((lbl) => lbl.id !== id),
    }));
  };

  const handleDeleteRelease = async (id: string) => {
    updateState((prev) => ({
      ...prev,
      releases: prev.releases.filter((r) => r.id !== id),
    }));
  };

  const handleEditRelease = (release: Release) => {
    setEditingRelease(release);
    setCurrentTab('new-release');
  };

  useEffect(() => {
    if (currentTab !== 'new-release') {
      setEditingRelease(null);
    }
  }, [currentTab]);

  const handleSubmitRelease = async (newRelease: Release) => {
    updateState((prev) => {
      const existingIdx = prev.releases.findIndex(r => r.id === newRelease.id);
      const newArray = [...prev.releases];
      if (existingIdx !== -1) {
        newArray[existingIdx] = { ...newRelease };
      } else {
        newArray.unshift({ ...newRelease });
      }
      return {
        ...prev,
        releases: newArray,
      };
    });
  };

  const handleSubmitSupportQuery = async (queryText: string) => {
    if (!currentUser) return;

    const newQuery: SupportQuery = {
      id: crypto.randomUUID(),
      email: currentUser.email,
      artistName: currentUser.artistName,
      queryText,
      submittedAt: new Date().toISOString(),
      status: 'Pending',
    };

    updateState((prev) => ({
      ...prev,
      queries: [newQuery, ...prev.queries],
    }));
  };

  const handleSubmitOacApplication = async (youtubeLink: string, spotifyLink: string, fullName: string) => {
    if (!currentUser) return;

    const newOac: OacApplication = {
      id: crypto.randomUUID(),
      email: currentUser.email,
      artistName: currentUser.artistName,
      spotifyLink,
      youtubeLink,
      fullName,
      submittedAt: new Date().toISOString(),
      status: 'Pending',
    };

    updateState((prev) => ({
      ...prev,
      oacApplications: [newOac, ...prev.oacApplications],
    }));
  };

  const handlePushNotification = async (newNotif: any) => {
    updateState((prev) => ({
      ...prev,
      notifications: [newNotif, ...(prev.notifications || [])],
    }));
  };

  const handleDeleteNotification = async (notifId: string) => {
    updateState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => n.id !== notifId),
    }));
  };

  const handleDownloadFile = async (path: string) => {
    if (path.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = path;
      link.download = 'release_asset';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(path, '_blank');
    }
  };

  // Render view router based on currentTab
  const renderCurrentView = () => {
    if (!currentUser) return null;

    let viewComponent: React.ReactNode;

    switch (currentTab) {
      case 'home':
        viewComponent = (
          <DashboardHome
            currentUser={currentUser}
            releases={releases}
            revenueReports={revenueReports}
            setCurrentTab={setCurrentTab}
            onOpenRevenueModal={() => setIsRevenueModalOpen(true)}
            notifications={notifications}
          />
        );
        break;
      case 'new-release':
        viewComponent = (
          <NewReleaseWizard
            currentUser={currentUser}
            managedArtists={artists}
            managedLabels={labels}
            onSubmitRelease={handleSubmitRelease}
            setCurrentTab={setCurrentTab}
            editingRelease={editingRelease}
            onCancelEdit={() => {
              setEditingRelease(null);
              setCurrentTab('catalogue');
            }}
          />
        );
        break;
      case 'manage-artists':
        viewComponent = (
          <ManageArtists
            currentUser={currentUser}
            users={users}
            managedArtists={artists}
            onAddArtist={handleAddArtist}
            onRemoveArtist={handleRemoveArtist}
            isImpersonating={isImpersonating}
          />
        );
        break;
      case 'member-pool':
        viewComponent = (
          <MemberPool
            currentUser={currentUser}
            users={users}
            onImpersonateUser={handleImpersonateUser}
            onUpdateUser={handleUpdateUser}
          />
        );
        break;
      case 'manage-labels':
        viewComponent = (
          <ManageLabels
            currentUser={currentUser}
            users={users}
            managedLabels={labels}
            onAddLabel={handleAddLabel}
            onRemoveLabel={handleRemoveLabel}
            isImpersonating={isImpersonating}
          />
        );
        break;
      case 'catalogue':
        viewComponent = (
          <CatalogueView
            currentUser={currentUser}
            releases={releases}
            onDeleteRelease={handleDeleteRelease}
            onEditRelease={handleEditRelease}
          />
        );
        break;
      case 'revenue':
        viewComponent = (
          <RevenuePage
            currentUser={currentUser}
            revenueReports={revenueReports}
            onOpenRevenueModal={() => setIsRevenueModalOpen(true)}
            payoutRequests={appState.payoutRequests || []}
            onAddPayoutRequest={handleAddPayoutRequest}
            onUpdateUser={handleUpdateUser}
          />
        );
        break;
      case 'support':
        viewComponent = (
          <SupportPage
            currentUser={currentUser}
            supportQueries={queries}
            onSubmitSupportQuery={handleSubmitSupportQuery}
            oacApplications={oacApplications}
            onSubmitOacApplication={handleSubmitOacApplication}
          />
        );
        break;
      case 'admin-panel':
        viewComponent = (
          <AdminPanel
            currentUser={currentUser}
            users={users}
            releases={releases}
            artists={artists}
            supportQueries={queries}
            oacApplications={oacApplications}
            onApproveUser={handleApproveUser}
            onRejectUser={handleRejectUser}
            onCreateUser={handleCreateUser}
            onUpdateReleaseStatus={handleUpdateReleaseStatus}
            onUpdateRelease={handleUpdateRelease}
            onReplySupportQuery={handleReplySupportQuery}
            onUpdateOacStatus={handleUpdateOacStatus}
            onPostRevenue={handlePostRevenue}
            onImpersonateUser={handleImpersonateUser}
            notifications={notifications}
            onPushNotification={handlePushNotification}
            onDeleteNotification={handleDeleteNotification}
            onDownloadFile={handleDownloadFile}
            onUpdateArtist={handleUpdateArtist}
            onUpdateUser={handleUpdateUser}
            payoutRequests={appState.payoutRequests || []}
            onUpdatePayoutRequest={handleUpdatePayoutRequest}
          />
        );
        break;
      default:
        viewComponent = (
          <div className="p-8 text-center text-gray-400">
            <h3 className="font-bold text-lg">Work in Progress</h3>
            <p className="text-xs mt-1">This module is under construction.</p>
          </div>
        );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full flex flex-col"
        >
          {viewComponent}
        </motion.div>
      </AnimatePresence>
    );
  };

  // Unauthenticated screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
        allUsers={users}
      />
    );
  }

  // Get active tab icon
  const getTabIcon = () => {
    switch (currentTab) {
      case 'home': return <Home className="w-4 h-4 text-[#6366F1]" />;
      case 'new-release': return <Disc className="w-4 h-4 text-[#6366F1]" />;
      case 'manage-artists': return <Users className="w-4 h-4 text-[#6366F1]" />;
      case 'member-pool': return <Users className="w-4 h-4 text-[#6366F1]" />;
      case 'manage-labels': return <Tags className="w-4 h-4 text-[#6366F1]" />;
      case 'catalogue': return <Layers className="w-4 h-4 text-[#6366F1]" />;
      case 'revenue': return <Landmark className="w-4 h-4 text-[#6366F1]" />;
      case 'support': return <HelpCircle className="w-4 h-4 text-[#6366F1]" />;
      default: return <Sparkles className="w-4 h-4 text-[#6366F1]" />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] w-full bg-transparent text-white font-sans overflow-hidden" id="app_root_layout">
      
      {/* Sidebar Component */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        isImpersonating={isImpersonating}
        onExitImpersonation={handleExitImpersonation}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
      />

      {/* Main viewport block */}
      <main className="flex-1 flex flex-col min-w-0 lg:p-4 overflow-hidden" id="app_main_wrapper">
        <div className="bg-[#0a0f1d] lg:border border-white/10 lg:rounded-[2rem] w-full h-full flex flex-col overflow-y-auto shadow-2xl shadow-indigo-500/10 relative">
        
        {/* Editorial Top Bar / Header - Conditionally hidden for New Release Wizard to prevent double headers */}
        {currentTab !== 'new-release' && (
          <header className="h-16 md:h-20 shrink-0 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-[#070710] sticky top-0 z-30" id="editorial_top_bar">
          <div className="flex items-center gap-2 md:gap-3 animate-fade-in">
            {/* Mobile Nav Toggle */}
            <button
              type="button"
              onClick={() => setIsOpenMobile(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-xl hover:bg-white/5 text-gray-400 hover:text-[#6366F1] transition cursor-pointer"
              id="btn_hamburger_mobile"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden lg:flex p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-[#6366F1] transition cursor-pointer mr-2.5"
                id="btn_expand_sidebar"
                title="Expand Sidebar"
              >
                <Menu className="w-5 h-5 text-gray-400 hover:text-[#6366F1]" />
              </button>
            )}
            <div className="hidden md:block p-2 bg-white/5 border border-white/10 rounded-xl">
              {getTabIcon()}
            </div>
            <div className="text-left">
              <h1 className="text-sm md:text-2xl font-black tracking-tighter text-white flex items-center gap-1.5 md:gap-3">
                <span className="capitalize truncate max-w-[120px] md:max-w-none">{currentTab.replace('-', ' ')}</span>
                <span className="text-[#6366F1] text-[8px] md:text-xs">●</span>
                <span className="text-gray-500 font-medium text-[10px] md:text-sm tracking-widest uppercase hidden md:inline">
                  {currentTab === 'admin-panel' ? 'Administration Suite' : 'Workspace'}
                </span>
              </h1>
              <p className="text-[8px] md:text-[11px] text-gray-400 font-medium uppercase tracking-widest hidden sm:block mt-0.5">
                {(currentUser.email === 'admin@g.g' || currentUser.email === 'wavoradashboard@gmail.com') ? 'System Administrator Portal' : 'Standard Artist Account'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-gray-350">{currentUser.artistName}</p>
              <p className="text-[10px] text-indigo-650 flex items-center gap-1 justify-end font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                Verified Artist Account
              </p>
            </div>

            {/* Premium Notification Bell Trigger with Badge */}
            <button
              type="button"
              onClick={() => setIsNotifDrawerOpen(true)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/50 flex items-center justify-center relative transition-all cursor-pointer shadow-inner active:scale-95 group"
              id="btn_header_notification_bell"
              title="Open System Bulletins"
            >
              <Bell className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] text-gray-400 group-hover:text-[#6366F1] transition-all group-hover:rotate-12" />
              {activeNotifCount > 0 && (
                <span 
                  className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-red-500 text-[7px] md:text-[9px] font-black text-white leading-none ring-[2px] ring-[#070710] animate-pulse"
                  id="notif_header_badge_count"
                >
                  {activeNotifCount}
                </span>
              )}
            </button>

            {/* User Badge avatar - Clickable */}
            <button 
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/50 flex items-center justify-center font-bold text-[10px] md:text-xs text-[#6366F1] transition-all cursor-pointer shadow-inner active:scale-95 group relative"
              id="btn_header_profile_avatar"
              title="View Profile Suite"
            >
              <span className="group-hover:scale-105 transition-transform">
                {currentUser.artistName.charAt(0).toUpperCase()}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 md:w-2.5 h-2 md:h-2.5 bg-[#6366F1] border border-[#070710] rounded-full" />
            </button>
          </div>
        </header>
        )}

        {/* Dashboard Content Container */}
        <div className="p-4 md:p-8 flex-1 max-w-7xl w-full mx-auto" id="app_view_viewport">
          {renderCurrentView()}
        </div>

        {/* Friendly Footer */}
        <footer className="py-4 px-6 lg:px-8 bg-transparent border-t border-white/10 flex flex-col lg:flex-row items-center justify-between text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold gap-3 mt-auto shrink-0" id="editorial_footer">
          <div className="flex gap-4 lg:gap-6">
            <span>© 2026 Wavora Live</span>
            <span>Status: <span className="text-emerald-600 underline">Active & Guarded</span></span>
          </div>
          <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
            <button type="button" onClick={() => setCurrentTab('support')} className="hover:text-white cursor-pointer transition">Official Artist Channel Request</button>
            <span className="opacity-40">|</span>
            <span className="hover:text-white cursor-pointer">Legal & Copyright</span>
            <span className="opacity-40">|</span>
            <button type="button" onClick={() => setCurrentTab('support')} className="hover:text-white cursor-pointer transition">Contact Support Desk</button>
          </div>
        </footer>

        </div>
      </main>

      {currentUser && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          onSavePassword={handleSavePassword}
        />
      )}

      {currentUser && (
        <RevenueReportsModal
          isOpen={isRevenueModalOpen}
          onClose={() => setIsRevenueModalOpen(false)}
          currentUser={currentUser}
          revenueReports={revenueReports}
        />
      )}

      {currentUser && (
        <NotificationsDrawer
          isOpen={isNotifDrawerOpen}
          onClose={() => setIsNotifDrawerOpen(false)}
          currentUser={currentUser}
          notifications={notifications}
        />
      )}
    </div>
  );
}
