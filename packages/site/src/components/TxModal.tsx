import { TransactionTracker } from "@nocturne-xyz/frontend-sdk";
import { Card } from "./Card";
import SyncLoader from "react-spinners/SyncLoader";
import { CiCircleCheck, CiCircleAlert } from "react-icons/ci";
import { useEffect, useState } from "react";
import { OperationStatus } from "@nocturne-xyz/sdk";
import Popup from "reactjs-popup";
import styled from "styled-components";

export interface TxModalProps {
  operationId?: string;
  bundlerEndpoint: string;
  isOpen: boolean;
  handleClose: () => void;
}

const Modal = styled(Popup)`
  &-overlay {
    background: rgba(0, 0, 0, 0.4);
  }
`;

const ModalCard = styled(Card)`
  background: linear-gradient(to top, rgba(3, 27, 48, 1), rgba(3, 27, 48, 0.8));
`;

const GraphicContainer = styled.div`
  padding-top: 20px;
  width: 100%;
  display: flex;
  justify-content: center;
`;

const TxTracker = styled(TransactionTracker)`
  display: flex;
  flex-direction: column;
`;

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
      graphic = <SyncLoader size={10} color="#FFFFFF" />;
      break;
    case ModalState.SUCCESS:
      graphic = <CiCircleCheck size={50} color="#FFFFFF" />;
      break;
    case ModalState.ERROR:
      graphic = <CiCircleAlert size={50} color="#FFFFFF" />;
      break;
  }

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalCard>
        <TxTracker
          bundlerEndpoint={bundlerEndpoint}
          operationID={operationId}
          progressBarStyles={{ color: "black" }}
          textStyles={{ color: "#FFFFFF" }}
          onComplete={onOperationComplete}
        />
        <GraphicContainer>{graphic}</GraphicContainer>
      </ModalCard>
    </Modal>
  );
};
