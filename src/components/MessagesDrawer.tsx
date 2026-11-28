import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { FigmaIcon, ICON_STROKE_WIDTH } from './FigmaIcon';
import {
  MessengerWorkspace,
  type MessengerStartRequest,
} from './MessengerWorkspace';
import { RightSlideModal } from './RightSlideModal';
import { useStore } from '../context/StoreContext';

interface MessagesDrawerProps {
  open: boolean;
  onClose: () => void;
  initialChatId?: number | null;
  startRequest?: MessengerStartRequest | null;
}

export function MessagesDrawer({
  open,
  onClose,
  initialChatId = null,
  startRequest = null,
}: MessagesDrawerProps) {
  const { isSignedIn } = useStore();
  const [isMaximized, setIsMaximized] = useState(false);

  // Reset maximized state cleanly after the drawer finishes closing
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setIsMaximized(false);
    }, 340);
    return () => window.clearTimeout(t);
  }, [open]);

  const toggleMaximize = () => setIsMaximized((prev) => !prev);

  return (
    <RightSlideModal
      open={open}
      onClose={onClose}
      hideHeader
      widthClass={
        isMaximized
          ? 'w-screen max-w-[100vw]'
          : 'w-[calc(100vw-16px)] max-w-[440px]'
      }
      panelRadiusClass={
        isMaximized
          ? 'rounded-none border-l-0'
          : 'rounded-l-[24px] border-l border-[#ececec]'
      }
      disableSwipe={isMaximized}
      bodyClassName="p-0 flex flex-col overflow-hidden bg-white"
      ariaLabel="Messages"
    >
      {!isSignedIn ? (
        <div className="flex-1 flex flex-col bg-white">
          <div className="bg-white px-4 py-3.5 border-b border-[#ececec] flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-[20px] font-bold text-black tracking-tight">
              Chats
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMaximize}
                title={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                aria-label={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                className="w-8 h-8 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
              >
                {isMaximized ? (
                  <Minimize2
                    className="w-4 h-4"
                    strokeWidth={ICON_STROKE_WIDTH}
                  />
                ) : (
                  <Maximize2
                    className="w-4 h-4"
                    strokeWidth={ICON_STROKE_WIDTH}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close messages"
                className="w-8 h-8 rounded-full bg-[#f4f4f4] hover:bg-[#ffefe6] hover:text-[#ff6e20] text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
              >
                <FigmaIcon name="x" className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full bg-white px-6 py-10 flex flex-col items-center justify-center text-center gap-3">
            <span className="w-14 h-14 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
              <FigmaIcon name="message-circle" className="w-7 h-7" />
            </span>
            <h3 className="text-[19px] font-bold text-black">
              Sign in to view your messages
            </h3>
            <p className="text-[13.5px] text-[#767676] max-w-[300px]">
              Chat directly with stores and Kova Support.
            </p>
            <Link
              to="/login"
              onClick={onClose}
              className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : (
        <MessengerWorkspace
          mode="customer"
          fullScreen
          drawerMode
          isMaximized={isMaximized}
          onToggleMaximize={toggleMaximize}
          onCloseDrawer={onClose}
          initialChatId={initialChatId}
          startRequest={startRequest}
        />
      )}
    </RightSlideModal>
  );
}
