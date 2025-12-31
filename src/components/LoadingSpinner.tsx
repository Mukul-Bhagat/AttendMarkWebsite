import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">Loading...</p>
    </div>
  );
};

export default LoadingSpinner;

