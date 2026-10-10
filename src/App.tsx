import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { DropZone } from './components/DropZone';
import { QueueList } from './components/QueueList';
import { ImagePdfPanel } from './features/imagePdf/ImagePdfPanel';
import { useForgeStore } from './store/useForgeStore';
import { db, getDbSessionId, registerDbSession, unregisterDbSession } from './db/db';

interface TabPageProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function TabPage({ title, description, children }: TabPageProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5 mt-4">
        <h2 className="text-sm font-medium text-white tracking-wide">{title}</h2>
        <p className="text-xs text-[#666666] leading-relaxed">{description}</p>
      </div>
      {children}
    </>
  );
}

function StandardQueuePage({ title, description }: { title: string; description: string }) {
  return (
    <TabPage title={title} description={description}>
      <DropZone />
      <QueueList />
    </TabPage>
  );
}

export function App() {
  const location = useLocation();
  const setActiveTab = useForgeStore((state) => state.setActiveTab);

  // Sync activeTab for navigation indicators and state slices
  useEffect(() => {
    if (location.pathname === '/convert') {
      setActiveTab('convert');
    } else if (location.pathname === '/image-to-pdf') {
      setActiveTab('imagePdf');
    } else if (location.pathname === '/increase-size') {
      setActiveTab('increaseSize');
    } else {
      setActiveTab('compress');
    }
  }, [location.pathname, setActiveTab]);

  // Remove interrupted uploads from prior runs while retaining records for
  // items currently represented in the live queue.
  useEffect(() => {
    registerDbSession();
    void db.cleanupStaleImages(
      useForgeStore.getState().queue.map((item) => item.id),
      getDbSessionId()
    );
    const heartbeat = window.setInterval(registerDbSession, 5 * 60 * 1000);

    return () => {
      window.clearInterval(heartbeat);
      unregisterDbSession();
    };
  }, []);

  // Object URL lifecycle cleanup on tab close / reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { queue, imagePdfItems } = useForgeStore.getState();
      queue.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      imagePdfItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ffffff] flex flex-col font-sans selection:bg-[#ffffff] selection:text-[#000000]">
      {/* Top Header Navigation */}
      <NavBar />

      {/* Main Container */}
      <main className="flex-1 max-w-[720px] w-full mx-auto px-6 py-12 flex flex-col gap-8">
        <Routes>
          <Route path="/" element={<Navigate to="/compress" replace />} />
          <Route
            path="/convert"
            element={
              <StandardQueuePage
                title="Convert"
                description="Change your image from one format to another. Pick what you need, download."
              />
            }
          />
          <Route
            path="/compress"
            element={
              <StandardQueuePage
                title="Compress"
                description="Image too big to upload somewhere? Drop it here, set a size limit, done."
              />
            }
          />
          <Route
            path="/increase-size"
            element={
              <StandardQueuePage
                title="Increase Size"
                description="Need a larger file size for upload requirements? Set your target size and increase it instantly."
              />
            }
          />
          <Route
            path="/image-to-pdf"
            element={
              <TabPage
                title="Image to PDF"
                description="Turn your images into a PDF. Drag to reorder, then download."
              >
                <ImagePdfPanel />
              </TabPage>
            }
          />
          <Route path="*" element={<Navigate to="/compress" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
