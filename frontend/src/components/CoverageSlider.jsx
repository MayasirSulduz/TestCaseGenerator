import React from 'react';
import '../styling/CoverageSlider.css';

const CoverageSlider = ({ value, onChange }) => {
  const getCoverageColor = (coverage) => {
    if (coverage >= 80) return '#4caf50';
    if (coverage >= 50) return '#ff9800';
    return '#f44336';
  };

  const getCoverageLabel = (coverage) => {
    if (coverage >= 80) return 'Excellent';
    if (coverage >= 60) return 'Good';
    if (coverage >= 40) return 'Fair';
    return 'Low';
  };

  return (
    <div className="coverage-slider">
      <h3 className="section-title">🎯 Target Code Coverage</h3>
      
      <div className="slider-display">
        <div 
          className="coverage-value"
          style={{ color: getCoverageColor(value) }}
        >
          {value}%
        </div>
        <div 
          className="coverage-label"
          style={{ color: getCoverageColor(value) }}
        >
          {getCoverageLabel(value)}
        </div>
      </div>

      <div className="slider-wrapper">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="slider"
          style={{
            background: `linear-gradient(to right, ${getCoverageColor(value)} 0%, ${getCoverageColor(value)} ${value}%, #e0e0e0 ${value}%, #e0e0e0 100%)`
          }}
        />
        <div className="slider-labels">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="coverage-recommendation">
        <p>💡 <strong>Recommendation:</strong> Aim for 80-90% coverage for production code</p>
      </div>
    </div>
  );
};

export default CoverageSlider;