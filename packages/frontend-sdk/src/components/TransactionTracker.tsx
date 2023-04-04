import React, { useState, useEffect } from "react";
import { OperationStatus } from "@nocturne-xyz/sdk";

const POLL_INTERVAL = 1000; // Poll condition every 1 second

export interface TransactionTrackerProps {
  bundlerEndpoint: string;
  operationID?: string;
  textStyles?: React.CSSProperties;
  onComplete?: (status: OperationStatus) => void;
  className?: string;
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
    case OperationStatus.OPERATION_PROCESSING_FAILED:
      return OperationStatus.OPERATION_PROCESSING_FAILED;
    case OperationStatus.OPERATION_EXECUTION_FAILED:
      return OperationStatus.OPERATION_EXECUTION_FAILED;
    case OperationStatus.BUNDLE_REVERTED:
      return OperationStatus.BUNDLE_REVERTED;
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
  OPERATION_PROCESSING_FAILED = "Operation processing failed.",
  OPERATION_EXECUTION_FAILED = "Operation execution failed.",
  BUNDLE_REVERTED = "Transaction failed to submit. Please try again in a few minutes.",
}

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
    case OperationStatus.OPERATION_PROCESSING_FAILED:
      return TxStatusMessage.OPERATION_PROCESSING_FAILED;
    case OperationStatus.OPERATION_EXECUTION_FAILED:
      return TxStatusMessage.OPERATION_EXECUTION_FAILED;
    case OperationStatus.BUNDLE_REVERTED:
      return TxStatusMessage.BUNDLE_REVERTED;
    default:
      return TxStatusMessage.SUBMITTING;
  }
}

export const TransactionTracker: React.FC<TransactionTrackerProps> = ({
  bundlerEndpoint,
  operationID,
  textStyles,
  onComplete,
  className,
}) => {
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

          if (
            status === OperationStatus.EXECUTED_SUCCESS ||
            status === OperationStatus.OPERATION_PROCESSING_FAILED ||
            status === OperationStatus.OPERATION_EXECUTION_FAILED ||
            status === OperationStatus.BUNDLE_REVERTED
          ) {
            clearInterval(interval);

            if (onComplete) {
              onComplete(status);
            }
          }

          onTxStatusUpdate(status);
        });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [operationID]);

  return (
    <div className={`${className} transaction-tracker`}>
      <span style={textStyles}>{msg}</span>
    </div>
  );
};
