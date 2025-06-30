import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const ClockDisplay = React.memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div className="flex items-center space-x-2 mt-1"><Clock className="w-4 h-4" /><span>{currentTime}</span></div>;
});
ClockDisplay.displayName = 'ClockDisplay';

export default ClockDisplay;
