import React, { useEffect } from 'react';

const ElfsightTikTok: React.FC = () => {
  useEffect(() => {
    const scriptId = 'elfsight-platform-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://elfsightcdn.com/platform.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div 
      className="elfsight-app-2daa2e07-31de-443d-95ca-2af665b4aa1d" 
      data-elfsight-app-lazy 
    />
  );
};

export default ElfsightTikTok;
