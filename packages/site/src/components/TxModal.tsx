import Modal from "react-modal";
import { TransactionTracker } from "@nocturne-xyz/frontend-sdk";
import { Card } from "./Card";
import SyncLoader from "react-spinners/SyncLoader";
import { CiCircleCheck, CiCircleAlert } from "react-icons/ci";
import { useEffect, useState } from "react";
import { OperationStatus } from "@nocturne-xyz/sdk";

export interface TxModalProps {
  operationId?: string;
  bundlerEndpoint: string;
  isOpen: boolean;
  handleClose: () => void;
}

enum ModalState {
  LOADING,
  SUCCESS,
  ERROR,
}

export const TxModal: React.FC<TxModalProps> = ({
  bundlerEndpoint,
  isOpen,
  operationId,
  handleClose,
}) => {
  const [modalState, setModalState] = useState(ModalState.LOADING);

  useEffect(() => {
    setModalState(ModalState.LOADING);
  }, [operationId]);

  const onOperationComplete = (status: OperationStatus) => {
    if (status === OperationStatus.EXECUTED_SUCCESS) {
      setModalState(ModalState.SUCCESS);
    } else {
      setModalState(ModalState.ERROR);
    }
  };

  let graphic;
  switch (modalState) {
    case ModalState.LOADING:
      graphic = <SyncLoader color="#24272a" />;
      break;
    case ModalState.SUCCESS:
      graphic = <CiCircleCheck size={100} color="#24272a" />;
      break;
    case ModalState.ERROR:
      graphic = <CiCircleAlert size={100} color="#24272a" />;
      break;
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="Transaction Status"
      ariaHideApp={false}
    >
      <Card>
        <TransactionTracker
          bundlerEndpoint={bundlerEndpoint}
          operationID={operationId}
          progressBarStyles={{ color: "black" }}
          textStyles={{ color: "#24272a" }}
        />
        {graphic}
      </Card>
    </Modal>
  );
};
