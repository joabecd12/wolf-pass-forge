import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { ParticipantForm } from "@/components/participants/ParticipantForm";
import { ParticipantsList } from "@/components/participants/ParticipantsList";
import { CSVImport } from "@/components/participants/CSVImport";
import { QRScanner } from "@/components/scanner/QRScanner";
import { ReportsPanel } from "@/components/reports/ReportsPanel";

const Index = () => {
  const [activeTab, setActiveTab] = useState("participants");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleParticipantAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "participants":
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
            <div className="xl:col-span-1 space-y-4 md:space-y-6">
              <ParticipantForm onParticipantAdded={handleParticipantAdded} />
              <CSVImport onImportComplete={handleParticipantAdded} />
            </div>
            <div className="xl:col-span-2">
              <ParticipantsList refreshTrigger={refreshTrigger} />
            </div>
          </div>
        );
      case "scanner":
        return <QRScanner />;
      case "reports":
        return <ReportsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-2 md:p-4">
      <div className="max-w-7xl mx-auto">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="px-2 md:px-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Index;
