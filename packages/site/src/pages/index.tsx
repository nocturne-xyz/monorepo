import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { MetamaskActions, MetaMaskContext } from "../hooks";
import {
  clearDb,
  connectSnap,
  getSnap,
  shouldDisplayReconnectButton,
} from "../utils";
import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  SyncNotesButton,
  SyncLeavesButton,
  ClearDbButton,
  GetJoinSplitInputsButton,
  GetAllBalancesButton,
  GenAndSubmitProofButton,
} from "../components";
import { bundlerEndpoint } from "../config";
import {
  Action,
  Asset,
  AssetType,
  JoinSplitRequest,
  OperationRequest,
  calculateOperationDigest,
} from "@nocturne-xyz/sdk";
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import {
  loadNocturneFrontendSDK,
  NocturneFrontendSDK,
  BundlerOperationID,
} from "@nocturne-xyz/frontend-sdk";
import { TxModal } from "../components/TxModal";

const ERC20_ID = 0n;
const TOKEN_ADDRESS = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 7.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const Heading = styled.h1`
  margin-top: 0;
  margin-bottom: 2.4rem;
  text-align: center;
`;

const Span = styled.span`
  color: ${(props) => props.theme.colors.primary.default};
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 64.8rem;
  width: 100%;
  height: 100%;
  margin-top: 1.5rem;
`;

