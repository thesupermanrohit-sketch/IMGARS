import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { DropZone } from './components/DropZone';
import { QueueList } from './components/QueueList';
import { ImagePdfPanel } from './features/imagePdf/ImagePdfPanel';
import { useForgeStore } from './store/useForgeStore';

function App() {
  const location = useLocation();
  const { activeTab, setActiveTab } = useForgeStore();

  useEffect(() => {
    if (location.pathname === '/convert') {
      setActiveTab('convert');
    } else if (location.pathname === '/image-to-pdf') {
      setActiveTab('imagePdf');
    } else {
      setActiveTab('compress');
    }
  }, [location.pathname, setActiveTab]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ffffff] flex flex-col font-sans selection:bg-[#ffffff] selection:text-[#000000]">
      
      {/* Top Header Navigation */}
      <NavBar />

      {/* Main Container */}
      <main className="flex-1 max-w-[720px] w-full mx-auto px-6 py-12 flex flex-col gap-8">
        
        {/* Intro */}
        <div className="flex flex-col gap-1.5 mt-4">
          <h2 className="text-sm font-medium text-white tracking-wide">
            {activeTab === 'compress'
              ? 'Compress'
              : activeTab === 'convert'
                ? 'Convert'
                : 'Image to PDF'}
          </h2>
          <p className="text-xs text-[#666666] leading-relaxed">
            {activeTab === 'compress'
              ? 'Image too big to upload somewhere? Drop it here, set a size limit, done.'
              : activeTab === 'convert'
                ? 'Change your image from one format to another. Pick what you need, download.'
                : 'Turn your images into a PDF. Drag to reorder, then download.'}
          </p>
        </div>

        {activeTab === 'imagePdf' ? (
          <ImagePdfPanel />
        ) : (
          <>
            {/* Upload Zone */}
            <DropZone />

            {/* Queue Rows */}
            <QueueList />
          </>
        )}

      </main>
    </div>
  );
}

export default App;
