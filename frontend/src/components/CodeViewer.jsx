import React, { useState, useMemo, useRef, useEffect } from 'react';
import { downloadFile, getTestFileName } from '../utils/fileHelpers';
import '../styling/CodeViewer.css';

const CodeViewer = ({ code, fileName, framework, language }) => {
  const [copied, setCopied] = useState(false);
  const codeContainerRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Memoize line numbers to avoid recalculation on every render
  const lineNumbers = useMemo(() => {
    if (!code) return '';
    const lines = code.split('\n');
    return lines.map((_, index) => index + 1).join('\n');
  }, [code]);

  // Memoize line count for dynamic height calculation
  const lineCount = useMemo(() => {
    if (!code) return 0;
    return code.split('\n').length;
  }, [code]);

  // Sync scroll between line numbers and code content
  useEffect(() => {
    const codeContainer = codeContainerRef.current;
    const lineNumbersDiv = lineNumbersRef.current;

    if (!codeContainer || !lineNumbersDiv) return;

    const handleScroll = () => {
      lineNumbersDiv.scrollTop = codeContainer.scrollTop;
    };

    codeContainer.addEventListener('scroll', handleScroll);
    return () => codeContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const testFileName = getTestFileName(fileName, framework);
    downloadFile(code, testFileName);
  };

  // Calculate dynamic max height based on content (max 600px or content height)
  const maxHeight = useMemo(() => {
    const lineHeight = 1.6 * 0.9 * 16; // line-height * font-size * base pixel
    const contentHeight = lineCount * lineHeight + 32; // 32px for padding
    return Math.min(contentHeight, 600);
  }, [lineCount]);

  return (
    <div className="code-viewer">
      <div className="code-viewer-header">
        <div className="header-left">
          <h3 className="section-title">📝 Generated Test Cases</h3>
          <span className="language-badge">{language} - {framework}</span>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={handleDownload}
            title="Download test file"
          >
            💾 Download
          </button>
        </div>
      </div>

      <div className="code-container" style={{ maxHeight: `${maxHeight}px` }}>
        <div 
          ref={lineNumbersRef}
          className="line-numbers"
        >
          <pre>{lineNumbers}</pre>
        </div>
        <div 
          ref={codeContainerRef}
          className="code-content"
        >
          <pre><code>{code}</code></pre>
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;