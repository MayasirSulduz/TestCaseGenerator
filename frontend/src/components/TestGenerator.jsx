import React, { useState, useEffect } from 'react';
import '../styling/TestGenerator.css';

const TestGenerator = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [sourceCode, setSourceCode] = useState('');
  const [language, setLanguage] = useState('');
  const [framework, setFramework] = useState('Jest');
  const [availableFrameworks, setAvailableFrameworks] = useState(['Jest']);
  const [coverageTarget, setCoverageTarget] = useState(80);
  const [generatedTests, setGeneratedTests] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [coverageReport, setCoverageReport] = useState(null);

  // Handle file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');
    setLoading(true);

    try {
      // Read file content
      const text = await file.text();
      setSourceCode(text);

      // Detect framework
      const response = await fetch('http://localhost:5000/api/detect-framework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name })
      });

      const data = await response.json();

      if (data.status === 'success') {
        setLanguage(data.language);
        setFramework(data.framework);
        setAvailableFrameworks(data.availableFrameworks);
        setSuccess(`✓ Detected: ${data.language} (${data.framework})`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to process file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate tests with REAL coverage
  const handleGenerateTests = async () => {
    if (!sourceCode) {
      setError('Please upload a source file first');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      setGeneratedTests('');
      setCoverageReport(null);

      const filename = selectedFile.name.split('.')[0]; // Remove extension

      const response = await fetch('http://localhost:5000/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: sourceCode,
          language: language,
          framework: framework,
          coverageTarget: coverageTarget,
          filename: filename
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setGeneratedTests(result.tests);
        setCoverageReport(result.coverageReport);
        setSuccess('✓ Test cases generated with real coverage analysis!');
      } else {
        setError(result.message || 'Failed to generate tests');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  //   return (
  //     <div style={{
  //       maxWidth: '1400px',
  //       margin: '0 auto',
  //       padding: '20px',
  //       fontFamily: 'system-ui, -apple-system, sans-serif'
  //     }}>
  //       <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
  //         🤖 AI Test Case Generator with Real Coverage
  //       </h1>

  //       <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
  //         {/* LEFT PANEL */}
  //         <div style={{
  //           background: '#f8f9fa',
  //           padding: '20px',
  //           borderRadius: '8px',
  //           height: 'fit-content'
  //         }}>
  //           {!selectedFile && (
  //             <div style={{ textAlign: 'center', padding: '20px', marginBottom: '20px' }}>
  //               <h3>🎯 Welcome!</h3>
  //               <p>Upload a source file to generate AI-powered test cases with real coverage analysis.</p>
  //             </div>
  //           )}

  //           {/* File Upload */}
  //           <div style={{ marginBottom: '20px' }}>
  //             <label style={{
  //               display: 'block',
  //               padding: '40px',
  //               background: 'white',
  //               border: '2px dashed #007bff',
  //               borderRadius: '8px',
  //               textAlign: 'center',
  //               cursor: 'pointer'
  //             }}>
  //               <input
  //                 type="file"
  //                 accept=".js,.jsx,.ts,.tsx,.py,.java"
  //                 onChange={handleFileSelect}
  //                 style={{ display: 'none' }}
  //               />
  //               <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
  //               <div style={{ fontWeight: 'bold', color: '#007bff' }}>
  //                 {selectedFile ? selectedFile.name : 'Click to upload source file'}
  //               </div>
  //               <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
  //                 Supports: JS, TS, Python, Java
  //               </div>
  //             </label>
  //           </div>

  //           {selectedFile && (
  //             <>
  //               {/* Framework Selector */}
  //               <div style={{ marginBottom: '20px' }}>
  //                 <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
  //                   Testing Framework
  //                 </label>
  //                 <select
  //                   value={framework}
  //                   onChange={(e) => setFramework(e.target.value)}
  //                   style={{
  //                     width: '100%',
  //                     padding: '10px',
  //                     borderRadius: '4px',
  //                     border: '1px solid #ddd'
  //                   }}
  //                 >
  //                   {availableFrameworks.map(fw => (
  //                     <option key={fw} value={fw}>{fw}</option>
  //                   ))}
  //                 </select>
  //               </div>

  //               {/* Coverage Target Slider */}
  //               <div style={{ marginBottom: '20px' }}>
  //                 <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
  //                   Target Coverage: {coverageTarget}%
  //                 </label>
  //                 <input
  //                   type="range"
  //                   min="50"
  //                   max="100"
  //                   value={coverageTarget}
  //                   onChange={(e) => setCoverageTarget(Number(e.target.value))}
  //                   style={{ width: '100%' }}
  //                 />
  //                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6c757d' }}>
  //                   <span>50%</span>
  //                   <span>75%</span>
  //                   <span>100%</span>
  //                 </div>
  //               </div>

  //               {/* Generate Button */}
  //               <button
  //                 onClick={handleGenerateTests}
  //                 disabled={loading}
  //                 style={{
  //                   width: '100%',
  //                   padding: '15px',
  //                   background: loading ? '#6c757d' : '#28a745',
  //                   color: 'white',
  //                   border: 'none',
  //                   borderRadius: '8px',
  //                   fontSize: '16px',
  //                   fontWeight: 'bold',
  //                   cursor: loading ? 'not-allowed' : 'pointer'
  //                 }}
  //               >
  //                 {loading ? '⏳ Generating...' : '🚀 Generate Test Cases'}
  //               </button>
  //             </>
  //           )}
  //         </div>

  //         {/* RIGHT PANEL */}
  //         <div style={{
  //           background: 'white',
  //           padding: '20px',
  //           borderRadius: '8px',
  //           border: '1px solid #ddd'
  //         }}>
  //           {loading && (
  //             <div style={{ textAlign: 'center', padding: '40px' }}>
  //               <div style={{
  //                 display: 'inline-block',
  //                 width: '40px',
  //                 height: '40px',
  //                 border: '4px solid #f3f3f3',
  //                 borderTop: '4px solid #007bff',
  //                 borderRadius: '50%',
  //                 animation: 'spin 1s linear infinite'
  //               }} />
  //               <p style={{ marginTop: '20px', color: '#6c757d' }}>
  //                 {sourceCode ? '🤖 AI is generating tests and measuring coverage...' : '📂 Processing file...'}
  //               </p>
  //             </div>
  //           )}

  //           {error && (
  //             <div style={{
  //               background: '#f8d7da',
  //               color: '#721c24',
  //               padding: '15px',
  //               borderRadius: '4px',
  //               marginBottom: '20px',
  //               display: 'flex',
  //               justifyContent: 'space-between',
  //               alignItems: 'center'
  //             }}>
  //               <span><strong>Error:</strong> {error}</span>
  //               <button
  //                 onClick={() => setError('')}
  //                 style={{
  //                   background: 'none',
  //                   border: 'none',
  //                   fontSize: '18px',
  //                   cursor: 'pointer'
  //                 }}
  //               >
  //                 ✕
  //               </button>
  //             </div>
  //           )}

  //           {success && !generatedTests && (
  //             <div style={{
  //               background: '#d4edda',
  //               color: '#155724',
  //               padding: '15px',
  //               borderRadius: '4px',
  //               marginBottom: '20px'
  //             }}>
  //               {success}
  //             </div>
  //           )}

  //           {generatedTests && (
  //             <div>
  //               <h3 style={{ marginBottom: '15px' }}>✅ Generated Test Cases</h3>
  //               <pre style={{
  //                 background: '#f8f9fa',
  //                 padding: '15px',
  //                 borderRadius: '4px',
  //                 overflow: 'auto',
  //                 maxHeight: '400px',
  //                 fontSize: '13px',
  //                 lineHeight: '1.5'
  //               }}>
  //                 {generatedTests}
  //               </pre>

  //               {/* REAL Coverage Analysis */}
  //               {coverageReport && (
  //                 <div style={{ marginTop: '30px' }}>
  //                   <h3>📊 Real Coverage Analysis</h3>

  //                   {/* Run Command */}
  //                   <div style={{
  //                     background: '#e7f3ff',
  //                     padding: '15px',
  //                     borderRadius: '4px',
  //                     marginBottom: '15px'
  //                   }}>
  //                     <strong>💻 Run Command:</strong>
  //                     <pre style={{
  //                       background: '#2d2d2d',
  //                       color: '#f8f8f2',
  //                       padding: '10px',
  //                       borderRadius: '4px',
  //                       marginTop: '10px',
  //                       overflow: 'auto'
  //                     }}>
  //                       {coverageReport.runCommand}
  //                     </pre>
  //                   </div>

  //                   {/* Coverage Badge */}
  //                   <div style={{
  //                     display: 'inline-block',
  //                     padding: '10px 20px',
  //                     borderRadius: '20px',
  //                     color: 'white',
  //                     fontWeight: 'bold',
  //                     fontSize: '18px',
  //                     marginBottom: '15px',
  //                     background: coverageReport.totalCoverage >= 80 ? '#28a745' :
  //                       coverageReport.totalCoverage >= 60 ? '#ffc107' : '#dc3545'
  //                   }}>
  //                     Total Coverage: {coverageReport.totalCoverage}%
  //                   </div>

  //                   {/* Coverage Table */}
  //                   {coverageReport.summaryTable && (
  //                     <div style={{
  //                       background: '#f8f9fa',
  //                       padding: '15px',
  //                       borderRadius: '4px',
  //                       marginBottom: '15px'
  //                     }}>
  //                       <pre style={{ margin: 0, fontSize: '12px', overflow: 'auto' }}>
  //                         {coverageReport.summaryTable}
  //                       </pre>
  //                     </div>
  //                   )}

  //                   {/* Missing Lines */}
  //                   {coverageReport.missingLines && coverageReport.missingLines !== 'None' && (
  //                     <div style={{
  //                       background: '#fff3cd',
  //                       padding: '15px',
  //                       borderRadius: '4px',
  //                       marginBottom: '15px'
  //                     }}>
  //                       <strong>❌ Missing Lines:</strong>
  //                       <div style={{
  //                         marginTop: '10px',
  //                         fontFamily: 'monospace',
  //                         color: '#856404'
  //                       }}>
  //                         {coverageReport.missingLines}
  //                       </div>
  //                     </div>
  //                   )}

  //                   {/* Suggestions */}
  //                   {coverageReport.suggestions && coverageReport.suggestions.length > 0 && (
  //                     <div style={{
  //                       background: '#d1ecf1',
  //                       padding: '15px',
  //                       borderRadius: '4px'
  //                     }}>
  //                       <strong>💡 Suggestions:</strong>
  //                       <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
  //                         {coverageReport.suggestions.map((s, i) => (
  //                           <li key={i} style={{ marginBottom: '5px' }}>{s}</li>
  //                         ))}
  //                       </ul>
  //                     </div>
  //                   )}
  //                 </div>
  //               )}
  //             </div>
  //           )}

  //           {!selectedFile && !loading && (
  //             <div style={{ textAlign: 'center', padding: '60px', color: '#6c757d' }}>
  //               <div style={{ fontSize: '48px', marginBottom: '20px' }}>📝</div>
  //               <p>Generated test cases will appear here after upload & generation</p>
  //             </div>
  //           )}

  //           {selectedFile && !generatedTests && !loading && (
  //             <div style={{ textAlign: 'center', padding: '60px', color: '#6c757d' }}>
  //               <p>👈 Click "Generate Test Cases" to see results here</p>
  //             </div>
  //           )}
  //         </div>
  //       </div>

  //       <style>{`
  //         @keyframes spin {
  //           0% { transform: rotate(0deg); }
  //           100% { transform: rotate(360deg); }
  //         }
  //       `}</style>
  //     </div>
  //   );
  // };

  return (
    <div className="test-generator">
      <h1 className="title">
        🤖 AI Test Case Generator with Real Coverage
      </h1>

      <div className="layout-grid">
        {/* LEFT PANEL */}
        <div className="left-panel">
          {!selectedFile && (
            <div className="welcome-box">
              <h3>🎯 Welcome!</h3>
              <p>
                Upload a source file to generate AI-powered test cases with real
                coverage analysis.
              </p>
            </div>
          )}

          {/* File Upload */}
          <div className="upload-section">
            <label>
              <input
                type="file"
                accept=".js,.jsx,.ts,.tsx,.py,.java"
                onChange={handleFileSelect}
                hidden
              />
              <div>📁</div>
              <div className="file-info">
                {selectedFile
                  ? selectedFile.name
                  : 'Click to upload source file'}
              </div>
              <small>Supports: JS, TS, Python, Java</small>
            </label>
          </div>

          {selectedFile && (
            <>
              {/* Framework Selector */}
              <div className="control-group">
                <label className="control-label">
                  Testing Framework
                </label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                >
                  {availableFrameworks.map((fw) => (
                    <option key={fw} value={fw}>
                      {fw}
                    </option>
                  ))}
                </select>
              </div>

              {/* Coverage Slider */}
              <div className="control-group">
                <label className="control-label">
                  Target Coverage
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={coverageTarget}
                  onChange={(e) =>
                    setCoverageTarget(Number(e.target.value))
                  }
                />
                <div className="coverage-value">
                  {coverageTarget}%
                </div>
              </div>

              {/* Generate Button */}
              <button
                className="btn-generate"
                onClick={handleGenerateTests}
                disabled={loading}
              >
                {loading ? '⏳ Generating...' : '🚀 Generate Test Cases'}
              </button>
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          {loading && (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>
                {sourceCode
                  ? 'AI is generating tests & coverage...'
                  : 'Processing file...'}
              </p>
            </div>
          )}

          {error && (
            <div className="alert error">
              <strong>Error:</strong> {error}
              <button
                className="close-btn"
                onClick={() => setError('')}
              >
                ✕
              </button>
            </div>
          )}

          {success && !generatedTests && (
            <div className="alert success">
              {success}
            </div>
          )}

          {generatedTests && (
            <div className="results-section">
              <h3>✅ Generated Test Cases</h3>
              <pre>{generatedTests}</pre>

              {coverageReport && (
                <div className="coverage-section">
                  <h3>📊 Real Coverage Analysis</h3>

                  <div className="coverage-card">
                    <strong>💻 Run Command</strong>
                    <div className="run-command">
                      {coverageReport.runCommand}
                    </div>
                  </div>

                  <div
                    className="coverage-badge"
                    style={{
                      background:
                        coverageReport.totalCoverage >= 80
                          ? '#28a745'
                          : coverageReport.totalCoverage >= 60
                            ? '#ffc107'
                            : '#dc3545',
                    }}
                  >
                    Total Coverage: {coverageReport.totalCoverage}%
                  </div>

                  {coverageReport.summaryTable && (
                    <div className="coverage-table">
                      <pre>{coverageReport.summaryTable}</pre>
                    </div>
                  )}

                  {coverageReport.missingLines &&
                    coverageReport.missingLines !== 'None' && (
                      <div className="coverage-detail">
                        <span className="missing-lines">
                          {coverageReport.missingLines}
                        </span>
                      </div>
                    )}

                  {coverageReport.suggestions?.length > 0 && (
                    <div className="suggestions-box">
                      <strong>💡 Suggestions</strong>
                      <ul>
                        {coverageReport.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!selectedFile && !loading && (
            <div className="placeholder">
              Generated test cases will appear here
            </div>
          )}

          {selectedFile && !generatedTests && !loading && (
            <div className="placeholder">
              👈 Click “Generate Test Cases” to see results
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default TestGenerator;