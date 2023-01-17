import React, { useState, useEffect } from "react";

const POLL_INTERVAL = 1000; // Poll condition every 1 second

interface TransactionTrackerProps {
  bundlerEndpoint: string;
  operationID?: string;
  onTxStatusUpdate: (status: TransactionStatus) => void;
  progressBarStyles: React.CSSProperties;
}

export enum TransactionStatus {
  SUBMITTING = "SUBMITTING",
  QUEUED = "QUEUED",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
};

function TxStatusFromResString(status: string): TransactionStatus {
  switch (status) {
    case TransactionStatus.QUEUED:
      return TransactionStatus.QUEUED;
    case TransactionStatus.IN_BATCH:
      return TransactionStatus.IN_BATCH;
    case TransactionStatus.IN_FLIGHT:
      return TransactionStatus.IN_FLIGHT;
    case TransactionStatus.EXECUTED_SUCCESS:
      return TransactionStatus.EXECUTED_SUCCESS;
    case TransactionStatus.EXECUTED_FAILED:
      return TransactionStatus.EXECUTED_FAILED;
    default:
      throw new Error("Invalid transaction status - should never happen!");
  }
}

export const TransactionTracker: React.FC<TransactionTrackerProps> = ({ bundlerEndpoint, operationID, onTxStatusUpdate, progressBarStyles }) => {
  const [progress, setProgress] = useState(0);

  const getStatusURL = `${bundlerEndpoint}/operations/${operationID}`;

  useEffect(() => {
    if (!operationID) {
      return;
    }

    const interval = setInterval(() => {
      // Poll condition and update status and progress accordingly
      fetch(getStatusURL)
        .then((response) => response.json())
        .then((result) => {
          switch (TxStatusFromResString(result.status)) {
            case TransactionStatus.QUEUED:
              setProgress(25);
              onTxStatusUpdate(TransactionStatus.QUEUED);
              break;
            case TransactionStatus.IN_BATCH:
              setProgress(50);
              onTxStatusUpdate(TransactionStatus.IN_BATCH);
              break;
            case TransactionStatus.IN_FLIGHT:
              setProgress(75);
              onTxStatusUpdate(TransactionStatus.IN_FLIGHT);
              break;
            case TransactionStatus.EXECUTED_SUCCESS:
              setProgress(100);
              clearInterval(interval);
              onTxStatusUpdate(TransactionStatus.EXECUTED_SUCCESS);
              break;
            case TransactionStatus.EXECUTED_FAILED:
              setProgress(100);
              clearInterval(interval);
              onTxStatusUpdate(TransactionStatus.EXECUTED_FAILED);
              break;
            default: 
              throw new Error("Invalid transaction status - should never happen!");
          }
        });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [operationID]);

  return (
    <div className="transaction-tracker">
      <div className="progress-bar">
        <div className="progress" style={{ ...progressBarStyles, width: `${progress}%`, height: 30}} />
      </div>
    </div>
  );
};

export default TransactionTracker;
