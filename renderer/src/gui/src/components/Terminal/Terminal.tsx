import React, { useEffect, useRef, forwardRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './Terminal.scss';

interface TerminalProps {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

interface TerminalRef {
  write: (data: string) => void;
  writeCommand: (cmd: string) => void;
  writeError: (error: string) => void;
  writeSuccess: (message: string) => void;
  clear: () => void;
}

const Terminal = forwardRef<TerminalRef, TerminalProps>(({ onData, onResize }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm>();
  const fitAddonRef = useRef<FitAddon>();
  const [isReady, setIsReady] = useState(false);

  // Initialize xterm instance
  useEffect(() => {
    const initializeTerminal = () => {
      if (!terminalRef.current) return;

      try {
        // Initialize xterm.js
        const term = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            cyan: '#569CD6',    // For commands
            red: '#F14C4C',     // For errors
            green: '#6A9955',   // For success messages
          },
          allowTransparency: true,
          scrollback: 1000,
        });

        // Add FitAddon
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        // Store reference
        xtermRef.current = term;

        // Open terminal
        term.open(terminalRef.current);

        // Wait for next frame to ensure dimensions are calculated
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
            setIsReady(true);
          } catch (e) {
            console.error('Error fitting terminal:', e);
          }
        });

        // Handle data events
        term.onData(data => {
          onData?.(data);
        });

        // Handle resize events
        term.onResize(({ cols, rows }) => {
          onResize?.(cols, rows);
        });

        return () => {
          term.dispose();
          xtermRef.current = undefined;
          fitAddonRef.current = undefined;
        };
      } catch (error) {
        console.error('Error initializing terminal:', error);
      }
    };

    initializeTerminal();
  }, [onData, onResize]);

  // Handle window resize
  useEffect(() => {
    if (!isReady) return;

    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
      } catch (e) {
        console.error('Error resizing terminal:', e);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isReady]);

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    write: (data: string) => {
      if (!xtermRef.current) return;
      try {
        xtermRef.current.write(data);
      } catch (e) {
        console.error('Error writing to terminal:', e);
      }
    },
    writeCommand: (cmd: string) => {
      if (!xtermRef.current) return;
      try {
        xtermRef.current.write(`\x1b[36m$ ${cmd}\x1b[0m\r\n`);
      } catch (e) {
        console.error('Error writing command to terminal:', e);
      }
    },
    writeError: (error: string) => {
      if (!xtermRef.current) return;
      try {
        xtermRef.current.write(`\x1b[31m${error}\x1b[0m\r\n`);
      } catch (e) {
        console.error('Error writing error to terminal:', e);
      }
    },
    writeSuccess: (message: string) => {
      if (!xtermRef.current) return;
      try {
        xtermRef.current.write(`\x1b[32m${message}\x1b[0m\r\n`);
      } catch (e) {
        console.error('Error writing success message to terminal:', e);
      }
    },
    clear: () => {
      if (!xtermRef.current) return;
      try {
        xtermRef.current.write('\x1b[2J\x1b[0;0H');
      } catch (e) {
        console.error('Error clearing terminal:', e);
      }
    }
  }), []);

  return (
    <div ref={terminalRef} className="terminal-container" />
  );
});

Terminal.displayName = 'Terminal';

export { Terminal }; 