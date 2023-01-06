import React, { useState, useEffect } from "react";

const POLL_INTERVAL = 1000; // Poll condition every 1 second

interface TransactionModalProps {
  serverUrl: string;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ serverUrl }) => {
  const [stage, setStage] = useState("QUEUED");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Poll condition and update stage and progress accordingly
      fetch(serverUrl)
        .then((response) => response.json())
        .then((result) => {
          if (result.stage === "QUEUED") {
            setStage("QUEUED");
            setProgress(25);
          } else if (result.stage === "IN_BATCH") {
            setStage("IN_BATCH");
            setProgress(50);
          } else if (result.stage === "IN_FLIGHT") {
            setStage("IN_FLIGHT");
            setProgress(75);
          } else if (result.stage === "EXECUTED_SUCCESS") {
            setStage("EXECUTED_SUCCESS");
            setProgress(100);
            clearInterval(interval);
          } else if (result.stage === "EXECUTED_FAILED") {
            setStage("EXECUTED_FAILED");
            setProgress(100);
            clearInterval(interval);
          }
        });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="transaction-modal">
      <div className="stage">{stage}</div>
      <div className="progress-bar">
        <div className="progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default TransactionModal;
