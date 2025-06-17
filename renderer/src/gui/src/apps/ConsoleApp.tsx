import './ConsoleApp.scss';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useXTerm, UseXTermProps } from 'react-xtermjs';
import { FitAddon } from 'xterm-addon-fit';

import WindowWrapper from '../WindowWrapper';

const ConsoleApp = ({ onClose, title }: { onClose: () => void; title: string }) => {
  const [command, setCommand] = useState(''); // Track the current command
  const fitAddon = useRef<FitAddon>(new FitAddon()); // Use a ref for fitAddon to ensure it persists between renders

  const xtermOptions: UseXTermProps = useMemo(
    () => ({
      options: {
        fontSize: 14,
        cursorBlink: true,
        cursorStyle: 'block',
        theme: {
          background: 'transparent',
          foreground: '#49ee88',
        },
      },
    }),
    [],
  );

  // Use the `useXTerm` hook to get the terminal instance and reference to mount the terminal
  const { ref, instance } = useXTerm(xtermOptions);

  // Log whenever `instance` is updated to see if it changes too frequently
  useEffect(() => {
    console.debug('Instance created or changed:', instance);
  }, [instance]);

  // Terminal Set Up (Only run when instance is stable and available)
  useEffect(() => {
    if (!instance) return; // Skip if instance is not available

    console.debug('Terminal setup starting...');

    fitAddon.current.fit(); // Fit the terminal when it's mounted

    // Display the initial message
    instance.writeln('Welcome to the Gal Terminal!');
    instance.write('\n');
    instance.write('$ ');

    // Handle input and commands
    let currentCommand = ''; // Track the current command in a local variable

    const keyListener = instance.onKey(({ key, domEvent }) => {
      if (domEvent.key === 'Enter') {
        instance.writeln(''); // Create a new line after pressing Enter
        runCommand(currentCommand); // Run the command
        currentCommand = ''; // Reset the command
        instance.write('$ ');
      } else if (domEvent.key === 'Backspace') {
        if (currentCommand.length > 0) {
          instance.write('\b \b'); // Handle backspace
          currentCommand = currentCommand.slice(0, -1); // Remove last character from command
        }
      } else if (domEvent.key.length === 1) {
        instance.write(key); // Write the key to the terminal
        currentCommand += key; // Append the key to the command
      }
    });

    // Clean up the key listener when the component unmounts
    return () => {
      console.debug('Cleaning up terminal listener...');
      keyListener.dispose();
    };
  }, [instance]); // Only run this effect when `instance` is available

  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      console.debug('Resizing terminal...');
      fitAddon.current.fit(); // Resize the terminal to fit its container
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // This effect should only run once, as fitAddon is stable with the useRef

  // Function to send the command to the backend and handle the response
  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return; // Avoid sending empty commands

    try {
      const response = await fetch('https://humble-new-mammoth.ngrok-free.app/run-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await response.json();

      // Output the result in the terminal
      instance?.writeln(data.result || 'Command executed.');
    } catch (error) {
      if (error instanceof Error) {
        instance?.writeln(`Error: ${error.message}`);
      } else {
        instance?.writeln(`Error: ${String(error)}`);
      }
    } finally {
      instance?.write('$ '); // Always display prompt again after command execution
    }
  };

  return (
    <WindowWrapper title={title} onClose={onClose}>
      <div className="commandConsole">
        <div className="titleBar"></div>
        <div ref={ref} className="xterm-container" />
      </div>
    </WindowWrapper>
  );
};

export default ConsoleApp;
