import React from 'react';
import '../styling/FrameworkSelector.css';

const FrameworkSelector = ({ 
  language, 
  framework, 
  availableFrameworks, 
  onFrameworkChange 
}) => {
  return (
    <div className="framework-selector">
      <h3 className="section-title">🧪 Testing Framework</h3>
      
      <div className="framework-info">
        <div className="info-item">
          <span className="info-label">Language:</span>
          <span className="info-value">{language || 'Not detected'}</span>
        </div>
      </div>

      <div className="select-wrapper">
        <label htmlFor="framework-select" className="select-label">
          Select Framework:
        </label>
        <select
          id="framework-select"
          value={framework}
          onChange={(e) => onFrameworkChange(e.target.value)}
          className="framework-select"
        >
          {availableFrameworks.map((fw) => (
            <option key={fw} value={fw}>
              {fw}
            </option>
          ))}
        </select>
      </div>

      <div className="framework-description">
        {getFrameworkDescription(framework)}
      </div>
    </div>
  );
};

const getFrameworkDescription = (framework) => {
  const descriptions = {
    Jest: '⚡ Popular JavaScript testing framework with built-in mocking and coverage',
    Mocha: '☕ Flexible JavaScript test framework with rich ecosystem',
    Vitest: '🚀 Blazing fast unit test framework powered by Vite',
    pytest: '🐍 Powerful Python testing framework with simple syntax',
    unittest: '📦 Python\'s built-in unit testing framework',
    JUnit: '☕ Standard testing framework for Java applications',
    TestNG: '🎯 Advanced Java testing framework inspired by JUnit',
  };

  return descriptions[framework] || '';
};

export default FrameworkSelector;