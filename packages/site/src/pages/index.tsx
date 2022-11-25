import { useContext } from "react";
import styled from "styled-components";
import { MetamaskActions, MetaMaskContext } from "../hooks";
import {
  clearDb,
  connectSnap,
  getOperationInputs,
  getSnap,
  sendHello,
  sendSetAndShowKv,
  shouldDisplayReconnectButton,
  syncLeaves,
  syncNotes,
} from "../utils";
import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  SendHelloButton,
  Card,
  SetAndShowKButton,
  SyncNotesButton,
  SyncLeavesButton,
  ClearDbButton,
  GetOperationInputsButton,
} from "../components";
import { Action, AssetRequest, ERC20_ID, OperationRequest } from "@flax/sdk";
import { SimpleERC20Token__factory } from "@flax/contracts";
import JSON from "json-bigint";
import { LocalSpend2Prover } from "@flax/local-prover";
const snarkjs = require("snarkjs");

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

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);

  let spend2Wasm: any;
  let spend2Zkey: any;

  const instantiateCircuitData = async () => {
    if (!spend2Wasm) {
      spend2Wasm = await fetch("./public/spend2.wasm");
    }
    if (!spend2Zkey) {
      spend2Zkey = await fetch("./public/spend2.zkey");
    }
  };

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

  const handleSendHelloClick = async () => {
    try {
      await sendHello();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleSetAndShowKvClick = async () => {
    try {
      await sendSetAndShowKv();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleSyncNotesClick = async () => {
    try {
      await syncNotes();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleSyncLeavesClick = async () => {
    try {
      await syncLeaves();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleGetOperationInputs = async () => {
    await instantiateCircuitData();

    const tokenAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
    const assetRequest: AssetRequest = {
      asset: { address: tokenAddress, id: ERC20_ID },
      value: 25n,
    };

    const refundTokens = [tokenAddress];
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        ["0x0B306BF915C4d645ff596e518fAf3F9669b97016", 50]
      );
    const action: Action = {
      contractAddress: tokenAddress,
      encodedFunction: encodedFunction,
    };
    const operationRequest: OperationRequest = {
      assetRequests: [assetRequest],
      refundTokens,
      actions: [action],
    };

    console.log("Operation request: ", operationRequest);
    try {
      const inputs = JSON.parse(await getOperationInputs(operationRequest));
      console.log("From snap inputs: ", inputs);
      const prover = new LocalSpend2Prover();
      const proof = await prover.proveSpend2(
        inputs[0].proofInputs,
        "./spend2.wasm",
        "./spend2.zkey"
      );
      console.log(proof);
    } catch (e) {
      console.error("error: ", e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleClearDb = async () => {
    try {
      await clearDb();
    } catch (e) {
      console.error(e);
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
              button: <InstallFlaskButton />,
            }}
            fullWidth
          />
        )}
        {!state.installedSnap && (
          <Card
            content={{
              title: "Connect",
              description:
                "Get started by connecting to and installing the example snap.",
              button: (
                <ConnectButton
                  onClick={handleConnectClick}
                  disabled={!state.isFlask}
                />
              ),
            }}
            disabled={!state.isFlask}
          />
        )}
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Card
            content={{
              title: "Reconnect",
              description:
                "While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.",
              button: (
                <ReconnectButton
                  onClick={handleConnectClick}
                  disabled={!state.installedSnap}
                />
              ),
            }}
            disabled={!state.installedSnap}
          />
        )}
        <Card
          content={{
            title: "Send Hello message",
            description:
              "Display a custom message within a confirmation screen in MetaMask.",
            button: (
              <SendHelloButton
                onClick={handleSendHelloClick}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
          fullWidth={
            state.isFlask &&
            Boolean(state.installedSnap) &&
            !shouldDisplayReconnectButton(state.installedSnap)
          }
        />
        <Card
          content={{
            title: "Send SetAndShowKv",
            description: "Display SetAndShowKv message.",
            button: (
              <SetAndShowKButton
                onClick={handleSetAndShowKvClick}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
          fullWidth={
            state.isFlask &&
            Boolean(state.installedSnap) &&
            !shouldDisplayReconnectButton(state.installedSnap)
          }
        />
        <Card
          content={{
            title: "Sync Notes",
            description: "Sync notes.",
            button: (
              <SyncNotesButton
                onClick={handleSyncNotesClick}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
          fullWidth={
            state.isFlask &&
            Boolean(state.installedSnap) &&
            !shouldDisplayReconnectButton(state.installedSnap)
          }
        />
        <Card
          content={{
            title: "Sync Leaves",
            description: "Sync leaves.",
            button: (
              <SyncLeavesButton
                onClick={handleSyncLeavesClick}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
          fullWidth={
            state.isFlask &&
            Boolean(state.installedSnap) &&
            !shouldDisplayReconnectButton(state.installedSnap)
          }
        />
        <Card
          content={{
            title: "GetOperationInputs",
            description: "Get operation inputs",
            button: (
              <GetOperationInputsButton
                onClick={handleGetOperationInputs}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
          fullWidth={
            state.isFlask &&
            Boolean(state.installedSnap) &&
            !shouldDisplayReconnectButton(state.installedSnap)
          }
        />
        <Card
          content={{
            title: "Clear DB",
            description: "Clear DB.",
            button: (
              <ClearDbButton
                onClick={handleClearDb}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
          fullWidth={
            state.isFlask &&
            Boolean(state.installedSnap) &&
            !shouldDisplayReconnectButton(state.installedSnap)
          }
        />
        <Notice>
          <p>
            Please note that the <b>snap.manifest.json</b> and{" "}
            <b>package.json</b> must be located in the server root directory and
            the bundle must be hosted at the location specified by the location
            field.
          </p>
        </Notice>
      </CardContainer>
    </Container>
  );
};

export default Index;
