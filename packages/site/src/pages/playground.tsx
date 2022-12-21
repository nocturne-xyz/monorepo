import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { MetamaskActions, MetaMaskContext } from "../hooks";
import { connectSnap, getSnap, shouldDisplayReconnectButton } from "../utils";
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
  ABIForm,
} from "../components";
import {
  Action,
  JoinSplitRequest,
  ERC20_ID,
  OperationRequest,
} from "@nocturne-xyz/sdk";
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import {
  loadNocturneFrontendSDK,
  NocturneFrontendSDK,
} from "@nocturne-xyz/frontend-sdk";

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

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.large};
  font-weight: 500;
  margin-top: 0;
  margin-bottom: 0;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
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

const Playground = () => {
  const [state, dispatch] = useContext(MetaMaskContext);

  const [nocturneFrontendSDK, setFrontendSDK] = useState<NocturneFrontendSDK>();

  useEffect(() => {
    loadNocturneFrontendSDK().then((sdk) => {
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

  const syncNotes = async () => {
    try {
      await nocturneFrontendSDK!.syncNotes();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const syncLeaves = async () => {
    try {
      await nocturneFrontendSDK!.syncLeaves();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const proveJoinSplit = async () => {
    const tokenAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
    const joinSplitRequest: JoinSplitRequest = {
      asset: { address: tokenAddress, id: ERC20_ID },
      unwrapValue: 25n,
    };

    const refundTokens = [tokenAddress];
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [tokenAddress, 50]
      );
    const action: Action = {
      contractAddress: tokenAddress,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      joinSplitRequests: [joinSplitRequest],
      refundTokens,
      actions: [action],
    };

    console.log("Operation request: ", operationRequest);
    try {
      const provenOperation =
        await nocturneFrontendSDK!.generateProvenOperation(operationRequest);
      console.log(provenOperation);
    } catch (e) {
      console.error("error: ", e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  return (
    <Container>
      <Heading>
        Welcome to <Span>template-snap</Span>
      </Heading>
      <Subtitle>
        Get started by editing <code>src/index.ts</code>
      </Subtitle>
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
            <InstallFlaskButton />
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
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Notice>
            <p>Please connect using MetaMask Flask to continue.</p>
          </Notice>
        )}
      </CardContainer>
      {shouldDisplayReconnectButton(state.installedSnap) && (
        <CardContainer>
          <Card
            content={{
              title: "Contract Interaction",
              description:
                "Interact with the contract by pasting its ABI below",
            }}
            fullWidth
          >
            <ABIForm />
          </Card>
        </CardContainer>
      )}
    </Container>
  );
};

export default Playground;
