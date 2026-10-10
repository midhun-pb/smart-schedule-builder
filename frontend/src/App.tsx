import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';

// Modules
import { DashboardModule } from './components/modules/DashboardModule';
import { OrgSelectionModule } from './components/modules/OrgSelectionModule';
import { ProfilesModule } from './components/modules/ProfilesModule';
import { ScheduleModule } from './components/modules/ScheduleModule';
import { IntelligentSearchModule } from './components/modules/IntelligentSearchModule';
import { ReplacementsModule } from './components/modules/ReplacementsModule';
import { AvailabilityLeaveModule } from './components/modules/AvailabilityLeaveModule';
import { IntelligenceModule } from './components/modules/IntelligenceModule';
import { FairnessModule } from './components/modules/FairnessModule';
import { ScheduleIssuesModule } from './components/modules/ScheduleIssuesModule';
import { TeamBuilderModule } from './components/modules/TeamBuilderModule';
import { AnalyticsModule } from './components/modules/AnalyticsModule';
import { HistoryModule } from './components/modules/HistoryModule';
import { NotificationsModule } from './components/modules/NotificationsModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { HolidayManagementModule } from './components/modules/HolidayManagementModule';

export const AppContent: React.FC = () => {
  const { activeTab, activeOrg } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // First screen selection requirement: if no org exists or user clicks org-setup, show OrgSelectionModule
  const renderCurrentModule = () => {
    if (!activeOrg && activeTab !== 'org-setup') {
      return <OrgSelectionModule />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardModule />;
      case 'org-setup':
        return <OrgSelectionModule />;
      case 'profiles':
        return <ProfilesModule />;
      case 'schedule':
        return <ScheduleModule />;
      case 'search':
        return <IntelligentSearchModule />;
      case 'replacements':
        return <ReplacementsModule />;
      case 'leave':
        return <AvailabilityLeaveModule />;
      case 'intelligence':
        return <IntelligenceModule />;
      case 'fairness':
        return <FairnessModule />;
      case 'issues':
        return <ScheduleIssuesModule />;
      case 'team-builder':
        return <TeamBuilderModule />;
      case 'analytics':
        return <AnalyticsModule />;
      case 'holidays':
        return <HolidayManagementModule />;
      case 'history':
        return <HistoryModule />;
      case 'notifications':
        return <NotificationsModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      {/* Liquid Glass Header */}
      <Header onToggleMobileMenu={() => setMobileMenuOpen(true)} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar Navigation */}
        <Sidebar
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
          {renderCurrentModule()}
        </main>
      </div>

      {/* Floating Liquid Glass Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
