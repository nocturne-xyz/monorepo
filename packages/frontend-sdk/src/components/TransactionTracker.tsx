import React, { useState, useEffect } from "react";

// TODO: make a common package this can live in
// we can't currently import it into site because bundler also has a bunch of node-specifc deps that we can't include in browser
export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
}


const POLL_INTERVAL = 1000; // Poll condition every 1 second

export interface TransactionTrackerProps {
  bundlerEndpoint: string;
  operationID?: string;
  progressBarStyles?: React.CSSProperties;
  textStyles?: React.CSSProperties;
}

function parseOperationStatus(status: string): OperationStatus {
  switch (status) {
    case OperationStatus.QUEUED:
      return OperationStatus.QUEUED;
    case OperationStatus.PRE_BATCH:
      return OperationStatus.PRE_BATCH;
    case OperationStatus.IN_BATCH:
      return OperationStatus.IN_BATCH;
    case OperationStatus.IN_FLIGHT:
      return OperationStatus.IN_FLIGHT;
    case OperationStatus.EXECUTED_SUCCESS:
      return OperationStatus.EXECUTED_SUCCESS;
    case OperationStatus.EXECUTED_FAILED:
      return OperationStatus.EXECUTED_FAILED;
    default:
      throw new Error("Invalid transaction status - should never happen!");
  }
}

enum TxStatusMessage {
  SUBMITTING = "Submitting transaction to the bundler...",
  QUEUED = "Waiting to be included in a bundle...",
  IN_BATCH = "Waiting for the bundle to be submitted...",
  IN_FLIGHT = "Waiting for the bundle to be executed...",
  EXECUTED_SUCCESS = "Transaction executed successfully!",
  EXECUTED_FAILED = "Transaction failed to execute",
};

function getTxStatusMsg(status: OperationStatus): TxStatusMessage {
  switch (status) {

    // display same message for QUEUED and PRE_BATCHß
    case OperationStatus.QUEUED:
    case OperationStatus.PRE_BATCH:
      return TxStatusMessage.QUEUED;
    case OperationStatus.IN_BATCH:
      return TxStatusMessage.IN_BATCH;
    case OperationStatus.IN_FLIGHT:
      return TxStatusMessage.IN_FLIGHT;
    case OperationStatus.EXECUTED_SUCCESS:
      return TxStatusMessage.EXECUTED_SUCCESS;
    case OperationStatus.EXECUTED_FAILED:
      return TxStatusMessage.EXECUTED_FAILED;
    default:
      return TxStatusMessage.SUBMITTING;
  }
}

export const TransactionTracker: React.FC<TransactionTrackerProps> = ({ bundlerEndpoint, operationID, progressBarStyles, textStyles }) => {
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<TxStatusMessage>(TxStatusMessage.SUBMITTING);

  const getStatusURL = `${bundlerEndpoint}/operations/${operationID}`;

  const onTxStatusUpdate = (operationStatus: OperationStatus) => {
    console.log("transaction status is now", operationStatus.toString());
    setMsg(getTxStatusMsg(operationStatus));
  };

  useEffect(() => {
    if (!operationID) {
      return;
    }

    const interval = setInterval(() => {
      // Poll condition and update status and progress accordingly
      console.log("checking status of operation", operationID);
      fetch(getStatusURL)
        .then((response) => response.json())
        .then((result) => {
          console.log("result", result);
          const status = parseOperationStatus(result.status);
          switch (status) {
            case OperationStatus.QUEUED:
              setProgress(12);
              break;
            case OperationStatus.PRE_BATCH:
              setProgress(25);
              break;
            case OperationStatus.IN_BATCH:
              setProgress(50);
              break;
            case OperationStatus.IN_FLIGHT:
              setProgress(75);
              break;
            case OperationStatus.EXECUTED_SUCCESS:
              setProgress(100);
              clearInterval(interval);
              break;
            case OperationStatus.EXECUTED_FAILED:
              setProgress(100);
              clearInterval(interval);
              break;
            default: 
             throw new Error("Invalid transaction status - should never happen!");
          }

          onTxStatusUpdate(status);
        });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [operationID]);

  return (
    <div className="transaction-tracker">
      <div className="progress-bar">
        <div className="progress" style={{ ...progressBarStyles, width: `${progress}%`, height: 30}} />
        <span style={textStyles}>{msg}</span> 
      </div>
    </div>
  );
};

export default TransactionTracker;