const Notice = styled.div`
  background-color: ${({ theme }) => theme.colors.background.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  color: ${({ theme }) => theme.colors.text.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;

  & > * {
    margin: 0;
  }
  ${({ theme }) => theme.mediaQueries.small} {
    margin-top: 1.2rem;
    padding: 1.6rem;
  }
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error.muted};
  border: 1px solid ${({ theme }) => theme.colors.error.default};
  color: ${({ theme }) => theme.colors.error.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const WALLET_CONTRACT_ADDRESS = "0x352f0a59E6431562A2878926a2cF0De76ED2AA55";
const VAULT_CONTRACT_ADDRESS = "0xe29C2A28621dd358ABF5dAc8d0e7735117B77E85";

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);

  const [nocturneFrontendSDK, setFrontendSDK] = useState<NocturneFrontendSDK>();
  const [inFlightOperationID, setInFlightOperationID] = useState<
    BundlerOperationID | undefined
  >();
  const [txModalIsOpen, setTxModalIsOpen] = useState(false);

  useEffect(() => {
    loadNocturneFrontendSDK(
	  bundlerEndpoint,
      WALLET_CONTRACT_ADDRESS,
      VAULT_CONTRACT_ADDRESS
    ).then((sdk) => {
      setFrontendSDK(sdk);
    });
  }, [loadNocturneFrontendSDK]);

  const handleConnectClick = async () => {
    try {
      await connectSnap();
      const installedSnap = await getSnap();

      dispatch({
        type: MetamaskActions.SetInstalled,
        payload: installedSnap,
      });
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleSyncNotesClick = async () => {
    try {
      await nocturneFrontendSDK!.syncNotes();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleSyncLeavesClick = async () => {
    try {
      await nocturneFrontendSDK!.syncLeaves();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleGetAllBalancesClick = async () => {
    try {
      const balances = await nocturneFrontendSDK!.getAllBalances();
      console.log(balances);
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleGenProof = async () => {
    const asset: Asset = {
      assetAddr: TOKEN_ADDRESS,
      id: ERC20_ID,
      assetType: AssetType.ERC20,
    };
    const joinSplitRequest: JoinSplitRequest = {
      asset,
      unwrapValue: 25n,
    };

    const refundAssets = [asset];

    console.log("Encoding transfer function data");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [TOKEN_ADDRESS, 50]
      );
    const action: Action = {
      contractAddress: TOKEN_ADDRESS,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      joinSplitRequests: [joinSplitRequest],
      refundAssets,
      actions: [action],
    };

    console.log("Operation request: ", operationRequest);
    try {
      const provenOperation =
        await nocturneFrontendSDK!.generateProvenOperation(operationRequest);

      console.log(provenOperation);
      console.log(
        "opDigest of provenOperation",
        calculateOperationDigest(provenOperation)
      );

      const isValid = await nocturneFrontendSDK!.verifyProvenOperation(
        provenOperation
      );
      console.log("is valid: ", isValid);

      return provenOperation;
    } catch (e) {
      console.error("error: ", e);
      dispatch({ type: MetamaskActions.SetError, payload: e });

      return null;
    }
  };

  const handleGenAndSubmitProof = async () => {
    const provenOperation = await handleGenProof();
    if (provenOperation === null) {
      console.error("failed to generate proven operation");
      return;
    }

    nocturneFrontendSDK!
      .submitProvenOperation(provenOperation)
      .then((opID: BundlerOperationID) => {
        setInFlightOperationID(opID);
      })
      .catch((err: any) => {
        console.error(err);
        setInFlightOperationID(undefined);
      });

    openTxModal();
  };

  const handleClearDb = async () => {
    try {
      await clearDb();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const openTxModal = () => {
    setTxModalIsOpen(true);
  };

  const handleCloseTxModal = () => {
    setTxModalIsOpen(false);
    setInFlightOperationID(undefined);
  };

  return (
    <>
      <TxModal
        operationId={inFlightOperationID}
        bundlerEndpoint={bundlerEndpoint}
        isOpen={txModalIsOpen}
        handleClose={handleCloseTxModal}
      />
      <Container>
        <Heading>
          <Span>Nocturne Power-User Frontend</Span>
        </Heading>
        <CardContainer>
          {state.error && (
            <ErrorMessage>
              <b>An error happened:</b> {state.error.message}
            </ErrorMessage>
          )}
          {!state.isFlask && (
            <Card
              content={{
                title: "Install",
                description:
                  "Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.",
              }}
              fullWidth
            >
              <InstallFlaskButton />,
            </Card>
          )}
          {!state.installedSnap && (
            <Card
              content={{
                title: "Connect",
                description:
                  "Get started by connecting to and installing the example snap.",
              }}
              disabled={!state.isFlask}
            >
              <ConnectButton
                onClick={handleConnectClick}
                disabled={!state.isFlask}
              />
            </Card>
          )}
          {shouldDisplayReconnectButton(state.installedSnap) && (
            <Card
              content={{
                title: "Reconnect",
                description:
                  "While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.",
              }}
              disabled={!state.installedSnap}
            >
              <ReconnectButton
                onClick={handleConnectClick}
                disabled={!state.installedSnap}
              />
            </Card>
          )}
          <Card
            content={{
              title: "Sync Notes",
              description: "Sync notes.",
            }}
            disabled={!state.installedSnap}
            fullWidth={
              state.isFlask &&
              Boolean(state.installedSnap) &&
              !shouldDisplayReconnectButton(state.installedSnap)
            }
          >
            <SyncNotesButton
              onClick={handleSyncNotesClick}
              disabled={!state.installedSnap}
            />
          </Card>
          <Card
            content={{
              title: "Sync Leaves",
              description: "Sync leaves.",
            }}
            disabled={!state.installedSnap}
            fullWidth={
              state.isFlask &&
              Boolean(state.installedSnap) &&
              !shouldDisplayReconnectButton(state.installedSnap)
            }
          >
            <SyncLeavesButton
              onClick={handleSyncLeavesClick}
              disabled={!state.installedSnap}
            />
          </Card>
          <Card
            content={{
              title: "Get All Balances",
              description: "Get all balances",
            }}
            disabled={!state.installedSnap}
            fullWidth={
              state.isFlask &&
              Boolean(state.installedSnap) &&
              !shouldDisplayReconnectButton(state.installedSnap)
            }
          >
            <GetAllBalancesButton
              onClick={handleGetAllBalancesClick}
              disabled={!state.installedSnap}
            />
          </Card>
          <Card
            content={{
              title: "Generate proof",
              description: "Generate joinsplit proof",
            }}
            disabled={!state.installedSnap}
            fullWidth={
              state.isFlask &&
              Boolean(state.installedSnap) &&
              !shouldDisplayReconnectButton(state.installedSnap)
            }
          >
            <GetJoinSplitInputsButton
              onClick={() => handleGenProof()}
              disabled={!state.installedSnap}
            />
          </Card>
          <Card
            content={{
              title: "Generate proof and Submit Transaction",
              description: "Submit transaction",
            }}
            disabled={!state.installedSnap}
            fullWidth={
              state.isFlask &&
              Boolean(state.installedSnap) &&
              !shouldDisplayReconnectButton(state.installedSnap)
            }
          >
            <GenAndSubmitProofButton
              onClick={() => handleGenAndSubmitProof()}
              disabled={!state.installedSnap}
            />
          </Card>
          <Card
            content={{
              title: "Clear DB",
              description: "Clear DB.",
            }}
            disabled={!state.installedSnap}
            fullWidth={
              state.isFlask &&
              Boolean(state.installedSnap) &&
              !shouldDisplayReconnectButton(state.installedSnap)
            }
          >
            <ClearDbButton
              onClick={handleClearDb}
              disabled={!state.installedSnap}
            />
          </Card>
          <Notice>
            <p>
              Please note that the <b>snap.manifest.json</b> and{" "}
              <b>package.json</b> must be located in the server root directory
              and the bundle must be hosted at the location specified by the
              location field.
            </p>
          </Notice>
        </CardContainer>
      </Container>
    </>
  );
};

export default Index;
