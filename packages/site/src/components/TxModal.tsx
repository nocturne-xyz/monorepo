import styled from "styled-components";
import Modal from "react-modal";
import { TransactionTracker } from "@nocturne-xyz/frontend-sdk";


const ModalContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export interface TxModalProps {
  operationId?: string
  bundlerEndpoint: string,
  isOpen: boolean,
  handleClose: () => void;
}

export const TxModal: React.FC<TxModalProps> = ({bundlerEndpoint, isOpen, operationId, handleClose}) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="Transaction Status"
      ariaHideApp={false}
    >
      <ModalContainer>
        <TransactionTracker
          bundlerEndpoint={bundlerEndpoint}
          operationID={operationId}
          progressBarStyles={{ color: "black" }}
          textStyles={{ color: "#24272a"}}
        />
      </ModalContainer>
    </Modal>
  );
}