import React, { useState, useEffect } from "react";

const POLL_INTERVAL = 1000; // Poll condition every 1 second

interface TransactionModalProps {
  serverUrl: string;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ serverUrl }) => {
  const [status, setStatus] = useState("QUEUED");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Poll condition and update status and progress accordingly
      fetch(serverUrl)
        .then((response) => response.json())
        .then((result) => {
          if (result.status === "QUEUED") {
            setStatus("QUEUED");
            setProgress(25);
          } else if (result.status === "IN_BATCH") {
            setStatus("IN_BATCH");
            setProgress(50);
          } else if (result.status === "IN_FLIGHT") {
            setStatus("IN_FLIGHT");
            setProgress(75);
          } else if (result.status === "EXECUTED_SUCCESS") {
            setStatus("EXECUTED_SUCCESS");
            setProgress(100);
            clearInterval(interval);
          } else if (result.status === "EXECUTED_FAILED") {
            setStatus("EXECUTED_FAILED");
            setProgress(100);
            clearInterval(interval);
          }
        });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="transaction-modal">
      <div className="status">{status}</div>
      <div className="progress-bar">
        <div className="progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default TransactionModal;
